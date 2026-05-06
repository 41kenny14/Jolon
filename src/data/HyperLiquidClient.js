export class HyperLiquidClient {
  constructor({ baseUrl = 'https://api.hyperliquid.xyz/info' } = {}) {
    this.baseUrl = baseUrl;
  }

  async fetchCandles({ coin, interval, startTime, endTime }) {
    const payload = {
      type: 'candleSnapshot',
      req: {
        coin,
        interval,
        startTime,
        endTime,
      },
    };

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HyperLiquid API error ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('HyperLiquid API payload inválido: se esperaba un array de velas.');
    }

    const candles = data
      .map((row) => ({
        timestamp: Number(row.t),
        open: Number(row.o),
        high: Number(row.h),
        low: Number(row.l),
        close: Number(row.c),
        volume: Number(row.v),
      }))
      .filter((candle) =>
        [candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite),
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    if (candles.length === 0) {
      throw new Error('HyperLiquid API devolvió velas vacías o inválidas.');
    }

    return candles;
  }
}
