import test from 'node:test';
import assert from 'node:assert/strict';
import { getPreferredSymbolProviders, resolveProviderForSymbol } from '../server/provider-routing.mjs';
import { getStrategyMinimumHistory, getStrategyHistoryDiagnostic } from '../src/strategy/strategy-history.ts';

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
