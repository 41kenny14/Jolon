export class LevelDetector {
  constructor({ recentWindow = 20, clusterToleranceBps = 15 } = {}) {
    this.recentWindow = recentWindow;
    this.clusterTolerance = clusterToleranceBps / 10_000;
  }

  detect(candles) {
    if (!candles.length) {
      return {
        recentHigh: null,
        recentLow: null,
        supports: [],
        resistances: [],
      };
    }

    const slice = candles.slice(-this.recentWindow);

    let recentHigh = -Infinity;
    let recentLow = Infinity;

    for (const c of slice) {
      if (c.high > recentHigh) recentHigh = c.high;
      if (c.low < recentLow) recentLow = c.low;
    }

    const supports = this.#clusterPrices(slice.map((c) => c.low));
    const resistances = this.#clusterPrices(slice.map((c) => c.high));

    return {
      recentHigh,
      recentLow,
      supports,
      resistances,
    };
  }

  #clusterPrices(prices) {
    if (prices.length === 0) return [];

    const sorted = [...prices].sort((a, b) => a - b);
    const clusters = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i += 1) {
      const p = sorted[i];
      const ref = current[current.length - 1];
      const pctDiff = Math.abs(p - ref) / ref;

      if (pctDiff <= this.clusterTolerance) {
        current.push(p);
      } else {
        clusters.push(current);
        current = [p];
      }
    }
    clusters.push(current);

    return clusters
      .map((cluster) => ({
        level: cluster.reduce((a, b) => a + b, 0) / cluster.length,
        touches: cluster.length,
      }))
      .sort((a, b) => b.touches - a.touches)
      .slice(0, 3);
  }
}
