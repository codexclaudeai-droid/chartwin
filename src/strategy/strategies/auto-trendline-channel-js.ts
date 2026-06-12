import {
  calculateAutoTrendlineChannel,
  resolveAutoTrendlineChannelConfig,
  simulateAutoTrendlineChannelStrategy,
} from './auto-trendline-channel-runtime.ts';

export const autoTrendlineChannelJs = {
  id: 'strategy_js_auto_trendline_channel',
  name: 'Auto Trendline Momentum Channel',
  description: 'Linear-regression parallel channel that auto-updates trend direction and emits channel re-entry signals.',
  language: 'javascript' as const,
  version: 1,
  params: {
    channelLength: 20,
    widthMultiplier: 1.5,
    rrRatio: 1.5,
    useLong: true,
    useShort: true,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var high = context.high;
      var low = context.low;
      var open = context.open;
      if (!Array.isArray(close) || !Array.isArray(high) || !Array.isArray(low) || index < 0 || index >= close.length) return 0;

      var resolveAutoTrendlineChannelConfig = ${resolveAutoTrendlineChannelConfig.toString()};
      var calculateAutoTrendlineChannel = ${calculateAutoTrendlineChannel.toString()};
      var simulateAutoTrendlineChannelStrategy = ${simulateAutoTrendlineChannelStrategy.toString()};
      var DEFAULT_CONFIG = {
        channelLength: 20,
        widthMultiplier: 1.5,
        rrRatio: 1.5,
        useLong: true,
        useShort: true,
      };
      var finiteNumber = function(value, fallback) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      var linregAt = function(values, period, idx) {
        if (period <= 1 || idx < period - 1) return null;
        var start = idx - period + 1;
        var sumX = 0;
        var sumY = 0;
        var sumXY = 0;
        var sumXX = 0;
        for (var j = 0; j < period; j += 1) {
          var y = values[start + j];
          if (!Number.isFinite(y)) return null;
          sumX += j;
          sumY += y;
          sumXY += j * y;
          sumXX += j * j;
        }
        var denom = period * sumXX - sumX * sumX;
        if (Math.abs(denom) < Number.EPSILON) return null;
        var slope = (period * sumXY - sumX * sumY) / denom;
        var intercept = (sumY - slope * sumX) / period;
        return intercept + slope * (period - 1);
      };
      var stdevAt = function(values, period, idx) {
        if (period <= 0 || idx < period - 1) return null;
        var start = idx - period + 1;
        var sum = 0;
        for (var j = start; j <= idx; j += 1) {
          var value = values[j];
          if (!Number.isFinite(value)) return null;
          sum += value;
        }
        var mean = sum / period;
        var variance = 0;
        for (var k = start; k <= idx; k += 1) {
          var diff = values[k] - mean;
          variance += diff * diff;
        }
        return Math.sqrt(variance / period);
      };
      var crossedOver = function(prevA, currentA, prevB, currentB) {
        return prevA != null && prevB != null && currentB != null && prevA <= prevB && currentA > currentB;
      };
      var crossedUnder = function(prevA, currentA, prevB, currentB) {
        return prevA != null && prevB != null && currentB != null && prevA >= prevB && currentA < currentB;
      };
      var confirmedPivotLow = function(candles, center, span) {
        if (center - span < 0 || center + span >= candles.length) return null;
        var value = candles[center].low;
        for (var i = center - span; i <= center + span; i += 1) {
          if (i !== center && candles[i].low <= value) return null;
        }
        return value;
      };
      var confirmedPivotHigh = function(candles, center, span) {
        if (center - span < 0 || center + span >= candles.length) return null;
        var value = candles[center].high;
        for (var i = center - span; i <= center + span; i += 1) {
          if (i !== center && candles[i].high >= value) return null;
        }
        return value;
      };
      var rawParams = context.__strategyParams || {};
      var config = resolveAutoTrendlineChannelConfig(rawParams);
      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'atc_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify(config);

      if (!context.__autoTrendlineChannelCache) context.__autoTrendlineChannelCache = {};
      if (!context.__autoTrendlineChannelCache[cacheKey]) {
        var candles = close.map(function(value, i) {
          return {
            open: Array.isArray(open) ? Number(open[i]) : Number(value),
            high: Number(high[i]),
            low: Number(low[i]),
            close: Number(value),
          };
        });
        context.__autoTrendlineChannelCache[cacheKey] = simulateAutoTrendlineChannelStrategy(candles, rawParams);
      }

      return context.__autoTrendlineChannelCache[cacheKey].signals[index] || 0;
    }
  )`,
};
