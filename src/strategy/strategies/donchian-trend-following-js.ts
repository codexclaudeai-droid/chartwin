import {
  calculateDonchianTrendAtrSeries,
  calculateDonchianTrendEfficiency,
  calculateDonchianTrendEmaSeries,
  calculateDonchianTrendFollowingChannel,
  createDonchianTrendTradePlan,
  normalizeDonchianTrendEntryMode,
  resolveDonchianTrendFollowingConfig,
  simulateDonchianTrendFollowingStrategy,
} from './donchian-trend-following-runtime.ts';

export const donchianTrendFollowingJs = {
  id: 'strategy_js_donchian_trend_following',
  name: 'Donchian Trend Following',
  description: 'Donchian breakout trend-following signals filtered by trend efficiency, EMA slope, and channel width.',
  language: 'javascript' as const,
  version: 1,
  params: {
    entryMode: 'both',
    entryPeriod: 20,
    exitPeriod: 10,
    atrPeriod: 14,
    emaPeriod: 50,
    trendLookback: 20,
    minEfficiency: 0.35,
    minChannelAtr: 1.4,
    middleTouchToleranceAtr: 0.15,
    setupExpireBars: 20,
    stopAtrMultiplier: 2,
    rrRatio: 2,
    useLong: true,
    useShort: true,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var high = context.high;
      var low = context.low;
      var open = context.open;
      var volume = context.volume;
      if (!Array.isArray(close) || !Array.isArray(high) || !Array.isArray(low) || index < 0 || index >= close.length) return 0;

      var DEFAULT_CONFIG = {
        entryMode: 'both',
        entryPeriod: 20,
        exitPeriod: 10,
        atrPeriod: 14,
        emaPeriod: 50,
        trendLookback: 20,
        minEfficiency: 0.35,
        minChannelAtr: 1.4,
        middleTouchToleranceAtr: 0.15,
        setupExpireBars: 20,
        stopAtrMultiplier: 2,
        rrRatio: 2,
        useLong: true,
        useShort: true,
      };
      var finiteNumber = function(value, fallback) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      var normalizeDonchianTrendEntryMode = ${normalizeDonchianTrendEntryMode.toString()};
      var resolveDonchianTrendFollowingConfig = ${resolveDonchianTrendFollowingConfig.toString()};
      var calculateDonchianTrendFollowingChannel = ${calculateDonchianTrendFollowingChannel.toString()};
      var calculateDonchianTrendAtrSeries = ${calculateDonchianTrendAtrSeries.toString()};
      var calculateDonchianTrendEmaSeries = ${calculateDonchianTrendEmaSeries.toString()};
      var calculateDonchianTrendEfficiency = ${calculateDonchianTrendEfficiency.toString()};
      var createDonchianTrendTradePlan = ${createDonchianTrendTradePlan.toString()};
      var previousLowestLow = function(candles, period, index) {
        var length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.exitPeriod));
        if (index < length) return null;
        var lowest = Infinity;
        for (var i = index - length; i < index; i += 1) {
          lowest = Math.min(lowest, Number(candles[i] && candles[i].low));
        }
        return Number.isFinite(lowest) ? lowest : null;
      };
      var previousHighestHigh = function(candles, period, index) {
        var length = Math.max(1, Math.floor(Number(period) || DEFAULT_CONFIG.exitPeriod));
        if (index < length) return null;
        var highest = -Infinity;
        for (var i = index - length; i < index; i += 1) {
          highest = Math.max(highest, Number(candles[i] && candles[i].high));
        }
        return Number.isFinite(highest) ? highest : null;
      };
      var simulateDonchianTrendFollowingStrategy = ${simulateDonchianTrendFollowingStrategy.toString()};
      var rawParams = context.__strategyParams || {};
      var config = resolveDonchianTrendFollowingConfig(rawParams);
      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'dc_tf_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify(config);

      if (!context.__donchianTrendFollowingCache) context.__donchianTrendFollowingCache = {};
      if (!context.__donchianTrendFollowingCache[cacheKey]) {
        var candles = close.map(function(value, i) {
          return {
            open: Array.isArray(open) ? Number(open[i]) : Number(value),
            high: Number(high[i]),
            low: Number(low[i]),
            close: Number(value),
            volume: Array.isArray(volume) ? Number(volume[i]) : 0,
          };
        });
        context.__donchianTrendFollowingCache[cacheKey] = simulateDonchianTrendFollowingStrategy(candles, rawParams);
      }

      return context.__donchianTrendFollowingCache[cacheKey].signals[index] || 0;
    }
  )`,
};
