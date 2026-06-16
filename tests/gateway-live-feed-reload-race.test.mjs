import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

async function importBundledGatewayFeed() {
  const outdir = await mkdtemp(join(tmpdir(), 'gateway-feed-test-'));
  const outfile = join(outdir, 'gateway-live-feed.mjs');
  await build({
    entryPoints: ['src/data/gateway-live-feed.ts'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outfile,
    write: true,
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

function installBrowserStubs() {
  const listeners = new Map();
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  globalThis.window = {
    location: { hostname: 'localhost', origin: 'http://localhost:5173' },
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: (name, cb) => listeners.set(name, cb),
  };
  globalThis.WebSocket = class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
    }
    close() {
      this.onclose?.();
    }
  };
}

test('gateway reload aborts an in-flight fetch and requests the latest timeframe', async () => {
  installBrowserStubs();
  const { createGatewayLiveFeed } = await importBundledGatewayFeed();

  const requestedUrls = [];
  let firstFetchStarted;
  const firstFetchReady = new Promise((resolve) => { firstFetchStarted = resolve; });

  globalThis.fetch = async (url, init = {}) => {
    requestedUrls.push(String(url));
    if (requestedUrls.length === 1) {
      firstFetchStarted();
      return await new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }
    return {
      ok: true,
      json: async () => ({
        candles: [
          { time: 1000, open: 1, high: 2, low: 1, close: 2, volume: 10 },
        ],
      }),
    };
  };

  const chart = {
    config: { symbol: 'XAUUSD', timeframe: '1m' },
    candles: [],
    setData(candles) { this.candles = candles.slice(); },
    getCandles() { return this.candles; },
    addNewCandle(candle) { this.candles.push(candle); },
    updateLastCandle(patch) { this.candles[this.candles.length - 1] = { ...this.candles.at(-1), ...patch }; },
  };
  const feed = createGatewayLiveFeed({ chart, limit: 300 });

  const initialStart = feed.start().catch(() => false);
  try {
    await firstFetchReady;

    chart.config.timeframe = '5m';
    const reloadOk = await feed.reload();

    assert.equal(reloadOk, true);
    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[0], /timeframe=1m/);
    assert.match(requestedUrls[1], /timeframe=5m/);
    assert.deepEqual(chart.candles.map((row) => row.time), [1000]);
  } finally {
    feed.stop();
    await initialStart;
  }
});

