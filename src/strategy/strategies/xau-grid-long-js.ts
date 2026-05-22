import { resolveXauGridLongConfig, simulateXauGridLong } from './xau-grid-long-runtime.ts';

export const xauGridLongJs = {
  id: 'strategy_js_xau_grid_long',
  name: 'XAU Grid Long (JS)',
  description: 'Chart-only long grid signal strategy with future bot-ready metadata.',
  language: 'javascript' as const,
  version: 1,
  params: {
    highPrice: 4857.27,
    lowPrice: 3568.69,
    nLevels: 48,
    gridMode: 'geometric',
    investment: 2000,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      if (!Array.isArray(close) || index < 0 || index >= close.length) return 0;

      var rawParams = context.__strategyParams || {};
      var DEFAULT_XAU_GRID_LONG_CONFIG = { highPrice: 4857.27, lowPrice: 3568.69, nLevels: 48, gridMode: 'geometric', investment: 2000 };
      var EPSILON = 1e-10;
      var toFiniteNumber = function(value, fallback) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      var createBarMeta = function() {
        return {
          buyLevels: [],
          sellLevels: [],
          ownedCount: 0,
          avgEntry: null,
          deployedCapital: 0,
          openQty: 0,
          openPnl: 0,
          eventType: 'none',
          botPayloadHint: {
            action: 'none',
            buyLevels: [],
            sellLevels: [],
            ownedCount: 0,
            avgEntry: null,
          },
        };
      };
      var resolveConfig = ${resolveXauGridLongConfig.toString()};
      var resolveXauGridLongConfig = resolveConfig;
      var buildXauGridLevels = function(configInput) {
        var config = resolveConfig(configInput || {});
        var highPrice = config.highPrice;
        var lowPrice = config.lowPrice;
        var nLevels = config.nLevels;
        var gridMode = config.gridMode;
        var levels = [];
        for (var i = 0; i < nLevels; i += 1) {
          var pct = nLevels <= 1 ? 0 : i / (nLevels - 1);
          var level = gridMode === 'geometric'
            ? highPrice * Math.pow(lowPrice / highPrice, pct)
            : highPrice - (highPrice - lowPrice) * pct;
          levels.push(level);
        }
        return levels;
      };
      var simulateXauGridLong = ${simulateXauGridLong.toString()};
      var config = resolveConfig(rawParams);

      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'xgl_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify(config);

      if (!context.__xauGridLongCache) context.__xauGridLongCache = {};
      if (!context.__xauGridLongCache[cacheKey]) {
        context.__xauGridLongCache[cacheKey] = simulateXauGridLong(close, rawParams);
      }

      return context.__xauGridLongCache[cacheKey].signals[index] || 0;
    }
  )`,
};
