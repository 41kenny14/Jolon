export const TIMEFRAMES = Object.freeze({
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
});

export const SUPPORTED_TIMEFRAMES = Object.freeze(Object.keys(TIMEFRAMES));

export function alignTimestamp(timestampMs, timeframe) {
  const bucket = TIMEFRAMES[timeframe];
  if (!bucket) throw new Error(`Unsupported timeframe: ${timeframe}`);
  return Math.floor(timestampMs / bucket) * bucket;
}
