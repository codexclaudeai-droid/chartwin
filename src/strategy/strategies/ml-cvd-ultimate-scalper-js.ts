export const mlCvdUltimateScalperJs = {
  id: 'strategy_js_ml_cvd_ultimate_scalper',
  name: 'ML CVD Ultimate Scalper',
  description: 'KNN candle-pattern scalper filtered by EMA trend, ATR range expansion, and the existing CVD indicator flow.',
  language: 'javascript' as const,
  version: 1,
  params: {
    neighborsCount: 5,
    voteThreshold: 4,
    featureWindow: 20,
    trendEma: 200,
    atrPeriod: 14,
    atrRangeMult: 0.8,
    useCvdFilter: true,
  },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var open = context.open;
      var high = context.high;
      var low = context.low;
      var cvd = context.cvd;
      if (!Array.isArray(close) || !Array.isArray(open) || !Array.isArray(high) || !Array.isArray(low)) return 0;
      if (index <= 0 || index >= close.length) return 0;

      var rawParams = context.__strategyParams || {};
      var neighborsCount = Math.max(1, Math.round(Number(rawParams.neighborsCount) || 5));
      var voteThreshold = Math.max(1, Math.round(Number(rawParams.voteThreshold) || 4));
      var featureWindow = Math.max(neighborsCount, Math.round(Number(rawParams.featureWindow) || 20));
      var trendPeriod = Math.max(1, Math.round(Number(rawParams.trendEma) || 200));
      var atrPeriod = Math.max(1, Math.round(Number(rawParams.atrPeriod) || 14));
      var atrRangeMult = Math.max(0, Number(rawParams.atrRangeMult) || 0.8);
      var useCvdFilter = rawParams.useCvdFilter !== false;
      var required = Math.max(featureWindow + 2, trendPeriod, atrPeriod + 1);
      if (index < required) return 0;

      var firstKey = Math.round((close[0] || 0) * 1e5);
      var lastKey = Math.round((close[close.length - 1] || 0) * 1e5);
      var cvdLastKey = Array.isArray(cvd) ? Math.round((Number(cvd[cvd.length - 1]) || 0) * 1e3) : 0;
      var cacheKey = 'ml_cvd_ultimate_' + close.length + '_' + firstKey + '_' + lastKey + '_' + cvdLastKey + '_' + JSON.stringify({
        neighborsCount: neighborsCount,
        voteThreshold: voteThreshold,
        featureWindow: featureWindow,
        trendPeriod: trendPeriod,
        atrPeriod: atrPeriod,
        atrRangeMult: atrRangeMult,
        useCvdFilter: useCvdFilter
      });
      if (!context.__mlCvdUltimateScalperCache) context.__mlCvdUltimateScalperCache = {};
      if (context.__mlCvdUltimateScalperCache[cacheKey]) return context.__mlCvdUltimateScalperCache[cacheKey][index] || 0;

      var finite = function(value) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      var emaSeries = function(values, period) {
        var out = new Array(values.length).fill(null);
        if (period <= 0 || values.length < period) return out;
        var sum = 0;
        for (var i = 0; i < values.length; i += 1) {
          var value = finite(values[i]);
          if (value == null) continue;
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
        var out = new Array(close.length).fill(null);
        if (close.length <= atrPeriod) return out;
        var tr = new Array(close.length).fill(0);
        for (var i = 1; i < close.length; i += 1) {
          tr[i] = Math.max(
            high[i] - low[i],
            Math.abs(high[i] - close[i - 1]),
            Math.abs(low[i] - close[i - 1])
          );
        }
        var seed = 0;
        for (var j = 1; j <= atrPeriod; j += 1) seed += tr[j];
        out[atrPeriod] = seed / atrPeriod;
        for (var k = atrPeriod + 1; k < close.length; k += 1) {
          out[k] = ((out[k - 1] || 0) * (atrPeriod - 1) + tr[k]) / atrPeriod;
        }
        return out;
      };

      var predictMarketDirection = function(bar) {
        var currentF1 = close[bar] - close[bar - 1];
        var currentF2 = close[bar] - open[bar];
        var distances = [];
        for (var i = bar - featureWindow; i < bar; i += 1) {
          var pastF1 = close[i] - close[i - 1];
          var pastF2 = close[i] - open[i];
          var distance = Math.sqrt(Math.pow(currentF1 - pastF1, 2) + Math.pow(currentF2 - pastF2, 2));
          distances.push({
            distance: distance,
            direction: close[i] > close[i - 1] ? 1 : -1
          });
        }
        distances.sort(function(left, right) { return left.distance - right.distance; });
        var buyVotes = 0;
        var sellVotes = 0;
        for (var v = 0; v < Math.min(neighborsCount, distances.length); v += 1) {
          if (distances[v].direction > 0) buyVotes += 1;
          else sellVotes += 1;
        }
        if (buyVotes >= voteThreshold) return 1;
        if (sellVotes >= voteThreshold) return -1;
        return 0;
      };

      var trendEma = emaSeries(close, trendPeriod);
      var atr = atrSeries();
      var signals = new Array(close.length).fill(0);

      for (var bar = required; bar < close.length; bar += 1) {
        var currentAtr = atr[bar];
        var trend = trendEma[bar];
        if (currentAtr == null || trend == null || currentAtr <= 0) continue;
        if ((high[bar] - low[bar]) < currentAtr * atrRangeMult) continue;

        var mlSignal = predictMarketDirection(bar);
        var hasCvd = Array.isArray(cvd) && Number.isFinite(Number(cvd[bar])) && Number.isFinite(Number(cvd[bar - 1]));
        var currentCvd = hasCvd ? Number(cvd[bar]) : 0;
        var prevCvd = hasCvd ? Number(cvd[bar - 1]) : 0;
        var cvdBuying = !useCvdFilter || !hasCvd || currentCvd > prevCvd || currentCvd > 0;
        var cvdSelling = !useCvdFilter || !hasCvd || currentCvd < prevCvd || currentCvd < 0;

        if (mlSignal === 1 && close[bar] > trend && cvdBuying) {
          signals[bar] = 1;
        } else if (mlSignal === -1 && close[bar] < trend && cvdSelling) {
          signals[bar] = -1;
        }
      }

      context.__mlCvdUltimateScalperCache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
