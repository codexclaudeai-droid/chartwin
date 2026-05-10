export const doubleBreakJs = {
  id: 'strategy_js_double_break',
  name: 'Double Break Strategy (JS)',
  description: 'BB upper/lower + Envelope upper/lower breakout signals',
  language: 'javascript' as const,
  version: 2,
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
        minBarGap: 3,
        useAdxFilter: false,
        adxPeriod: 14,
        adxMin: 20
      }, context.__doubleBreakConfig || {});
      const open = context.open;
      const high = context.high;
      const low = context.low;
      const close = context.close;
      if (!open || !high || !low || !close || index <= 0 || index >= close.length) return 0;

      const cacheKey = 'double_break_' + JSON.stringify({
        n: close.length,
        last: close[close.length - 1],
        bbPeriod: cfg.bbPeriod,
        bbStd: cfg.bbStd,
        envPeriod: cfg.envPeriod,
        envPct: cfg.envPct,
        atrPeriod: cfg.atrPeriod,
        crossTol: cfg.crossTol,
        minBarGap: cfg.minBarGap,
        useAdxFilter: !!cfg.useAdxFilter,
        adxPeriod: cfg.adxPeriod,
        adxMin: cfg.adxMin
      });
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
        const plusDm = new Array(n).fill(0);
        const minusDm = new Array(n).fill(0);
        const adx = new Array(n).fill(null);

        for (var i = 0; i < n; i += 1) {
          if (i === 0) {
            tr[i] = high[i] - low[i];
            continue;
          }
          const prevClose = close[i - 1];
          tr[i] = Math.max(
            high[i] - low[i],
            Math.abs(high[i] - prevClose),
            Math.abs(low[i] - prevClose)
          );
          const upMove = high[i] - high[i - 1];
          const downMove = low[i - 1] - low[i];
          plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
          minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
        }

        if (cfg.adxPeriod > 0 && n > cfg.adxPeriod) {
          const dx = new Array(n).fill(null);
          var trSmooth = 0;
          var plusSmooth = 0;
          var minusSmooth = 0;
          for (var seed = 1; seed <= cfg.adxPeriod; seed += 1) {
            trSmooth += tr[seed];
            plusSmooth += plusDm[seed];
            minusSmooth += minusDm[seed];
          }
          for (var a = cfg.adxPeriod; a < n; a += 1) {
            if (a > cfg.adxPeriod) {
              trSmooth = trSmooth - trSmooth / cfg.adxPeriod + tr[a];
              plusSmooth = plusSmooth - plusSmooth / cfg.adxPeriod + plusDm[a];
              minusSmooth = minusSmooth - minusSmooth / cfg.adxPeriod + minusDm[a];
            }
            if (trSmooth <= Number.EPSILON) {
              dx[a] = 0;
              continue;
            }
            const plusDi = plusSmooth / trSmooth * 100;
            const minusDi = minusSmooth / trSmooth * 100;
            const diSum = plusDi + minusDi;
            dx[a] = diSum <= Number.EPSILON ? 0 : Math.abs(plusDi - minusDi) / diSum * 100;
          }
          const firstAdxIndex = cfg.adxPeriod * 2 - 1;
          if (firstAdxIndex < n) {
            var dxSeed = 0;
            var dxCount = 0;
            for (var d = cfg.adxPeriod; d <= firstAdxIndex; d += 1) {
              if (dx[d] != null) {
                dxSeed += dx[d];
                dxCount += 1;
              }
            }
            if (dxCount >= cfg.adxPeriod) {
              adx[firstAdxIndex] = dxSeed / cfg.adxPeriod;
              for (var e = firstAdxIndex + 1; e < n; e += 1) {
                if (adx[e - 1] == null || dx[e] == null) continue;
                adx[e] = ((adx[e - 1] * (cfg.adxPeriod - 1)) + dx[e]) / cfg.adxPeriod;
              }
            }
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

          const adxValue = adx[k];
          const adxAllowed = !cfg.useAdxFilter || (adxValue != null && adxValue >= cfg.adxMin);
          const isBull = close[k] > open[k];
          const isBear = close[k] < open[k];
          const isLongZone = proximity(bb.upper, env.upper) <= cfg.crossTol;
          const isShortZone = proximity(bb.lower, env.lower) <= cfg.crossTol;

          if (adxAllowed && isLongZone && isBull && close[k] > Math.max(bb.upper, env.upper) && k - lastLong >= cfg.minBarGap) {
            signals[k] = 1;
            lastLong = k;
          } else if (adxAllowed && isShortZone && isBear && close[k] < Math.min(bb.lower, env.lower) && k - lastShort >= cfg.minBarGap) {
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
