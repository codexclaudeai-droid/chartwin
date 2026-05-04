export const doubleBreakJs = {
  id: 'strategy_js_double_break',
  name: 'Double Break Strategy (JS)',
  description: 'BB upper/lower + Envelope upper/lower breakout signals',
  language: 'javascript' as const,
  version: 1,
  sourceCode: `(
    function(context, index) {
      const cfg = Object.assign({
        bbPeriod: 20,
        bbStd: 2.0,
        envPeriod: 20,
        envPct: 3.0,
        atrPeriod: 14,
        tp1Multi: 1.5,
        tp2Multi: 2.5,
        slMulti: 1.0,
        crossTol: 0.018,
        minBarGap: 3
      }, context.__doubleBreakConfig || {});
      const open = context.open;
      const high = context.high;
      const low = context.low;
      const close = context.close;
      if (!open || !high || !low || !close || index <= 0 || index >= close.length) return 0;

      const cacheKey = 'double_break_' + close.length + '_' + close[close.length - 1];
      if (!context.__doubleBreakCache) context.__doubleBreakCache = {};
      if (!context.__doubleBreakCache[cacheKey]) {
        const n = close.length;
        const signals = new Array(n).fill(0);

        const smaAt = function(values, period, i) {
          if (i < period - 1) return null;
          var sum = 0;
          for (var j = i - period + 1; j <= i; j += 1) sum += values[j];
          return sum / period;
        };

        const bbAt = function(i) {
          const mid = smaAt(close, cfg.bbPeriod, i);
          if (mid == null) return null;
          var acc = 0;
          for (var j = i - cfg.bbPeriod + 1; j <= i; j += 1) {
            const d = close[j] - mid;
            acc += d * d;
          }
          const std = Math.sqrt(acc / cfg.bbPeriod);
          return {
            upper: mid + cfg.bbStd * std,
            lower: mid - cfg.bbStd * std
          };
        };

        const envAt = function(i) {
          const mid = smaAt(close, cfg.envPeriod, i);
          if (mid == null) return null;
          return {
            upper: mid * (1 + cfg.envPct / 100),
            lower: mid * (1 - cfg.envPct / 100)
          };
        };

        const tr = new Array(n).fill(0);
        for (var i = 0; i < n; i += 1) {
          if (i === 0) {
            tr[i] = high[i] - low[i];
          } else {
            const prevClose = close[i - 1];
            tr[i] = Math.max(
              high[i] - low[i],
              Math.abs(high[i] - prevClose),
              Math.abs(low[i] - prevClose)
            );
          }
        }

        var lastLong = -999999;
        var lastShort = -999999;
        const proximity = function(a, b) {
          const denom = Math.max(Math.abs((a + b) / 2), Number.EPSILON);
          return Math.abs(a - b) / denom;
        };

        for (var k = 1; k < n; k += 1) {
          const bb = bbAt(k);
          const env = envAt(k);
          const atr = smaAt(tr, cfg.atrPeriod, k);
          if (!bb || !env || atr == null) continue;

          const isBull = close[k] > open[k];
          const isBear = close[k] < open[k];
          const isLongZone = proximity(bb.upper, env.upper) <= cfg.crossTol;
          const isShortZone = proximity(bb.lower, env.lower) <= cfg.crossTol;

          if (isLongZone && isBull && close[k] > Math.max(bb.upper, env.upper) && k - lastLong >= cfg.minBarGap) {
            signals[k] = 1;
            lastLong = k;
          } else if (isShortZone && isBear && close[k] < Math.min(bb.lower, env.lower) && k - lastShort >= cfg.minBarGap) {
            signals[k] = -1;
            lastShort = k;
          }
        }

        context.__doubleBreakCache = { [cacheKey]: signals };
      }

      return context.__doubleBreakCache[cacheKey][index] || 0;
    }
  )`,
};
