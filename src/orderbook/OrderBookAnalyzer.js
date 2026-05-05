export class OrderBookAnalyzer {
  constructor({ pressureThreshold = 0.1 } = {}) {
    this.pressureThreshold = pressureThreshold;
  }

  analyze(orderBook) {
    if (!orderBook) return this.#empty();

    const bidVolume = this.#sumSize(orderBook.bids);
    const askVolume = this.#sumSize(orderBook.asks);
    const total = bidVolume + askVolume;
    const imbalance = total === 0 ? 0 : (bidVolume - askVolume) / total;

    let pressure = 'neutral';
    if (imbalance > this.pressureThreshold) pressure = 'buying';
    else if (imbalance < -this.pressureThreshold) pressure = 'selling';

    return { bidVolume, askVolume, imbalance, pressure };
  }

  #sumSize(levels = []) {
    let total = 0;
    for (let i = 0; i < levels.length; i += 1) {
      total += Number(levels[i].size) || 0;
    }
    return total;
  }

  #empty() {
    return { bidVolume: 0, askVolume: 0, imbalance: 0, pressure: 'neutral' };
  }
}
