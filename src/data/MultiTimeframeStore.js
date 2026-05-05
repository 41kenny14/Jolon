import { RingBuffer } from '../core/RingBuffer.js';
import { SUPPORTED_TIMEFRAMES, alignTimestamp } from './timeframes.js';

export class MultiTimeframeStore {
  constructor({ capacityPerTf = 500 } = {}) {
    this.timeframes = new Map(
      SUPPORTED_TIMEFRAMES.map((tf) => [tf, { candles: new RingBuffer(capacityPerTf), lastBucket: null }]),
    );
  }

  updateFromTick(tick) {
    for (const [tf, state] of this.timeframes.entries()) {
      const bucket = alignTimestamp(tick.timestamp, tf);
      const last = state.candles.get(0);

      if (!last || state.lastBucket !== bucket) {
        state.candles.push({
          timestamp: bucket,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume,
        });
        state.lastBucket = bucket;
      } else {
        last.high = Math.max(last.high, tick.price);
        last.low = Math.min(last.low, tick.price);
        last.close = tick.price;
        last.volume += tick.volume;
      }
    }
  }

  seedTimeframe(timeframe, candles) {
    const state = this.timeframes.get(timeframe);
    if (!state) throw new Error(`Unsupported timeframe ${timeframe}`);
    for (const c of candles) state.candles.push(c);
    const last = state.candles.get(0);
    state.lastBucket = last?.timestamp ?? null;
  }

  getCandles(timeframe) {
    const state = this.timeframes.get(timeframe);
    if (!state) throw new Error(`Unsupported timeframe ${timeframe}`);
    return state.candles.toArray();
  }
}
