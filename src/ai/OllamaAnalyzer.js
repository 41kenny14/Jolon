const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

function extractJSON(text = '') {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No se pudo extraer JSON de la respuesta del modelo.');
    }
    return JSON.parse(match[0]);
  }
}

async function analyzeWithModel({ model, prompt, keepAlive, ollamaUrl }) {
  const MAX_PROMPT_CHARS = 18_000;
  const trimmedPrompt = String(prompt).slice(0, MAX_PROMPT_CHARS);
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: trimmedPrompt,
      stream: false,
      keep_alive: keepAlive,
      options: {
        num_ctx: 2048,
        num_predict: 220,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Ollama error (${model}): ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const parsed = extractJSON(data.response);
  return {
    model,
    raw: data,
    parsed,
  };
}

/**
 * Reglas:
 * - NUNCA paralelo
 * - siempre secuencial
 * - 7B siempre primero
 * - 27B solo si confidence > 80
 */
export async function analyzeWithFallback(
  prompt,
  {
    ollamaUrl = DEFAULT_OLLAMA_URL,
    primaryModel = 'qwen3.6:7b',
    validationModel = 'qwen3.6:27b',
    primaryKeepAlive = '5m',
    validationKeepAlive = '0',
    validationConfidenceThreshold = 80,
  } = {}
) {
  let primary;
  try {
    primary = await analyzeWithModel({
      model: primaryModel,
      prompt,
      keepAlive: primaryKeepAlive,
      ollamaUrl,
    });
  } catch (error) {
    return {
      usedValidation: false,
      selected: {
        setup: 'sin oportunidad',
        direction: 'NONE',
        timeframe: 'N/A',
        confidence: 0,
        reason: `fallback local: ${error.message}`,
      },
      primary: null,
      validation: null,
      error: error.message,
    };
  }

  const confidence = Number(primary?.parsed?.confidence ?? 0);
  const shouldValidate = confidence > validationConfidenceThreshold;

  // 2) Nunca paralelo: solo evalúa 27B después de finalizar 7B y solo si supera umbral.
  if (!shouldValidate) {
    return {
      usedValidation: false,
      selected: primary.parsed,
      primary,
      validation: null,
    };
  }

  // 3) 27B con keep_alive "0" para evitar retención de memoria y swapping.
  let validation;
  try {
    validation = await analyzeWithModel({
      model: validationModel,
      prompt,
      keepAlive: validationKeepAlive,
      ollamaUrl,
    });
  } catch {
    return {
      usedValidation: false,
      selected: primary.parsed,
      primary,
      validation: null,
    };
  }

  return {
    usedValidation: true,
    selected: validation.parsed,
    primary,
    validation,
  };
}
