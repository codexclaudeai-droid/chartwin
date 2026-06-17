import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SIGNAL_POLICY_SETTINGS,
  normalizeSignalPolicySettings,
  resolveSignalPolicyForSymbol,
} from '../src/domain/chart-service/signal-policy.ts';

test('signal policy defaults to chart strategy simple signal mode', () => {
  assert.deepEqual(normalizeSignalPolicySettings(null), DEFAULT_SIGNAL_POLICY_SETTINGS);
});

test('signal policy normalization keeps advanced chart strategy options', () => {
  const settings = normalizeSignalPolicySettings({
    globalPolicy: {
      source: 'chart_strategy',
      strategyId: 'strategy_js_double_break',
      executionMode: 'advanced_order_plan',
      fillModel: 'ohlc_candle_path',
      enabled: true,
    },
    symbolPolicies: [
      {
        symbolId: 'NAS100 Futures',
        source: 'ea_strategy',
        strategyId: 'mt5-nq-breakout',
        executionMode: 'ea_signal',
        fillModel: 'actual_fill',
        enabled: false,
      },
    ],
  });

  assert.equal(settings.globalPolicy.strategyId, 'strategy_js_double_break');
  assert.equal(settings.globalPolicy.executionMode, 'advanced_order_plan');
  assert.equal(settings.globalPolicy.fillModel, 'ohlc_candle_path');
  assert.equal(settings.symbolPolicies[0].symbolId, 'NQ1!');
  assert.equal(settings.symbolPolicies[0].source, 'ea_strategy');
  assert.equal(settings.symbolPolicies[0].executionMode, 'ea_signal');
  assert.equal(settings.symbolPolicies[0].fillModel, 'actual_fill');
  assert.equal(settings.symbolPolicies[0].enabled, false);
});

test('signal policy rejects unsupported option values back to safe defaults', () => {
  const settings = normalizeSignalPolicySettings({
    globalPolicy: {
      source: 'unknown',
      strategyId: '',
      executionMode: 'nonsense',
      fillModel: 'future_magic',
      enabled: 'yes',
    },
    symbolPolicies: [
      { symbolId: '', source: 'chart_strategy' },
      { symbolId: 'xauusd', source: 'actual_fill', strategyId: '' },
    ],
  });

  assert.equal(settings.globalPolicy.source, 'chart_strategy');
  assert.equal(settings.globalPolicy.strategyId, 'strategy_js_grid_martingale');
  assert.equal(settings.globalPolicy.executionMode, 'simple_signal');
  assert.equal(settings.globalPolicy.fillModel, 'ohlc_conservative');
  assert.equal(settings.globalPolicy.enabled, true);
  assert.equal(settings.symbolPolicies.length, 1);
  assert.equal(settings.symbolPolicies[0].symbolId, 'XAUUSD');
});

test('symbol policy overrides global signal policy by uppercase symbol id', () => {
  const settings = normalizeSignalPolicySettings({
    globalPolicy: { strategyId: 'global_strategy' },
    symbolPolicies: [{ symbolId: 'xauusd', strategyId: 'xau_strategy' }],
  });

  assert.equal(resolveSignalPolicyForSymbol(settings, 'btcusdt').strategyId, 'global_strategy');
  assert.equal(resolveSignalPolicyForSymbol(settings, 'XAUUSD').strategyId, 'xau_strategy');
});
