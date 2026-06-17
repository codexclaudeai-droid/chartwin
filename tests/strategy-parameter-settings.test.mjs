import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeStrategyParameterSettings,
  resolveStrategyParamsForSymbol,
} from '../src/domain/chart-service/strategy-parameters.ts';

test('strategy parameter settings normalize global and symbol profiles', () => {
  const settings = normalizeStrategyParameterSettings({
    profiles: [
      {
        strategyId: 'strategy_js_grid_martingale',
        name: 'Global grid',
        params: { gridStep: 120, enabled: true, note: 'base', nested: { bad: true } },
      },
      {
        strategyId: 'strategy_js_grid_martingale',
        symbolId: 'NAS100 Futures',
        params: { gridStep: 40, takeProfitSteps: 1.8 },
      },
      { strategyId: '', params: { ignored: 1 } },
    ],
  });

  assert.equal(settings.profiles.length, 2);
  assert.equal(settings.profiles[0].id, 'strategy_js_grid_martingale:global');
  assert.equal(settings.profiles[1].id, 'strategy_js_grid_martingale:NQ1!');
  assert.deepEqual(settings.profiles[0].params, { gridStep: 120, enabled: true, note: 'base' });
});

test('strategy parameter resolver merges defaults, global profile, and symbol override', () => {
  const settings = normalizeStrategyParameterSettings({
    profiles: [
      { strategyId: 'strategy_js_grid_martingale', params: { gridStep: 120, maxLevel: 8 } },
      { strategyId: 'strategy_js_grid_martingale', symbolId: 'xauusd', params: { gridStep: 25 } },
    ],
  });

  assert.deepEqual(
    resolveStrategyParamsForSymbol(settings, 'strategy_js_grid_martingale', 'BTCUSDT', { gridStep: 10, takeProfitSteps: 2 }),
    { gridStep: 120, takeProfitSteps: 2, maxLevel: 8 },
  );
  assert.deepEqual(
    resolveStrategyParamsForSymbol(settings, 'strategy_js_grid_martingale', 'XAUUSD', { gridStep: 10, takeProfitSteps: 2 }),
    { gridStep: 25, takeProfitSteps: 2, maxLevel: 8 },
  );
});
