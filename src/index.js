import { HyperLiquidClient } from './data/HyperLiquidClient.js';
import { MultiTimeframeStore } from './data/MultiTimeframeStore.js';
import { SUPPORTED_TIMEFRAMES } from './data/timeframes.js';
import { IndicatorEngine } from './indicators/IndicatorEngine.js';
import { LevelDetector } from './levels/LevelDetector.js';
import { OrderBookAnalyzer } from './orderbook/OrderBookAnalyzer.js';
import { LiquidityDetector } from './liquidity/LiquidityDetector.js';
import { detectSetup, scoreOpportunity } from './ai/PreAIFilter.js';
import { buildTradingAIPrompt } from './ai/AIPromptBuilder.js';
import { analyzeWithFallback } from './ai/OllamaAnalyzer.js';
import { SignalLogger } from './logging/SignalLogger.js';
import { TelegramAlertService } from './alerts/TelegramAlertService.js';

export class DataAndIndicatorsModule {
  constructor({ coin = 'BTC', capacityPerTf = 500 } = {}) {
    this.coin = coin;
    this.client = new HyperLiquidClient();
    this.store = new MultiTimeframeStore({ capacityPerTf });
    this.indicators = new Map(SUPPORTED_TIMEFRAMES.map((tf) => [tf, new IndicatorEngine()]));
    this.levels = new Map(SUPPORTED_TIMEFRAMES.map((tf) => [tf, new LevelDetector()]));
    this.orderBookAnalyzer = new OrderBookAnalyzer();
    this.liquidityDetector = new LiquidityDetector();
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

  onTick(tick, orderBook = null) {
    this.store.updateFromTick(tick);
    const snapshot = {};
    const orderBookSignal = this.orderBookAnalyzer.analyze(orderBook);

    for (const tf of SUPPORTED_TIMEFRAMES) {
      const candles = this.store.getCandles(tf);
      const last = candles[candles.length - 1];

      const indicatorValues = this.indicators.get(tf).update(last);
      const levels = this.levels.get(tf).detect(candles);
      const liquidity = this.liquidityDetector.detect(orderBook, last?.close);

      snapshot[tf] = {
        candle: last,
        indicators: indicatorValues,
        levels,
        orderBook: orderBookSignal,
        liquidity,
      };
    }

    return snapshot;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class TradingMainLoop {
  constructor({
    coin = 'BTC',
    signalTimeframe = '5m',
    minScore = 2,
    minIntervalMs = 30_000,
    maxIntervalMs = 60_000,
    logFile = './runtime-signals.log',
    enableTelegramAlerts = true,
  } = {}) {
    this.coin = coin;
    this.signalTimeframe = signalTimeframe;
    this.minScore = minScore;
    this.minIntervalMs = minIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.logFile = logFile;
    this.module = new DataAndIndicatorsModule({ coin });
    this.logger = new SignalLogger({ logFile });
    this.alertService = new TelegramAlertService();
    this.enableTelegramAlerts = enableTelegramAlerts;
    this.running = false;
    this.consecutiveErrors = 0;
  }

  async fetchLatestTick() {
    const now = Date.now();
    const start = now - 2 * 60_000;
    const candles = await this.module.client.fetchCandles({
      coin: this.coin,
      interval: '1m',
      startTime: start,
      endTime: now,
    });

    const last = candles[candles.length - 1];
    if (!last) throw new Error('No hay candles para construir tick.');

    return {
      timestamp: last.timestamp,
      price: last.close,
      volume: Math.max(last.volume || 0, 0.01),
    };
  }

  async runCycle() {
    const tick = await this.fetchLatestTick();
    const market = this.module.onTick(tick, null);
    const snapshot = market[this.signalTimeframe] ?? market['5m'] ?? market['1m'];

    const setup = detectSetup(snapshot);
    const scoreResult = scoreOpportunity(snapshot, setup);

    let aiResult = null;
    let aiInput = null;
    if (scoreResult.score >= this.minScore) {
      aiInput = buildTradingAIPrompt({
        symbol: this.coin,
        timeframe: this.signalTimeframe,
        multiTimeframeContext: market,
        orderFlow: snapshot.orderBook,
        liquidity: snapshot.liquidity,
        indicators: snapshot.indicators,
      });

      aiResult = await analyzeWithFallback(aiInput);
    }

    const selected = aiResult?.selected ?? {
      setup: setup.setup ?? 'sin oportunidad',
      direction: setup.direction ?? 'NONE',
      timeframe: this.signalTimeframe,
      confidence: 0,
      reason: scoreResult.reasons.join(', ') || 'score insuficiente',
    };

    const signal = {
      timestamp: new Date().toISOString(),
      coin: this.coin,
      timeframe: this.signalTimeframe,
      score: scoreResult.score,
      scoreReasons: scoreResult.reasons,
      setup,
      used7B: Boolean(aiResult?.primary),
      used27B: Boolean(aiResult?.usedValidation),
      confidence: Number(selected.confidence || 0),
      signal: {
        setup: selected.setup,
        direction: selected.direction,
        reason: selected.reason,
      },
    };

    await this.logger.log({
      event: 'signal_cycle',
      input: {
        tick,
        market,
        signalTimeframe: this.signalTimeframe,
        scoreResult,
        aiInput,
      },
      output: signal,
      metadata: {
        coin: this.coin,
      },
    });

    if (this.enableTelegramAlerts) {
      try {
        await this.alertService.sendAlert({
          symbol: this.coin,
          setup: signal.signal.setup,
          direction: signal.signal.direction,
          timeframe: signal.timeframe,
          confidence: signal.confidence,
          reason: signal.signal.reason,
        });
      } catch (error) {
        await this.logger.log({
          event: 'telegram_alert_error',
          input: {
            symbol: this.coin,
            timeframe: signal.timeframe,
          },
          output: {
            message: error.message,
          },
        });
      }
    }

    return signal;
  }

  async start() {
    this.running = true;
    await this.module.bootstrap(6);

    while (this.running) {
      try {
        const signal = await this.runCycle();
        this.consecutiveErrors = 0;
        console.log(`[${signal.timestamp}] score=${signal.score} confidence=${signal.confidence} dir=${signal.signal.direction}`);
      } catch (error) {
        this.consecutiveErrors += 1;
        const backoffMs = Math.min(120_000, 5_000 * this.consecutiveErrors);
        console.error(`Error en ciclo (${this.consecutiveErrors}):`, error.message);
        await wait(backoffMs);
      }

      const jitterMs = randomBetween(this.minIntervalMs, this.maxIntervalMs);
      await wait(jitterMs);
    }
  }

  stop() {
    this.running = false;
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const loop = new TradingMainLoop({ coin: 'BTC' });

  process.on('SIGINT', () => {
    console.log('Deteniendo loop principal...');
    loop.stop();
  });

  loop.start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { detectSetup, scoreOpportunity } from './ai/PreAIFilter.js';
export { buildTradingAIPrompt } from './ai/AIPromptBuilder.js';
export { analyzeWithFallback } from './ai/OllamaAnalyzer.js';
