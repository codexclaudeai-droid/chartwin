import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBinanceWebSocketCollector,
  fetchBinanceOneMinuteHistory,
  mergeBinanceCollectorConfig,
  parseBinanceKlinePayload,
} from '../server/binance-websocket-collector.mjs';

function createKline(openTimeMs, open, high, low, close, volume) {
  return [
    openTimeMs,
    String(open),
    String(high),
    String(low),
    String(close),
    String(volume),
  ];
}

test('binance collector defaults to BTCUSDT storage with bounded backfill', () => {
  const config = mergeBinanceCollectorConfig();

  assert.deepEqual(config.storedSymbols, ['BTCUSDT']);
  assert.equal(config.backfillLimit, 3000);
  assert.equal(config.reconnectMs, 5000);
});

test('binance kline payload normalizes to a 1m candle', () => {
  const candle = parseBinanceKlinePayload({
    k: {
      t: 1713916800000,
      o: '64000.1',
      h: '64010.2',
      l: '63990.3',
      c: '64005.4',
      v: '12.345',
    },
  });

  assert.deepEqual(candle, {
    time: 1713916800,
    open: 64000.1,
    high: 64010.2,
    low: 63990.3,
    close: 64005.4,
    volume: 12.345,
  });
});

test('binance history fetch pages newest 1m candles and dedupes by time', async () => {
  const requestedUrls = [];
  const baseMs = 1713916800000;
  const fetchFn = async (url) => {
    requestedUrls.push(url);
    const parsed = new URL(url);
    const endTime = parsed.searchParams.get('endTime');
    const rows = endTime == null
      ? Array.from({ length: 1000 }, (_, index) => {
          const openTimeMs = baseMs + (index + 1) * 60_000;
          return createKline(openTimeMs, index + 1, index + 2, index, index + 1.5, index + 10);
        })
      : [createKline(baseMs, 1, 2, 0.5, 1.5, 10)];
    return {
      ok: true,
      async json() {
        return rows;
      },
    };
  };

  const candles = await fetchBinanceOneMinuteHistory({
    fetchFn,
    market: 'spot',
    symbol: 'BTCUSDT',
    limit: 1001,
  });

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /api\.binance\.com\/api\/v3\/klines/);
  assert.equal(new URL(requestedUrls[0]).searchParams.get('symbol'), 'BTCUSDT');
  assert.equal(candles.length, 1001);
  assert.equal(candles[0].time, 1713916800);
  assert.equal(candles.at(-1).time, 1713976800);
});

test('binance collector backfills BTCUSDT then applies live kline updates', async () => {
  const historical = [];
  const live = [];
  const sockets = [];
  const fetchFn = async () => ({
    ok: true,
    async json() {
      return [createKline(1713916800000, 1, 2, 0.5, 1.5, 10)];
    },
  });
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      sockets.push(this);
    }

    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }

    close() {
      this.closed = true;
    }
  }

  const collector = createBinanceWebSocketCollector({
    config: { storedSymbols: ['BTCUSDT'], backfillLimit: 1, reconnectMs: 1000 },
    applyHistoricalCandles: (market, symbol, timeframe, candles) => {
      historical.push({ market, symbol, timeframe, candles });
    },
    applyLiveCandle: (market, symbol, timeframe, candle) => {
      live.push({ market, symbol, timeframe, candle });
    },
    fetchFn,
    WebSocketCtor: FakeWebSocket,
    logger: { log() {}, warn() {}, error() {} },
  });

  collector.start();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(historical.length, 1);
  assert.equal(historical[0].market, 'crypto');
  assert.equal(historical[0].symbol, 'BTCUSDT');
  assert.equal(historical[0].timeframe, '1m');
  assert.equal(historical[0].candles.length, 1);
  assert.equal(sockets.length, 1);
  assert.match(sockets[0].url, /btcusdt@kline_1m/);

  sockets[0].listeners.message({
    data: JSON.stringify({
      k: {
        t: 1713916860000,
        o: '2',
        h: '3',
        l: '1',
        c: '2.5',
        v: '20',
      },
    }),
  });

  assert.deepEqual(live, [{
    market: 'crypto',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    candle: {
      time: 1713916860,
      open: 2,
      high: 3,
      low: 1,
      close: 2.5,
      volume: 20,
    },
  }]);

  collector.stop();
});
