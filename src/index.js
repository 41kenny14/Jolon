import { HyperLiquidClient } from './data/HyperLiquidClient.js';
import { MultiTimeframeStore } from './data/MultiTimeframeStore.js';
import { SUPPORTED_TIMEFRAMES } from './data/timeframes.js';
import { IndicatorEngine } from './indicators/IndicatorEngine.js';
import { LevelDetector } from './levels/LevelDetector.js';

export class DataAndIndicatorsModule {
  constructor({ coin = 'BTC', capacityPerTf = 500 } = {}) {
    this.coin = coin;
    this.client = new HyperLiquidClient();
    this.store = new MultiTimeframeStore({ capacityPerTf });
    this.indicators = new Map(SUPPORTED_TIMEFRAMES.map((tf) => [tf, new IndicatorEngine()]));
    this.levels = new Map(SUPPORTED_TIMEFRAMES.map((tf) => [tf, new LevelDetector()]));
  }

  async bootstrap(hoursBack = 24) {
    const now = Date.now();
    const start = now - hoursBack * 3600_000;

    for (const tf of SUPPORTED_TIMEFRAMES) {
      const candles = await this.client.fetchCandles({
        coin: this.coin,
        interval: tf,
        startTime: start,
        endTime: now,
      });
      this.store.seedTimeframe(tf, candles);

      const indicatorEngine = this.indicators.get(tf);
      for (const candle of candles) indicatorEngine.update(candle);
    }
  }

  onTick(tick) {
    this.store.updateFromTick(tick);
    const snapshot = {};

    for (const tf of SUPPORTED_TIMEFRAMES) {
      const candles = this.store.getCandles(tf);
      const last = candles[candles.length - 1];

      const indicatorValues = this.indicators.get(tf).update(last);
      const levels = this.levels.get(tf).detect(candles);

      snapshot[tf] = {
        candle: last,
        indicators: indicatorValues,
        levels,
      };
    }

    return snapshot;
  }
}

// Ejemplo de uso manual
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const mod = new DataAndIndicatorsModule({ coin: 'BTC' });
  mod.bootstrap(6)
    .then(() => {
      const tick = { timestamp: Date.now(), price: 100000, volume: 12.5 };
      const out = mod.onTick(tick);
      console.log(JSON.stringify(out, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
