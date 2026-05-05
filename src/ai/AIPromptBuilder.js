export function buildTradingAIPrompt({
  symbol,
  timeframe,
  multiTimeframeContext,
  orderFlow,
  liquidity,
  indicators,
}) {
  return `Eres un analista cuantitativo extremadamente conservador. Evalúa oportunidad de trading para ${symbol} en ${timeframe}.\n\nPrioridad obligatoria de análisis (de mayor a menor):\n1) Liquidez\n2) Order flow\n3) Multi-timeframe\n4) Indicadores\n\nReglas:\n- Evita falsos positivos.\n- Si hay duda o conflicto entre señales, responde sin oportunidad.\n- Solo marcar LONG/SHORT cuando haya alineación clara y confirmada.\n- Si detectas trampa de liquidez o ruptura fallida, priorizar fake breakout o liquidity grab.\n\nClasifica SOLO en una categoría:\n- breakout\n- retest\n- pullback\n- fake breakout\n- liquidity grab\n- consolidación\n- sin oportunidad\n\nContexto de mercado:\n${JSON.stringify({
    timeframe,
    multiTimeframeContext,
    orderFlow,
    liquidity,
    indicators,
  }, null, 2)}\n\nResponde SOLO en JSON válido con este esquema exacto:\n{\n  \"setup\": \"...\",\n  \"direction\": \"LONG | SHORT | NONE\",\n  \"timeframe\": \"...\",\n  \"confidence\": number,\n  \"reason\": \"...\"\n}`;
}
