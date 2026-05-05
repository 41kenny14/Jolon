export class LiquidityDetector {
  constructor({ maxZones = 3 } = {}) {
    this.maxZones = maxZones;
  }

  detect(orderBook, referencePrice) {
    if (!orderBook || !referencePrice) {
      return { above: [], below: [] };
    }

    const above = this.#topZones(orderBook.asks, referencePrice, 'above');
    const below = this.#topZones(orderBook.bids, referencePrice, 'below');

    return { above, below };
  }

  #topZones(levels = [], ref, direction) {
    const filtered = [];

    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      const price = Number(level.price);
      const size = Number(level.size) || 0;

      if (!price || size <= 0) continue;
      if (direction === 'above' && price <= ref) continue;
      if (direction === 'below' && price >= ref) continue;

      filtered.push({ price, size });
    }

    filtered.sort((a, b) => b.size - a.size);

    return filtered.slice(0, this.maxZones);
  }
}
