import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPreferredSymbolProviders, resolveProviderForSymbol } from '../server/provider-routing.mjs';
import { getStrategyMinimumHistory, getStrategyHistoryDiagnostic } from '../src/strategy/strategy-history.ts';

const gatewayFeedSource = fs.readFileSync(path.resolve('src/data/gateway-live-feed.ts'), 'utf8');
const gatewayServerSource = fs.readFileSync(path.resolve('server/data-gateway.mjs'), 'utf8');
const marketSessionSource = fs.readFileSync(path.resolve('src/utils/market-session.ts'), 'utf8');

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
    /normalized === 'XAUUSDT' \|\| normalized === 'XAUUSDT\.P'[\s\S]*return 'XAUUSD';/,
    'frontend gateway requests should map gold USDT aliases to stored XAUUSD candles',
  );
  assert.match(
    gatewayFeedSource,
    /return isCryptoLikeSymbol\(symbol\) && !isCommodityLikeSymbol\(symbol\);/,
    'commodity-like USDT symbols should use the gateway instead of Binance direct history',
  );
  assert.match(
    marketSessionSource,
    /if \(upper === 'XAGUSDT' \|\| upper === 'XAGUSDT\.P'\) return 'XAGUSD';/,
    'UI symbol selection should canonicalize silver USDT aliases before reloading data',
  );
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
