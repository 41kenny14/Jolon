export class IndicatorEngine {
  constructor({ rsiPeriod = 14, emaPeriod = 20 } = {}) {
    this.rsiPeriod = rsiPeriod;
    this.emaPeriod = emaPeriod;
    this.prevClose = null;
    this.avgGain = null;
    this.avgLoss = null;
    this.seedGains = [];
    this.seedLosses = [];
    this.ema20 = null;
  }

  update(candle) {
    if (!candle || typeof candle.close !== 'number') {
      return {
        rsi: null,
        ema20: this.ema20,
        volume: null,
      };
    }

    const close = candle.close;
    const volume = candle.volume;

    if (this.ema20 === null) {
      this.ema20 = close;
    } else {
      const k = 2 / (this.emaPeriod + 1);
      this.ema20 = close * k + this.ema20 * (1 - k);
    }

    let rsi = null;
    if (this.prevClose !== null) {
      const delta = close - this.prevClose;
      const gain = delta > 0 ? delta : 0;
      const loss = delta < 0 ? -delta : 0;

      if (this.avgGain === null || this.avgLoss === null) {
        this.seedGains.push(gain);
        this.seedLosses.push(loss);

        if (this.seedGains.length === this.rsiPeriod) {
          const sumGain = this.seedGains.reduce((a, b) => a + b, 0);
          const sumLoss = this.seedLosses.reduce((a, b) => a + b, 0);
          this.avgGain = sumGain / this.rsiPeriod;
          this.avgLoss = sumLoss / this.rsiPeriod;
          rsi = this.#toRsi(this.avgGain, this.avgLoss);
        }
      } else {
        this.avgGain = ((this.avgGain * (this.rsiPeriod - 1)) + gain) / this.rsiPeriod;
        this.avgLoss = ((this.avgLoss * (this.rsiPeriod - 1)) + loss) / this.rsiPeriod;
        rsi = this.#toRsi(this.avgGain, this.avgLoss);
      }
    }

    this.prevClose = close;

    return {
      rsi,
      ema20: this.ema20,
      volume,
    };
  }

  #toRsi(avgGain, avgLoss) {
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
}
