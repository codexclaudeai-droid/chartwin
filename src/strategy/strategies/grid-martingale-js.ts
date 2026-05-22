import { resolveGridMartingaleConfig } from './grid-martingale-presets.js';
import { simulateGridMartingale } from './grid-martingale-runtime.js';

export const gridMartingaleJs = {
  id: 'strategy_js_grid_martingale',
  name: 'Grid Martingale Scalping',
  description: 'Grid martingale scalping strategy with configurable step, TP, max level, and stop settings.',
  language: 'javascript' as const,
  version: 3,
  params: {
    gridStep: 120,
    takeProfitSteps: 2.2,
    maxLevel: 8,
    equityStopPct: 14,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      if (!close || index < 1) return 0;

      var rawParams = context.__strategyParams || {};
      var resolveConfig = ${resolveGridMartingaleConfig.toString()};
      var simulateGridMartingale = ${simulateGridMartingale.toString()};
      var config = resolveConfig(context.__symbol || '', rawParams);

      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey  = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'gm_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify(config);

      if (!context.__gmCache) context.__gmCache = {};
      if (context.__gmCache[cacheKey]) return context.__gmCache[cacheKey].signals[index] || 0;

      var result = simulateGridMartingale(close, context.__symbol || '', rawParams);
      context.__gmCache[cacheKey] = result;
      return result.signals[index] || 0;
    }
  )`,
};
