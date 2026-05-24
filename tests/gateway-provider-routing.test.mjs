import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPreferredSymbolProviders, resolveProviderForSymbol } from '../server/provider-routing.mjs';
import { getStrategyMinimumHistory, getStrategyHistoryDiagnostic } from '../src/strategy/strategy-history.ts';

const gatewayFeedSource = fs.readFileSync(path.resolve('src/data/gateway-live-feed.ts'), 'utf8');
const gatewayServerSource = fs.readFileSync(path.resolve('server/data-gateway.mjs'), 'utf8');
const marketSessionSource = fs.readFileSync(path.resolve('src/utils/market-session.ts'), 'utf8');
const pagesCandlesSource = fs.readFileSync(path.resolve('functions/candles.js'), 'utf8');
const pagesWebhookSource = fs.readFileSync(path.resolve('functions/ingest/webhook/tradingview.js'), 'utf8');

test('KOSPI-family symbols prefer KIS when credentials are available', () => {
  const prefs = getPreferredSymbolProviders();
  assert.equal(prefs.index.KOSPI, 'kis');
  assert.equal(prefs.index.KOSPI200, 'kis');
  assert.equal(prefs.index.KOSDAQ, 'kis');

  assert.equal(
    resolveProviderForSymbol({ market: 'index', symbol: 'KOSPI', configuredProvider: 'kis', hasKisCredentials: true }),
    'kis',
  );
});

test('KOSPI-family symbols fall back to webhook when KIS credentials are unavailable', () => {
  assert.equal(
    resolveProviderForSymbol({ market: 'index', symbol: 'KOSPI', configuredProvider: 'kis', hasKisCredentials: false }),
    'webhook',
  );
});

test('strategy history diagnostics flag insufficient gateway history for heavy strategies', () => {
  assert.equal(getStrategyMinimumHistory('strategy_pine_bbands_directed'), 200);
  const diagnostic = getStrategyHistoryDiagnostic('strategy_pine_bbands_directed', 55);
  assert.equal(diagnostic.ready, false);
  assert.equal(diagnostic.required, 200);
  assert.equal(diagnostic.missing, 145);
  assert.match(diagnostic.message || '', /55.*200/);
});

test('webhook commodity aliases resolve to stored candle symbols', () => {
  assert.match(
    gatewayFeedSource,
    /if \(normalized === 'WTI'\) return 'WTI1!';/,
    'frontend gateway requests should map WTI clicks to the stored WTI1! candle key',
  );
  assert.match(
    gatewayFeedSource,
    /return isCryptoLikeSymbol\(symbol\);/,
    'USDT perpetual symbols such as XAUUSDT.P and XAGUSDT.P should keep using Binance direct history',
  );
  assert.doesNotMatch(marketSessionSource, /XAUUSDT\.P'[\s\S]*return 'XAUUSD'/);
  assert.doesNotMatch(marketSessionSource, /XAGUSDT\.P'[\s\S]*return 'XAGUSD'/);
  assert.match(
    gatewayServerSource,
    /function getCandleRowsWithLegacyFallback\(market, symbol, timeframe\)/,
    'the gateway should keep reading legacy misplaced commodity candle keys',
  );
  assert.match(
    gatewayServerSource,
    /function canonicalizeMarketForSymbol\(market, symbol\)/,
    'stored candle keys should normalize commodity symbols out of the index market',
  );
  assert.match(
    gatewayServerSource,
    /market === 'index' && \/\^\(XAU\|XAG\|XPT\|USO\|WTI\|BRENT\)\//,
    'XAGUSD and other commodity symbols should not stay under index keys after gateway load',
  );
  assert.match(
    gatewayServerSource,
    /candleKey\('index', symbol, timeframe\)/,
    'legacy XAU/XAG rows stored under index should still be returned for commodity requests',
  );
});

test('Cloudflare Pages functions use the same webhook symbol aliases', () => {
  assert.match(
    pagesCandlesSource,
    /function canonicalizeMarketForSymbol\(market, symbol\)/,
    'Cloudflare /candles should normalize commodity symbols out of index requests',
  );
  assert.doesNotMatch(pagesCandlesSource, /XAUUSDT\.P'[\s\S]*return 'XAUUSD'/);
  assert.doesNotMatch(pagesCandlesSource, /XAGUSDT\.P'[\s\S]*return 'XAGUSD'/);
  assert.match(
    pagesCandlesSource,
    /keySet\.add\(`index:\$\{symbol\}:\$\{timeframe\}`\)/,
    'Cloudflare /candles should read legacy misplaced XAU/XAG index keys',
  );
  assert.match(
    pagesCandlesSource,
    /'futures'\]\.forEach\(\(candidateMarket\)/,
    'Cloudflare /candles should look for legacy NAS100/NQ futures keys when reading NQ history',
  );
  assert.match(
    pagesCandlesSource,
    /debug = url\.searchParams\.get\('debug'\) === '1'/,
    'Cloudflare /candles should expose opt-in diagnostics for KV key lookup issues',
  );
  assert.match(
    pagesCandlesSource,
    /kvBound: Boolean\(env\.CANDLES_KV\)/,
    'diagnostics should reveal whether the production KV binding is available',
  );
  assert.doesNotMatch(pagesWebhookSource, /XAUUSDT\.P'[\s\S]*return 'XAUUSD'/);
  assert.doesNotMatch(pagesWebhookSource, /XAGUSDT\.P'[\s\S]*return 'XAGUSD'/);
});
