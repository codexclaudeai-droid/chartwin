import { resolveGridMartingaleConfig } from './grid-martingale-presets.js';

export const gridMartingaleJs = {
  id: 'strategy_js_grid_martingale',
  name: 'Grid Martingale Scalping',
  description: 'Grid martingale scalping strategy with configurable step, TP, max level, and stop settings.',
  language: 'javascript' as const,
  version: 2,
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
      var config = resolveConfig(context.__symbol || '', rawParams);

      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey  = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'gm_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify(config);

      if (!context.__gmCache) context.__gmCache = {};
      if (context.__gmCache[cacheKey]) return context.__gmCache[cacheKey][index] || 0;

      var GRID_STEP = Math.max(Number(config.gridStep) || 0, 0.0001);
      var TAKE_PROFIT_STEPS = Math.max(Number(config.takeProfitSteps) || 0, 0.1);
      var MAX_LEVEL = Math.max(1, Math.round(Number(config.maxLevel) || 1));
      var EQUITY_STOP_PCT = Math.max(Number(config.equityStopPct) || 0, 0.1);

      var midPrice = close[Math.floor(close.length / 2)] || 1;
      var pointValue = midPrice >= 10000 ? 1.0
                     : midPrice >= 1000  ? 0.1
                     : midPrice >= 10    ? 0.01
                     :                    0.0001;
      var gridStep = GRID_STEP * pointValue;
      var targetProfit = gridStep * TAKE_PROFIT_STEPS;

      var n = close.length;
      var signals = new Array(n).fill(0);
      var positions = [];
      var balance = midPrice * 100;

      for (var i = 1; i < n; i++) {
        var price = close[i];
        var openPnl = 0;
        for (var j = 0; j < positions.length; j++) openPnl += price - positions[j];
        var equity = balance + openPnl;

        if (balance > 0 && (1.0 - equity / balance) * 100.0 >= EQUITY_STOP_PCT && positions.length > 0) {
          signals[i] = -1;
          balance = equity;
          positions = [];
          continue;
        }

        if (openPnl >= targetProfit && positions.length > 0) {
          signals[i] = -1;
          balance += openPnl;
          positions = [];
          continue;
        }

        if (positions.length < MAX_LEVEL) {
          var doBuy = positions.length === 0;
          if (!doBuy) {
            var minPrice = positions[0];
            for (var k = 1; k < positions.length; k++) {
              if (positions[k] < minPrice) minPrice = positions[k];
            }
            doBuy = price <= minPrice - gridStep;
          }
          if (doBuy) {
            positions.push(price);
            signals[i] = 1;
          }
        }
      }

      context.__gmCache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
