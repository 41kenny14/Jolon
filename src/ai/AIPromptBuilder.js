export function buildTradingAIPrompt({
  symbol,
  timeframe,
  multiTimeframeContext,
  orderFlow,
  liquidity,
  indicators,
  maxTimeframes = 3,
}) {
  const summarizedContext = summarizeContext(multiTimeframeContext, maxTimeframes);

  return `Eres un analista cuantitativo extremadamente conservador. Evalúa oportunidad de trading para ${symbol} en ${timeframe}.\n\nPrioridad obligatoria de análisis (de mayor a menor):\n1) Liquidez\n2) Order flow\n3) Multi-timeframe\n4) Indicadores\n\nReglas:\n- Evita falsos positivos.\n- Si hay duda o conflicto entre señales, responde sin oportunidad.\n- Solo marcar LONG/SHORT cuando haya alineación clara y confirmada.\n- Si detectas trampa de liquidez o ruptura fallida, priorizar fake breakout o liquidity grab.\n\nClasifica SOLO en una categoría:\n- breakout\n- retest\n- pullback\n- fake breakout\n- liquidity grab\n- consolidación\n- sin oportunidad\n\nContexto de mercado:\n${JSON.stringify({
    timeframe,
    multiTimeframeContext: summarizedContext,
    orderFlow,
    liquidity,
    indicators,
  }, null, 2)}\n\nResponde SOLO en JSON válido con este esquema exacto:\n{\n  \"setup\": \"...\",\n  \"direction\": \"LONG | SHORT | NONE\",\n  \"timeframe\": \"...\",\n  \"confidence\": number,\n  \"reason\": \"...\"\n}`;
}

function summarizeContext(multiTimeframeContext = {}, maxTimeframes) {
  const tfs = Object.keys(multiTimeframeContext).slice(-Math.max(1, maxTimeframes));
  const out = {};

  for (const tf of tfs) {
    const frame = multiTimeframeContext[tf] ?? {};
    out[tf] = {
      candle: frame.candle
        ? {
            timestamp: frame.candle.timestamp,
            open: frame.candle.open,
            high: frame.candle.high,
            low: frame.candle.low,
            close: frame.candle.close,
            volume: frame.candle.volume,
          }
        : null,
      indicators: frame.indicators ?? null,
      levels: frame.levels
        ? {
            recentHigh: frame.levels.recentHigh,
            recentLow: frame.levels.recentLow,
            supports: (frame.levels.supports ?? []).slice(0, 2),
            resistances: (frame.levels.resistances ?? []).slice(0, 2),
          }
        : null,
      liquidity: frame.liquidity
        ? {
            above: (frame.liquidity.above ?? []).slice(0, 2),
            below: (frame.liquidity.below ?? []).slice(0, 2),
          }
        : null,
    };
  }

  return out;
}
