export const bbMtfKalmanSignalJs = {
  id: 'strategy_js_bb_mtf_kalman_signal',
  name: 'BB MTF Kalman Signal (JS)',
  description: 'Bollinger Bands MTF with Kalman reversal signals exposed as BUY/SELL strategy signals.',
  language: 'javascript' as const,
  version: 1,
  params: {
    chartTimeframe: '1h',
    htfTimeframe: '4h',
    ltfLength: 20,
    ltfMult: 2,
    htfLength: 20,
    htfMult: 2.25,
  },
  sourceCode: `(
    function(context, index) {
      var open = context.open;
      var high = context.high;
      var low = context.low;
      var close = context.close;
      if (!Array.isArray(open) || !Array.isArray(high) || !Array.isArray(low) || !Array.isArray(close)) return 0;
      if (index <= 0 || index >= close.length) return 0;

      var rawParams = context.__strategyParams || {};
      var chartTimeframe = String(rawParams.chartTimeframe || '1h');
      var htfTimeframe = String(rawParams.htfTimeframe || '4h');
      var ltfLength = Math.max(1, Math.floor(Number(rawParams.ltfLength) || 20));
      var htfLength = Math.max(1, Math.floor(Number(rawParams.htfLength) || 20));
      var ltfMult = Math.max(0.1, Number(rawParams.ltfMult) || 2);
      var htfMult = Math.max(0.1, Number(rawParams.htfMult) || 2.25);

      var firstKey = Math.round((Number(close[0]) || 0) * 1e5);
      var lastKey = Math.round((Number(close[close.length - 1]) || 0) * 1e5);
      var cacheKey = 'bb_mtf_kalman_signal_' + close.length + '_' + firstKey + '_' + lastKey + '_' + JSON.stringify({
        chartTimeframe: chartTimeframe,
        htfTimeframe: htfTimeframe,
        ltfLength: ltfLength,
        ltfMult: ltfMult,
        htfLength: htfLength,
        htfMult: htfMult
      });
      if (!context.__bbMtfKalmanSignalStrategyCache) context.__bbMtfKalmanSignalStrategyCache = {};
      if (context.__bbMtfKalmanSignalStrategyCache[cacheKey]) return context.__bbMtfKalmanSignalStrategyCache[cacheKey][index] || 0;

      var timeframeSecondsByKey = {
        '1s': 1, '5s': 5, '10s': 10, '15s': 15, '30s': 30, '45s': 45,
        '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '45m': 2700,
        '1h': 3600, '2h': 7200, '3h': 10800, '4h': 14400,
        '1d': 86400, '1w': 604800, '1M': 2592000
      };
      var parseTimeframeSeconds = function(timeframe) {
        var raw = String(timeframe || '').trim();
        if (!raw) return null;
        if (timeframeSecondsByKey[raw]) return timeframeSecondsByKey[raw];
        if (/^\\d+$/.test(raw)) return Number(raw) * 60;
        var match = raw.match(/^(\\d+)([smhdwM])$/);
        if (!match) return null;
        var value = Number(match[1]);
        var unit = match[2];
        if (!Number.isFinite(value) || value <= 0) return null;
        if (unit === 's') return value;
        if (unit === 'm') return value * 60;
        if (unit === 'h') return value * 3600;
        if (unit === 'd') return value * 86400;
        if (unit === 'w') return value * 604800;
        if (unit === 'M') return value * 2592000;
        return null;
      };

      var chartSeconds = parseTimeframeSeconds(chartTimeframe);
      var htfSeconds = parseTimeframeSeconds(htfTimeframe);
      var n = close.length;
      var signals = new Array(n).fill(0);
      if (!chartSeconds || !htfSeconds || htfSeconds <= chartSeconds) {
        context.__bbMtfKalmanSignalStrategyCache[cacheKey] = signals;
        return 0;
      }

      var volume = Array.isArray(context.volume) ? context.volume : [];
      var time = Array.isArray(context.time) ? context.time : [];
      var candles = close.map(function(value, i) {
        return {
          open: Number(open[i]),
          high: Number(high[i]),
          low: Number(low[i]),
          close: Number(value),
          volume: Number(volume[i]) || 0,
          time: Number.isFinite(Number(time[i])) ? Number(time[i]) : i * chartSeconds
        };
      });

      var calculatePopulationStdev = function(values) {
        if (!values.length) return 0;
        var mean = values.reduce(function(sum, value) { return sum + value; }, 0) / values.length;
        var variance = values.reduce(function(sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / values.length;
        return Math.sqrt(Math.max(0, variance));
      };
      var calculateBollingerFromValues = function(values, length, mult) {
        var basis = new Array(values.length).fill(null);
        var upper = new Array(values.length).fill(null);
        var lower = new Array(values.length).fill(null);
        for (var i = length - 1; i < values.length; i += 1) {
          var window = values.slice(i - length + 1, i + 1);
          var mean = window.reduce(function(sum, value) { return sum + value; }, 0) / length;
          var dev = calculatePopulationStdev(window) * mult;
          basis[i] = mean;
          upper[i] = mean + dev;
          lower[i] = mean - dev;
        }
        return { basis: basis, upper: upper, lower: lower };
      };
      var calculateEmaFromNullable = function(values, length) {
        var out = new Array(values.length).fill(null);
        var k = 2 / (length + 1);
        var buffer = [];
        var prev = null;
        for (var i = 0; i < values.length; i += 1) {
          var value = values[i];
          if (value == null || !Number.isFinite(value)) {
            out[i] = null;
            continue;
          }
          if (prev == null) {
            buffer.push(value);
            if (buffer.length < length) continue;
            if (buffer.length > length) buffer = buffer.slice(buffer.length - length);
            prev = buffer.reduce(function(sum, item) { return sum + item; }, 0) / length;
            out[i] = prev;
            continue;
          }
          prev = value * k + prev * (1 - k);
          out[i] = prev;
        }
        return out;
      };
      var calculateKalmanBasis = function(values) {
        var out = new Array(values.length).fill(null);
        var processNoise = 0.2;
        var measurementError = 2;
        var estimate = null;
        var errorEstimate = 1;
        for (var i = 0; i < values.length; i += 1) {
          if (estimate == null) estimate = i > 0 ? values[i - 1] : null;
          var kalmanGain = errorEstimate / (errorEstimate + measurementError);
          if (estimate != null) {
            estimate = estimate + kalmanGain * (values[i] - estimate);
            out[i] = estimate;
          }
          errorEstimate = (1 - kalmanGain) * errorEstimate + processNoise;
        }
        return out;
      };

      var htfCandles = [];
      var expectedBars = Math.max(1, Math.round(htfSeconds / chartSeconds));
      var current = null;
      var currentBucket = NaN;
      for (var c = 0; c < candles.length; c += 1) {
        var bucketStart = Math.floor(candles[c].time / htfSeconds) * htfSeconds;
        if (!current || bucketStart !== currentBucket) {
          if (current) htfCandles.push(current);
          currentBucket = bucketStart;
          current = {
            startIndex: c,
            endIndex: c,
            open: candles[c].open,
            high: candles[c].high,
            low: candles[c].low,
            close: candles[c].close,
            volume: candles[c].volume,
            complete: false
          };
        } else {
          current.high = Math.max(current.high, candles[c].high);
          current.low = Math.min(current.low, candles[c].low);
          current.close = candles[c].close;
          current.volume += candles[c].volume;
          current.endIndex = c;
        }
      }
      if (current) htfCandles.push(current);
      htfCandles.forEach(function(htf, htfIndex) {
        var hasNextBucket = htfIndex < htfCandles.length - 1;
        var observedBars = htf.endIndex - htf.startIndex + 1;
        htf.complete = hasNextBucket || observedBars >= expectedBars;
      });

      var mapConfirmedHtfSeriesToChartBars = function(length, htfSeries) {
        var out = new Array(length).fill(null);
        var lastConfirmed = null;
        var htfIndex = 0;
        for (var i = 0; i < length; i += 1) {
          while (htfIndex < htfCandles.length) {
            var htf = htfCandles[htfIndex];
            if (i < htf.endIndex) break;
            if (i === htf.endIndex && htf.complete) {
              var next = htfSeries[htfIndex];
              if (next != null) lastConfirmed = next;
            }
            if (i < htf.endIndex + 1) break;
            htfIndex += 1;
          }
          out[i] = lastConfirmed;
          if (htfIndex < htfCandles.length && i >= htfCandles[htfIndex].endIndex) htfIndex += 1;
        }
        return out;
      };

      var htfBb = calculateBollingerFromValues(htfCandles.map(function(candle) { return candle.close; }), htfLength, htfMult);
      var htfUpper = calculateEmaFromNullable(mapConfirmedHtfSeriesToChartBars(n, htfBb.upper), htfLength);
      var htfLower = calculateEmaFromNullable(mapConfirmedHtfSeriesToChartBars(n, htfBb.lower), htfLength);
      var ltfBasis = calculateKalmanBasis(close);
      var ltfUpper = new Array(n).fill(null);
      var ltfLower = new Array(n).fill(null);
      for (var l = ltfLength - 1; l < n; l += 1) {
        var basis = ltfBasis[l];
        if (basis == null) continue;
        var dev = calculatePopulationStdev(close.slice(l - ltfLength + 1, l + 1)) * ltfMult;
        ltfUpper[l] = basis + dev;
        ltfLower[l] = basis - dev;
      }

      var crossedAbove = false;
      var crossedBelow = false;
      var bearSignaled = false;
      var bullSignaled = false;
      for (var bar = 0; bar < n; bar += 1) {
        var price = close[bar];
        var upper = htfUpper[bar];
        var lower = htfLower[bar];
        if (upper != null && price > upper) crossedAbove = true;
        if (lower != null && price < lower) crossedBelow = true;

        var ltfUpperValue = ltfUpper[bar];
        var prevLtfUpperValue = bar > 0 ? ltfUpper[bar - 1] : null;
        var ltfLowerValue = ltfLower[bar];
        var prevLtfLowerValue = bar > 0 ? ltfLower[bar - 1] : null;
        if (crossedAbove && ltfUpperValue != null && prevLtfUpperValue != null && ltfUpperValue < prevLtfUpperValue && !bearSignaled) {
          signals[bar] = -1;
          bearSignaled = true;
        }
        if (crossedBelow && ltfLowerValue != null && prevLtfLowerValue != null && ltfLowerValue > prevLtfLowerValue && !bullSignaled) {
          signals[bar] = 1;
          bullSignaled = true;
        }

        if (ltfUpperValue != null && upper != null && price < ltfUpperValue && price < upper) {
          crossedAbove = false;
          bearSignaled = false;
        }
        if (ltfLowerValue != null && lower != null && price > ltfLowerValue && price > lower) {
          crossedBelow = false;
          bullSignaled = false;
        }
      }

      context.__bbMtfKalmanSignalStrategyCache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
