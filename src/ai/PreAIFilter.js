const DEFAULT_BREAK_TOLERANCE = 0.001;
const DEFAULT_PULLBACK_TOLERANCE = 0.002;
const DEFAULT_LIQUIDITY_NEAR_PCT = 0.003;

function pctDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(a - b) / b;
}

function nearestLiquidityDistance(price, liquidity = { above: [], below: [] }) {
  const candidates = [
    ...(liquidity.above || []).map((l) => Number(l.price)),
    ...(liquidity.below || []).map((l) => Number(l.price)),
  ].filter(Boolean);

  if (!candidates.length || !price) return Infinity;

  let min = Infinity;
  for (const candidate of candidates) {
    const dist = pctDistance(price, candidate);
    if (dist < min) min = dist;
  }

  return min;
}

export function detectSetup(
  marketSnapshot,
  { breakTolerance = DEFAULT_BREAK_TOLERANCE, pullbackTolerance = DEFAULT_PULLBACK_TOLERANCE } = {},
) {
  const price = Number(marketSnapshot?.candle?.close);
  const levels = marketSnapshot?.levels || {};
  const recentHigh = Number(levels.recentHigh);
  const recentLow = Number(levels.recentLow);

  if (!price || !recentHigh || !recentLow) return { setup: null, direction: 'NONE', valid: false };

  if (price >= recentHigh * (1 + breakTolerance)) {
    return { setup: 'breakout', direction: 'LONG', valid: true };
  }

  if (price <= recentLow * (1 - breakTolerance)) {
    return { setup: 'breakout', direction: 'SHORT', valid: true };
  }

  const nearSupport = (levels.supports || []).some((s) => pctDistance(price, Number(s.level)) <= pullbackTolerance);
  const nearResistance = (levels.resistances || []).some((r) => pctDistance(price, Number(r.level)) <= pullbackTolerance);

  if (nearSupport) return { setup: 'pullback', direction: 'LONG', valid: true };
  if (nearResistance) return { setup: 'pullback', direction: 'SHORT', valid: true };

  return { setup: null, direction: 'NONE', valid: false };
}

export function scoreOpportunity(
  marketSnapshot,
  setupSignal,
  { liquidityNearPct = DEFAULT_LIQUIDITY_NEAR_PCT } = {},
) {
  const orderFlow = marketSnapshot?.orderBook?.pressure || 'neutral';
  const price = Number(marketSnapshot?.candle?.close);
  const liquidity = marketSnapshot?.liquidity || { above: [], below: [] };

  let score = 0;
  const reasons = [];

  if (setupSignal?.valid) {
    score += 1;
    reasons.push('setup válido');
  }

  const alignedLong = setupSignal?.direction === 'LONG' && orderFlow === 'buying';
  const alignedShort = setupSignal?.direction === 'SHORT' && orderFlow === 'selling';
  if (alignedLong || alignedShort) {
    score += 1;
    reasons.push('order flow alineado');
  }

  const liqDist = nearestLiquidityDistance(price, liquidity);
  if (liqDist <= liquidityNearPct) {
    score += 1;
    reasons.push('cercanía a liquidez');
  }

  return { score, reasons, liquidityDistance: liqDist };
}

export function shouldSendToAI(scoreResult, minScore = 2) {
  return Number(scoreResult?.score || 0) >= minScore;
}

export function preAIFilter(marketSnapshot, options = {}) {
  const setup = detectSetup(marketSnapshot, options);
  const scoreResult = scoreOpportunity(marketSnapshot, setup, options);
  const pass = shouldSendToAI(scoreResult, options.minScore || 2);

  return {
    setup,
    score: scoreResult.score,
    reasons: scoreResult.reasons,
    discard: !pass,
    minScore: options.minScore || 2,
  };
}
