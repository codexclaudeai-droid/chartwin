import { parsePineProgram } from '../pine-parser';
import { ALL_STRATEGIES } from './strategies';

export type StrategyLang = 'javascript' | 'pine';
export type StrategySignal = -1 | 0 | 1;

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  language: StrategyLang;
  sourceCode: string;
  compiledJs: string;
  obfuscatedJs: string;
  version: number;
  active: boolean;
  updatedAt: number;
}

let _adminMgmtButtonHiddenIds = new Set<string>();
export function setAdminHiddenStrategyButtonIds(ids: string[]): void {
  _adminMgmtButtonHiddenIds = new Set(ids);
}
export function isStrategyManagementVisible(id: string): boolean {
  return !_adminMgmtButtonHiddenIds.has(id);
}

const STRATEGY_STORAGE_KEY = 'my-chart-lib-strategies-v1';

function obfuscateStrategyJs(js: string): string {
  return js
    .replace(/\bcontext\b/g, 'a')
    .replace(/\bindex\b/g, 'b')
    .replace(/\bseries\b/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

function compileSimpleBuySellPineToJs(pine: string): string {
  const program = parsePineProgram(pine);
  const buy = program.statements.find((s) => s.kind === 'BUY');
  const sell = program.statements.find((s) => s.kind === 'SELL');
  if (!buy || !sell) {
    throw new Error('Pine ?꾨왂? BUY/SELL 議곌굔??紐⑤몢 ?꾩슂?⑸땲??');
  }

  const buyLeft = buy.condition.left.period;
  const buyRight = buy.condition.right.period;
  const sellLeft = sell.condition.left.period;
  const sellRight = sell.condition.right.period;

  const buyCrossExpr = buy.condition.op === 'crossover'
    ? 'ta.crossover(fArrBuy, sArrBuy, index)'
    : 'ta.crossunder(fArrBuy, sArrBuy, index)';
  const sellCrossExpr = sell.condition.op === 'crossover'
    ? 'ta.crossover(fArrSell, sArrSell, index)'
    : 'ta.crossunder(fArrSell, sArrSell, index)';

  return `(
    function(context, index, ta) {
      const fArrBuy = context.close.map((_, i) => ta.sma(context.close, ${buyLeft}, i) ?? 0);
      const sArrBuy = context.close.map((_, i) => ta.sma(context.close, ${buyRight}, i) ?? 0);
      if (${buyCrossExpr}) return 1;
      const fArrSell = context.close.map((_, i) => ta.sma(context.close, ${sellLeft}, i) ?? 0);
      const sArrSell = context.close.map((_, i) => ta.sma(context.close, ${sellRight}, i) ?? 0);
      if (${sellCrossExpr}) return -1;
      return 0;
    }
  )`;
}

function compileBollingerDirectedPineToJs(pine: string): string {
  const code = pine.replace(/\r/g, '');
  const sourceMatch = code.match(/\bsource\s*=\s*(close|open|high|low)\b/i);
  const lengthMatch = code.match(/\blength\s*=\s*input\.int\(\s*(\d+)/i);
  const multMatch = code.match(/\bmult\s*=\s*input\.float\(\s*([0-9]*\.?[0-9]+)/i);
  const directionMatch = code.match(/\bdirection\s*=\s*input\.int\(\s*(-?\d+)/i);
  const hasLongCross = /\bta\.crossover\(\s*source\s*,\s*lower\s*\)/i.test(code);
  const hasShortCross = /\bta\.crossunder\(\s*source\s*,\s*upper\s*\)/i.test(code);
  const hasStdev = /\bta\.stdev\(\s*source\s*,\s*length\s*\)/i.test(code);
  if (!hasLongCross || !hasShortCross || !hasStdev) {
    throw new Error('吏?먮릺吏 ?딅뒗 Pine ?꾨왂 ?⑦꽩?낅땲?? ?꾩옱??BUY/SELL 援먯감???먮뒗 Bollinger directed ?⑦꽩留?吏?먰빀?덈떎.');
  }

  const sourceSeries = (sourceMatch?.[1]?.toLowerCase() ?? 'close') as 'close' | 'open' | 'high' | 'low';
  const length = Math.max(1, Number(lengthMatch?.[1] ?? 20));
  const mult = Math.max(0.001, Number(multMatch?.[1] ?? 2));
  const direction = Math.max(-1, Math.min(1, Number(directionMatch?.[1] ?? 0)));

  return `(
    function(context, index) {
      const source = context.${sourceSeries};
      const open = context.open;
      const high = context.high;
      const low = context.low;
      const close = context.close;
      const period = ${length};
      const mult = ${mult};
      const direction = ${direction};
      if (!Array.isArray(source) || !Array.isArray(open) || !Array.isArray(high) || !Array.isArray(low) || !Array.isArray(close)) return 0;
      if (index <= 0 || index >= source.length) return 0;

      const cacheKey = 'bb_directed_ext_' + period + '_' + mult + '_' + direction + '_${sourceSeries}';
      if (!context.__bbDirectedExtCache) context.__bbDirectedExtCache = {};
      const cached = context.__bbDirectedExtCache[cacheKey];
      const lastStamp = source.length > 0 ? source[source.length - 1] : NaN;
      if (cached && cached.length === source.length && cached.lastStamp === lastStamp) {
        return cached.signals[index] || 0;
      }

      const smaAt = (values, p, i) => {
        if (p <= 0 || i < p - 1) return null;
        let sum = 0;
        for (let j = i - p + 1; j <= i; j += 1) sum += values[j];
        return sum / p;
      };
      const stdevAt = (i) => {
        const mean = smaAt(source, period, i);
        if (mean == null) return null;
        let acc = 0;
        for (let j = i - period + 1; j <= i; j += 1) {
          const d = source[j] - mean;
          acc += d * d;
        }
        return Math.sqrt(acc / period);
      };

      const signals = new Array(source.length).fill(0);
      let trackedShort = null;
      const MA_TOL = 0.0015;
      const MA_TOUCH_TOL = 0.0008;
      const LOWER_OVERSHOOT_ALLOW = 0.012;
      const SHARP_DROP_PCT = 0.018;
      const WIDE_DIVERGENCE_THRESHOLD = 0.038;
      let longPendingTrend = false;
      let longHoldActive = false;
      let convergenceWindow = 0;
      let shortAnchorPrice = null;
      let waitLowerBandRebound = false;
      let waitLowerBandBars = 0;
      let bullBurstCount = 0;
      let bearStreak = 0;
      let convergenceSeedBars = 0;
      let reconvergeBars = 0;
      let longEntryLockByBearCrash = false;

      const bodyInfo = (i) => {
        const o = open[i];
        const c = close[i];
        const h = high[i];
        const l = low[i];
        const body = Math.abs(c - o);
        const range = Math.max(h - l, Number.EPSILON);
        const upperWick = h - Math.max(o, c);
        const lowerWick = Math.min(o, c) - l;
        return { o, c, h, l, body, range, upperWick, lowerWick };
      };

      const isDojiLike = (i) => {
        const s = bodyInfo(i);
        return s.body / s.range <= 0.14;
      };

      const isHammerLike = (i) => {
        const s = bodyInfo(i);
        const bullish = s.c >= s.o;
        return bullish && s.lowerWick >= s.body * 1.8 && s.upperWick <= s.body * 1.2;
      };

      const isBullishHarami = (i) => {
        if (i <= 0) return false;
        const p = bodyInfo(i - 1);
        const n = bodyInfo(i);
        const prevBear = p.c < p.o;
        const nowBull = n.c > n.o;
        if (!prevBear || !nowBull) return false;
        const prevLo = Math.min(p.o, p.c);
        const prevHi = Math.max(p.o, p.c);
        const nowLo = Math.min(n.o, n.c);
        const nowHi = Math.max(n.o, n.c);
        return nowLo >= prevLo && nowHi <= prevHi;
      };

      const isBullishEngulfing = (i) => {
        if (i <= 0) return false;
        const p = bodyInfo(i - 1);
        const n = bodyInfo(i);
        const prevBear = p.c < p.o;
        const nowBull = n.c > n.o;
        if (!prevBear || !nowBull) return false;
        const prevLo = Math.min(p.o, p.c);
        const prevHi = Math.max(p.o, p.c);
        const nowLo = Math.min(n.o, n.c);
        const nowHi = Math.max(n.o, n.c);
        return nowLo <= prevLo && nowHi >= prevHi;
      };

      const isMeaningfulBullish = (i) => {
        if (i <= 0) return false;
        const s = bodyInfo(i);
        const bullishBody = s.c > s.o && s.body / s.range >= 0.35;
        return bullishBody || isDojiLike(i) || isHammerLike(i) || isBullishHarami(i) || isBullishEngulfing(i);
      };

      const recentMeaningfulBullCount = (i, lookback) => {
        let count = 0;
        const start = Math.max(1, i - lookback + 1);
        for (let k = start; k <= i; k += 1) {
          if (isMeaningfulBullish(k)) count += 1;
        }
        return count;
      };

      const isThreeWhiteSoldiersEnd = (i) => {
        if (i < 2) return false;
        const a = bodyInfo(i - 2);
        const b = bodyInfo(i - 1);
        const c3 = bodyInfo(i);
        const bullishA = a.c > a.o && a.body / a.range >= 0.45;
        const bullishB = b.c > b.o && b.body / b.range >= 0.45;
        const bullishC = c3.c > c3.o && c3.body / c3.range >= 0.45;
        if (!bullishA || !bullishB || !bullishC) return false;
        const stepUpClose = a.c < b.c && b.c < c3.c;
        const openInsidePrevA = b.o >= Math.min(a.o, a.c) && b.o <= Math.max(a.o, a.c);
        const openInsidePrevB = c3.o >= Math.min(b.o, b.c) && c3.o <= Math.max(b.o, b.c);
        const smallUpperWicks = a.upperWick <= a.body * 0.6 && b.upperWick <= b.body * 0.6 && c3.upperWick <= c3.body * 0.6;
        return stepUpClose && openInsidePrevA && openInsidePrevB && smallUpperWicks;
      };

      const isNearThreeWhiteSoldiers = (i) => {
        for (let k = Math.max(2, i - 2); k <= i; k += 1) {
          if (isThreeWhiteSoldiersEnd(k)) return true;
        }
        return false;
      };

      for (let i = 1; i < source.length; i += 1) {
        const basisNow = smaAt(source, period, i);
        const basisPrev = smaAt(source, period, i - 1);
        const stdNow = stdevAt(i);
        const stdPrev = stdevAt(i - 1);
        if (basisNow == null || basisPrev == null || stdNow == null || stdPrev == null) continue;

        const lowerNow = basisNow - mult * stdNow;
        const lowerPrev = basisPrev - mult * stdPrev;
        const upperNow = basisNow + mult * stdNow;
        const upperPrev = basisPrev + mult * stdPrev;

        const srcNow = source[i];
        const srcPrev = source[i - 1];
        const longSignalBase = srcPrev <= lowerPrev && srcNow > lowerNow;
        const shortSignalBase = srcPrev >= upperPrev && srcNow < upperNow;

        const ma5 = smaAt(close, 5, i);
        const ma20 = smaAt(close, 20, i);
        const ma60 = smaAt(close, 60, i);
        const ma120 = smaAt(close, 120, i);
        const ma200 = smaAt(close, 200, i);
        const ma5Prev = smaAt(close, 5, i - 1);
        const ma5Prev2 = smaAt(close, 5, i - 2);
        const ma20Prev = smaAt(close, 20, i - 1);
        const ma60Prev = smaAt(close, 60, i - 1);
        const ma120Prev = smaAt(close, 120, i - 1);
        const longTermUp = ma20 != null && ma60 != null && ma120 != null && ma200 != null
          && ma20 > ma60 && ma60 > ma120 && ma120 > ma200;
        const upMaintained = ma20 != null && ma60 != null && ma120 != null
          && ma20 > ma60 && ma60 > ma120;
        const bearAligned = ma20 != null && ma60 != null && ma120 != null
          && ma20 < ma60 && ma60 < ma120;
        const spreadNowA = ma20 != null && ma60 != null ? Math.abs(ma20 - ma60) : 0;
        const spreadPrevA = ma20Prev != null && ma60Prev != null ? Math.abs(ma20Prev - ma60Prev) : 0;
        const spreadNowB = ma60 != null && ma120 != null ? Math.abs(ma60 - ma120) : 0;
        const spreadPrevB = ma60Prev != null && ma120Prev != null ? Math.abs(ma60Prev - ma120Prev) : 0;
        const spreadWidening = spreadNowA > spreadPrevA && spreadNowB > spreadPrevB;
        const dropPct = close[i - 1] !== 0 ? (close[i - 1] - close[i]) / Math.abs(close[i - 1]) : 0;
        const sharpDrop = dropPct >= SHARP_DROP_PCT;
        const fullUpAligned = ma5 != null && ma20 != null && ma60 != null && ma120 != null
          && ma5 >= ma20 * (1 - MA_TOUCH_TOL)
          && ma20 > ma60 && ma60 > ma120;
        const deadCross = ma5 != null && ma20 != null && ma5Prev != null && ma20Prev != null
          && ma5Prev >= ma20Prev && ma5 < ma20;
        const crossUp520 = ma5 != null && ma20 != null && ma5Prev != null && ma20Prev != null
          && ma5Prev <= ma20Prev && ma5 > ma20;
        const ma5TurnUp = ma5 != null && ma5Prev != null && ma5Prev2 != null
          && ma5 > ma5Prev && ma5Prev <= ma5Prev2;
        const totalDivergence = ma5 != null && ma20 != null && ma60 != null && ma120 != null
          ? (Math.abs(ma5 - ma20) + Math.abs(ma20 - ma60) + Math.abs(ma60 - ma120))
            / Math.max(Math.abs(ma120), Number.EPSILON)
          : 0;
        const totalDivergencePrev = ma5Prev != null && ma20Prev != null && ma60Prev != null && ma120Prev != null
          ? (Math.abs(ma5Prev - ma20Prev) + Math.abs(ma20Prev - ma60Prev) + Math.abs(ma60Prev - ma120Prev))
            / Math.max(Math.abs(ma120Prev), Number.EPSILON)
          : 0;
        const divergenceWide = totalDivergence >= WIDE_DIVERGENCE_THRESHOLD && totalDivergence >= totalDivergencePrev;
        const spreadPctFastMid = ma5 != null && ma20 != null ? Math.abs(ma5 - ma20) / Math.max(Math.abs(ma20), Number.EPSILON) : 0;
        const spreadPctMidSlow = ma60 != null ? Math.abs(ma20 - ma60) / Math.max(Math.abs(ma60), Number.EPSILON) : 0;
        const isConverged52060 = spreadPctFastMid <= 0.0045 && spreadPctMidSlow <= 0.0065;
        if (isConverged52060) {
          convergenceWindow = 10;
          convergenceSeedBars = 24;
          reconvergeBars += 1;
        } else {
          if (convergenceWindow > 0) convergenceWindow -= 1;
          if (convergenceSeedBars > 0) convergenceSeedBars -= 1;
          reconvergeBars = 0;
        }

        const bearCrashTrigger = !longEntryLockByBearCrash
          && convergenceSeedBars > 0
          && bearAligned
          && (spreadWidening || divergenceWide)
          && sharpDrop;
        if (bearCrashTrigger) {
          longEntryLockByBearCrash = true;
          longPendingTrend = false;
          longHoldActive = false;
          shortAnchorPrice = null;
          waitLowerBandRebound = false;
          waitLowerBandBars = 0;
        }
        if (longEntryLockByBearCrash && reconvergeBars >= 2) {
          longEntryLockByBearCrash = false;
        }
        if (longHoldActive && !fullUpAligned) longHoldActive = false;
        if (longPendingTrend && ma20 != null && ma60 != null && ma20 < ma60) longPendingTrend = false;

        if (waitLowerBandRebound) {
          waitLowerBandBars += 1;
          if (waitLowerBandBars > 18) {
            waitLowerBandRebound = false;
            waitLowerBandBars = 0;
          }
        }

        if (shortSignalBase && longTermUp) {
          trackedShort = {
            mode: 'normal',
            middleBreakSeen: false,
            supportSeen: false,
            turnSeen: false,
            startIndex: i,
          };
        }

        let reversalLong = false;
        if (trackedShort) {
          if (i - trackedShort.startIndex > 90) {
            trackedShort = null;
          } else {
            if (bearAligned && (spreadWidening || sharpDrop)) trackedShort.mode = 'bear_drop';
            if (!upMaintained && !bearAligned) {
              trackedShort = null;
              continue;
            }

            if (close[i] < basisNow) trackedShort.middleBreakSeen = true;
            if (trackedShort.middleBreakSeen && ma60 != null) {
              const bodyLo = Math.min(open[i], close[i]);
              const bodyHi = Math.max(open[i], close[i]);
              const bodyTouch = bodyLo <= ma60 && bodyHi >= ma60;
              const wickTouch = low[i] <= ma60 * (1 + MA_TOL) && high[i] >= ma60 * (1 - MA_TOL);
              if (bodyTouch || wickTouch) trackedShort.supportSeen = true;
            }

            if (trackedShort.supportSeen && ma5 != null && ma20 != null && ma5Prev != null && ma20Prev != null) {
              const prevDist = Math.abs(ma5Prev - ma20Prev);
              const nowDist = Math.abs(ma5 - ma20);
              const turningTo20 = ma5 > ma5Prev && nowDist < prevDist && (ma5Prev2 == null || ma5Prev >= ma5Prev2);
              if (turningTo20) trackedShort.turnSeen = true;
            }

            const bullish = close[i] > open[i];
            const lowerOvershootOk = low[i] >= lowerNow * (1 - LOWER_OVERSHOOT_ALLOW);
            const declineStopped = close[i] >= close[i - 1] && low[i] >= low[i - 1] * (1 - MA_TOL);
            const meaningfulBull2Plus = recentMeaningfulBullCount(i, 4) >= 2;

            if (trackedShort.mode === 'bear_drop') {
              if (trackedShort.turnSeen && declineStopped && lowerOvershootOk && meaningfulBull2Plus) {
                reversalLong = true;
                trackedShort = null;
              }
            } else if (trackedShort.turnSeen && bullish) {
              reversalLong = true;
              trackedShort = null;
            }
          }
        }

        const prevBearStreak = bearStreak;
        if (close[i] < open[i]) bearStreak += 1;
        else bearStreak = 0;

        const meaningfulBull = isMeaningfulBullish(i);
        const meaningfulBullClose = close[i] > open[i] || meaningfulBull;
        const holdAbove20 = ma20 != null && low[i] >= ma20 * (1 - MA_TOL);
        const crossUpLong = crossUp520 && (convergenceWindow > 0 || upMaintained);
        const pullbackReLong = upMaintained && holdAbove20 && prevBearStreak >= 2 && meaningfulBullClose;
        const largeBull = close[i] > open[i] && bodyInfo(i).body / bodyInfo(i).range >= 0.62
          && close[i] >= upperNow * (1 - 0.002);
        let blowoffShort = false;
        if (largeBull) {
          bullBurstCount += 1;
        } else if (close[i] < open[i]) {
          if (bullBurstCount >= 2) blowoffShort = true;
          bullBurstCount = 0;
        } else {
          bullBurstCount = 0;
        }

        if (deadCross && low[i] <= lowerNow * (1 + MA_TOL)) {
          waitLowerBandRebound = true;
          waitLowerBandBars = 0;
        }
        const reboundLongFromLower = waitLowerBandRebound && ma5TurnUp && meaningfulBullClose && longTermUp;
        if (reboundLongFromLower) {
          waitLowerBandRebound = false;
          waitLowerBandBars = 0;
        }

        const reLongAtAnchor = shortAnchorPrice != null
          && close[i] >= shortAnchorPrice
          && upMaintained
          && (meaningfulBullClose || ma5TurnUp);
        if (reLongAtAnchor) shortAnchorPrice = null;

        const longSignalRaw = longSignalBase || reversalLong || crossUpLong || pullbackReLong || reboundLongFromLower || reLongAtAnchor;
        const blockLongByThreeSoldiers = longSignalRaw && isNearThreeWhiteSoldiers(i);
        const longSignal = longSignalRaw && !blockLongByThreeSoldiers && !longEntryLockByBearCrash;
        if (longSignal) {
          longPendingTrend = true;
          if (fullUpAligned) longHoldActive = true;
        } else if (longPendingTrend && fullUpAligned) {
          longHoldActive = true;
        }

        const forceExitByDeadCross = (longHoldActive || fullUpAligned || longPendingTrend) && deadCross && divergenceWide;
        const shortBlockedInUptrend = (longHoldActive || fullUpAligned || longPendingTrend) && !forceExitByDeadCross;
        const shortSignal = forceExitByDeadCross || blowoffShort || (shortSignalBase && !shortBlockedInUptrend);

        if (shortSignal) {
          longPendingTrend = false;
          longHoldActive = false;
          if (blowoffShort) shortAnchorPrice = close[i];
        }

        let sig = 0;
        if (direction > 0) {
          sig = longSignal ? 1 : 0;
        } else if (direction < 0) {
          sig = shortSignal ? -1 : 0;
        } else if (longSignal) {
          sig = 1;
        } else if (shortSignal) {
          sig = -1;
        }
        signals[i] = sig;
      }

      context.__bbDirectedExtCache[cacheKey] = {
        signals,
        length: source.length,
        lastStamp,
      };
      return signals[index] || 0;
    }
  )`;
}

function compileSupertrendDirectedPineToJs(pine: string): string {
  const code = pine.replace(/\r/g, '');
  const hasSupertrend = /\bta\.supertrend\(\s*factor\s*,\s*atrPeriod\s*\)/i.test(code)
    || /\bta\.supertrend\(/i.test(code);
  const hasDirectionChangeLong = /\bta\.change\(\s*direction\s*\)\s*<\s*0/i.test(code);
  const hasDirectionChangeShort = /\bta\.change\(\s*direction\s*\)\s*>\s*0/i.test(code);
  if (!hasSupertrend || !hasDirectionChangeLong || !hasDirectionChangeShort) {
    throw new Error('吏?먮릺吏 ?딅뒗 Pine ?꾨왂 ?⑦꽩?낅땲?? ?꾩옱??BUY/SELL 援먯감?? Bollinger directed, Supertrend directed ?⑦꽩留?吏?먰빀?덈떎.');
  }

  const atrPeriodMatch =
    code.match(/\batrPeriod\s*=\s*input(?:\.int)?\(\s*(\d+)/i)
    ?? code.match(/\batrPeriod\s*=\s*(\d+)/i);
  const factorMatch =
    code.match(/\bfactor\s*=\s*input\.float\(\s*([0-9]*\.?[0-9]+)/i)
    ?? code.match(/\bfactor\s*=\s*([0-9]*\.?[0-9]+)/i);

  const atrPeriod = Math.max(1, Number(atrPeriodMatch?.[1] ?? 10));
  const factor = Math.max(0.01, Number(factorMatch?.[1] ?? 3));

  return `(
    function(context, index) {
      const high = context.high;
      const low = context.low;
      const close = context.close;
      if (!high || !low || !close || index <= 0 || index >= close.length) return 0;

      const period = ${atrPeriod};
      const factor = ${factor};
      const cacheKey = 'supertrend_' + period + '_' + factor;
      if (!context.__stCache) context.__stCache = {};

      let direction = context.__stCache[cacheKey];
      if (!direction || direction.length !== close.length) {
        const n = close.length;
        const tr = new Array(n).fill(0);
        const atr = new Array(n).fill(0);
        const finalUpper = new Array(n).fill(0);
        const finalLower = new Array(n).fill(0);
        direction = new Array(n).fill(1);

        for (let i = 0; i < n; i += 1) {
          if (i === 0) {
            tr[i] = high[i] - low[i];
            atr[i] = tr[i];
          } else {
            const hl = high[i] - low[i];
            const hc = Math.abs(high[i] - close[i - 1]);
            const lc = Math.abs(low[i] - close[i - 1]);
            tr[i] = Math.max(hl, hc, lc);
            atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
          }

          const hl2 = (high[i] + low[i]) / 2;
          const upperBasic = hl2 + factor * atr[i];
          const lowerBasic = hl2 - factor * atr[i];

          if (i === 0) {
            finalUpper[i] = upperBasic;
            finalLower[i] = lowerBasic;
            direction[i] = 1;
            continue;
          }

          finalUpper[i] = (upperBasic < finalUpper[i - 1] || close[i - 1] > finalUpper[i - 1])
            ? upperBasic
            : finalUpper[i - 1];
          finalLower[i] = (lowerBasic > finalLower[i - 1] || close[i - 1] < finalLower[i - 1])
            ? lowerBasic
            : finalLower[i - 1];

          if (close[i] > finalUpper[i - 1]) {
            direction[i] = -1;
          } else if (close[i] < finalLower[i - 1]) {
            direction[i] = 1;
          } else {
            direction[i] = direction[i - 1];
          }
        }

        context.__stCache[cacheKey] = direction;
      }

      const change = direction[index] - direction[index - 1];
      if (change < 0) return 1;
      if (change > 0) return -1;
      return 0;
    }
  )`;
}

function compilePineToJs(pine: string): string {
  try {
    return compileSimpleBuySellPineToJs(pine);
  } catch {
    try {
      return compileBollingerDirectedPineToJs(pine);
    } catch {
      return compileSupertrendDirectedPineToJs(pine);
    }
  }
}

export function buildStrategyDefinition(input: {
  name: string;
  description: string;
  language: StrategyLang;
  sourceCode: string;
  active?: boolean;
  id?: string;
  version?: number;
}): StrategyDefinition {
  const compiledJs = input.language === 'pine' ? compilePineToJs(input.sourceCode) : input.sourceCode;
  try {
    new Function(`return (${compiledJs});`)();
  } catch (error) {
    throw new Error(`?꾨왂 JS 寃利??ㅽ뙣: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    id: input.id ?? `strategy_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    language: input.language,
    sourceCode: input.sourceCode,
    compiledJs,
    obfuscatedJs: obfuscateStrategyJs(compiledJs),
    version: input.version ?? 1,
    active: input.active ?? true,
    updatedAt: Date.now(),
  };
}

function defaultStrategies(): StrategyDefinition[] {
  return ALL_STRATEGIES.map((src) => buildStrategyDefinition({ ...src, active: true }));
}


export function loadStrategies(): StrategyDefinition[] {
  const defaults = defaultStrategies();
  const defaultById = new Map(defaults.map((item) => [item.id, item]));
  const mergeDefaults = (stored: StrategyDefinition[]) => {
    const upgraded = stored.map((saved) => {
      const def = defaultById.get(saved.id);
      if (!def) return saved;
      if (
        (saved.id === 'strategy_pine_bbands_directed' || saved.id === 'strategy_pine_sma_5_20')
        && (saved.version ?? 0) < def.version
      ) {
        return {
          ...def,
          active: saved.active,
        };
      }
      return saved;
    });
    const ids = new Set(upgraded.map((s) => s.id));
    const missing = defaults.filter((d) => !ids.has(d.id));
    return [...upgraded, ...missing];
  };
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StrategyDefinition[];
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    return mergeDefaults(parsed);
  } catch {
    return defaults;
  }
}

export function saveStrategies(strategies: StrategyDefinition[]): void {
  localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(strategies));
}

