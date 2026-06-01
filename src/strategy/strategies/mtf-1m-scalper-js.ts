export const mtf1mScalperJs = {
  id: 'strategy_js_mtf_1m_scalper',
  name: 'MTF 1m Scalper',
  description: '1m EMA cross scalper filtered by a derived 5m EMA trend and ATR volatility readiness.',
  language: 'javascript' as const,
  version: 1,
  params: {
    fastEma: 5,
    slowEma: 13,
    filterEma: 50,
    atrPeriod: 14,
    atrMult: 1.5,
    tpMult: 1.5,
    htfFactor: 5,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var high = context.high;
      var low = context.low;
      if (!close || !high || !low || index <= 0 || index >= close.length) return 0;

      var rawParams = context.__strategyParams || {};
      var fastPeriod = Math.max(1, Math.round(Number(rawParams.fastEma) || 5));
      var slowPeriod = Math.max(fastPeriod + 1, Math.round(Number(rawParams.slowEma) || 13));
      var filterPeriod = Math.max(1, Math.round(Number(rawParams.filterEma) || 50));
      var atrPeriod = Math.max(1, Math.round(Number(rawParams.atrPeriod) || 14));
      var atrMult = Math.max(0.01, Number(rawParams.atrMult) || 1.5);
      var tpMult = Math.max(0.01, Number(rawParams.tpMult) || 1.5);
      var htfFactor = Math.max(2, Math.round(Number(rawParams.htfFactor) || 5));
      var n = close.length;
      var firstKey = Math.round((close[0] || 0) * 1e6);
      var lastKey = Math.round((close[n - 1] || 0) * 1e6);
      var cacheKey = 'mtf_1m_scalper_' + JSON.stringify({
        fastPeriod: fastPeriod,
        slowPeriod: slowPeriod,
        filterPeriod: filterPeriod,
        atrPeriod: atrPeriod,
        atrMult: atrMult,
        tpMult: tpMult,
        htfFactor: htfFactor,
        n: n,
        firstKey: firstKey,
        lastKey: lastKey
      });
      if (!context.__mtf1mScalperCache) context.__mtf1mScalperCache = {};
      if (context.__mtf1mScalperCache[cacheKey]) return context.__mtf1mScalperCache[cacheKey][index] || 0;

      var emaSeries = function(values, period) {
        var out = new Array(values.length).fill(null);
        if (!values.length || period <= 0 || values.length < period) return out;
        var sum = 0;
        for (var i = 0; i < values.length; i += 1) {
          var value = Number(values[i]);
          if (!Number.isFinite(value)) continue;
          if (i < period) sum += value;
          if (i === period - 1) {
            out[i] = sum / period;
          } else if (i >= period) {
            var prev = out[i - 1];
            var alpha = 2 / (period + 1);
            out[i] = prev == null ? value : (value - prev) * alpha + prev;
          }
        }
        return out;
      };

      var atrSeries = function() {
        var out = new Array(n).fill(null);
        if (n <= 1 || n < atrPeriod + 1) return out;
        var tr = new Array(n).fill(0);
        for (var i = 1; i < n; i += 1) {
          tr[i] = Math.max(
            high[i] - low[i],
            Math.abs(high[i] - close[i - 1]),
            Math.abs(low[i] - close[i - 1])
          );
        }
        var seed = 0;
        for (var j = 1; j <= atrPeriod; j += 1) seed += tr[j];
        out[atrPeriod] = seed / atrPeriod;
        for (var k = atrPeriod + 1; k < n; k += 1) {
          out[k] = ((out[k - 1] || 0) * (atrPeriod - 1) + tr[k]) / atrPeriod;
        }
        return out;
      };

      var htfClose = [];
      for (var h = htfFactor - 1; h < n; h += htfFactor) htfClose.push(close[h]);
      if (n % htfFactor !== 0) htfClose.push(close[n - 1]);

      var fastEma = emaSeries(close, fastPeriod);
      var slowEma = emaSeries(close, slowPeriod);
      var filterEma = emaSeries(htfClose, filterPeriod);
      var atr = atrSeries();
      var signals = new Array(n).fill(0);

      for (var bar = 1; bar < n; bar += 1) {
        var htfIndex = Math.min(Math.floor(bar / htfFactor), filterEma.length - 1);
        var currentFast = fastEma[bar];
        var prevFast = fastEma[bar - 1];
        var currentSlow = slowEma[bar];
        var prevSlow = slowEma[bar - 1];
        var currentFilter = filterEma[htfIndex];
        var currentAtr = atr[bar];
        if (
          currentFast == null || prevFast == null ||
          currentSlow == null || prevSlow == null ||
          currentFilter == null || currentAtr == null ||
          currentAtr <= 0
        ) {
          continue;
        }

        var isHTFUp = close[bar] > currentFilter;
        var isHTFDown = close[bar] < currentFilter;
        var isCrossUp = prevFast <= prevSlow && currentFast > currentSlow;
        var isCrossDown = prevFast >= prevSlow && currentFast < currentSlow;
        var volatilityReady = Math.abs(close[bar] - close[bar - 1]) <= currentAtr * atrMult * 4;

        if (volatilityReady && isHTFUp && isCrossUp) {
          signals[bar] = 1;
        } else if (volatilityReady && isHTFDown && isCrossDown) {
          signals[bar] = -1;
        }
      }

      context.__mtf1mScalperCache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
