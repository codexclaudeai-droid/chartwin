import { MARKET_STATE_DETECTOR_FUNCTION_SOURCE } from '../MarketStateDetector';

export const GRID_ATR_BNF_SROUTER_PRESETS = {
  GOLD: {
    gridStep: 5,
    profitTarget: 1.03,
    breakoutLevel: 2000,
    breakdownLevel: 1900,
    atrMultiplierEntry: 1.2,
    atrMultiplierExit: 2.5,
    maFastPeriod: 20,
    maSlowPeriod: 50,
    neutralThreshold: 0.01,
  },
  NASDAQ: {
    gridStep: 50,
    profitTarget: 1.05,
    breakoutLevel: 15000,
    breakdownLevel: 14000,
    atrMultiplierEntry: 1.5,
    atrMultiplierExit: 3,
    maFastPeriod: 10,
    maSlowPeriod: 30,
    neutralThreshold: 0.005,
  },
  BTC: {
    gridStep: 500,
    profitTarget: 1.08,
    breakoutLevel: 65000,
    breakdownLevel: 60000,
    atrMultiplierEntry: 2,
    atrMultiplierExit: 4,
    maFastPeriod: 7,
    maSlowPeriod: 21,
    neutralThreshold: 0.02,
  },
} as const;

export type GridAtrBnfSrouterPresetKey = keyof typeof GRID_ATR_BNF_SROUTER_PRESETS;
export type GridAtrBnfSrouterPresetMode = GridAtrBnfSrouterPresetKey | 'AUTO' | 'CUSTOM';

export function inferGridAtrBnfSrouterPreset(symbol: string): GridAtrBnfSrouterPresetKey {
  const s = String(symbol || '').toUpperCase();
  if (s.indexOf('XAU') >= 0 || s.indexOf('GOLD') >= 0) return 'GOLD';
  if (s.indexOf('NQ') >= 0 || s.indexOf('NAS') >= 0 || s.indexOf('IXIC') >= 0 || s.indexOf('NAS100') >= 0) return 'NASDAQ';
  if (s.indexOf('BTC') >= 0) return 'BTC';
  return 'BTC';
}

export const DEFAULT_GRID_ATR_BNF_SROUTER_PARAMS = {
  presetSymbol: 'AUTO',
  gridStep: GRID_ATR_BNF_SROUTER_PRESETS.BTC.gridStep,
  profitTarget: GRID_ATR_BNF_SROUTER_PRESETS.BTC.profitTarget,
  breakoutLevel: GRID_ATR_BNF_SROUTER_PRESETS.BTC.breakoutLevel,
  breakdownLevel: GRID_ATR_BNF_SROUTER_PRESETS.BTC.breakdownLevel,
  atrMultiplierEntry: GRID_ATR_BNF_SROUTER_PRESETS.BTC.atrMultiplierEntry,
  atrMultiplierExit: GRID_ATR_BNF_SROUTER_PRESETS.BTC.atrMultiplierExit,
  maFastPeriod: GRID_ATR_BNF_SROUTER_PRESETS.BTC.maFastPeriod,
  maSlowPeriod: GRID_ATR_BNF_SROUTER_PRESETS.BTC.maSlowPeriod,
  neutralThreshold: GRID_ATR_BNF_SROUTER_PRESETS.BTC.neutralThreshold,
} as const satisfies { presetSymbol: GridAtrBnfSrouterPresetMode } & Record<string, number | string>;

export const gridAtrBnfSrouterV1 = {
  id: 'strategy_js_grid_atr_bnf_srouter_v1',
  name: 'Grid+ATR+BNF+SRouter v1',
  description: 'Market state router that switches between Grid, breakout-follow, and ATR adaptive entries.',
  language: 'javascript' as const,
  version: 3,
  params: { ...DEFAULT_GRID_ATR_BNF_SROUTER_PARAMS },
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var high = context.high;
      var low = context.low;
      if (!close || !high || !low || index < 30) return 0;
      var detectMarketState = ${MARKET_STATE_DETECTOR_FUNCTION_SOURCE};

      var rawParams = context.__strategyParams || {};
      var presetMap = {
        GOLD: { gridStep: 5, profitTarget: 1.03, breakoutLevel: 2000, breakdownLevel: 1900, atrMultiplierEntry: 1.2, atrMultiplierExit: 2.5, maFastPeriod: 20, maSlowPeriod: 50, neutralThreshold: 0.01 },
        NASDAQ: { gridStep: 50, profitTarget: 1.05, breakoutLevel: 15000, breakdownLevel: 14000, atrMultiplierEntry: 1.5, atrMultiplierExit: 3.0, maFastPeriod: 10, maSlowPeriod: 30, neutralThreshold: 0.005 },
        BTC: { gridStep: 500, profitTarget: 1.08, breakoutLevel: 65000, breakdownLevel: 60000, atrMultiplierEntry: 2.0, atrMultiplierExit: 4.0, maFastPeriod: 7, maSlowPeriod: 21, neutralThreshold: 0.02 }
      };
      var inferPresetKey = ${inferGridAtrBnfSrouterPreset.toString()};
      var presetKey = String(rawParams.presetSymbol || 'AUTO').toUpperCase();
      var resolvedPresetKey = (presetKey === 'AUTO' || presetKey === 'CUSTOM') ? inferPresetKey(context.__symbol) : presetKey;
      if (!presetMap[resolvedPresetKey]) resolvedPresetKey = 'BTC';
      var params = Object.assign({}, presetMap[resolvedPresetKey], rawParams);

      var n = close.length;
      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey = Math.round((close[n - 1] || 0) * 1e4);
      var cacheKey = 'srouter_v1_' + resolvedPresetKey + '_' + JSON.stringify(params) + '_' + n + '_' + firstKey + '_' + lastKey;
      if (!context.__srV1Cache) context.__srV1Cache = {};
      if (context.__srV1Cache[cacheKey]) return context.__srV1Cache[cacheKey][index] || 0;

      var GRID_STEP = Math.max(Number(params.gridStep) || 0, 0.0001);
      var GRID_PROFIT_PCT = Math.max((Number(params.profitTarget) || 1) - 1, 0.0001);
      var GRID_STOP_PCT = 0.10;
      var GRID_MAX_LEVEL = 5;

      var BNF_LOOKBACK = 50;
      var BNF_SL_RATIO = 0.97;
      var STATIC_BREAKOUT_LEVEL = Number(params.breakoutLevel) || 0;
      var STATIC_BREAKDOWN_LEVEL = Number(params.breakdownLevel) || 0;

      var ATR_ENTRY_MULT = Math.max(Number(params.atrMultiplierEntry) || 0, 0.1);
      var ATR_EXIT_MULT = Math.max(Number(params.atrMultiplierExit) || 0, 0.1);
      var ATR_MAX_LEVEL = 5;

      var MA_FAST_PERIOD = Math.max(Math.round(Number(params.maFastPeriod) || 10), 2);
      var MA_SLOW_PERIOD = Math.max(Math.round(Number(params.maSlowPeriod) || 30), MA_FAST_PERIOD + 1);
      var ATR_PERIOD = 14;
      var VOLATILE_ATR_PCT = 0.02;
      var NEUTRAL_DIFF_PCT = Math.max(Number(params.neutralThreshold) || 0, 0.000001);

      var atrArr = new Array(n).fill(0);
      atrArr[0] = high[0] - low[0];
      for (var i = 1; i < n; i++) {
        var tr = Math.max(
          high[i] - low[i],
          Math.abs(high[i] - close[i - 1]),
          Math.abs(low[i] - close[i - 1])
        );
        atrArr[i] = (atrArr[i - 1] * (ATR_PERIOD - 1) + tr) / ATR_PERIOD;
      }

      var maFastArr = new Array(n).fill(null);
      var maSlowArr = new Array(n).fill(null);
      var sumF = 0;
      var sumS = 0;
      for (var i = 0; i < n; i++) {
        sumF += close[i];
        sumS += close[i];
        if (i >= MA_FAST_PERIOD) sumF -= close[i - MA_FAST_PERIOD];
        if (i >= MA_SLOW_PERIOD) sumS -= close[i - MA_SLOW_PERIOD];
        if (i >= MA_FAST_PERIOD - 1) maFastArr[i] = sumF / MA_FAST_PERIOD;
        if (i >= MA_SLOW_PERIOD - 1) maSlowArr[i] = sumS / MA_SLOW_PERIOD;
      }

      var midPrice = close[Math.floor(n / 2)] || 1;
      var pointValue = midPrice >= 10000 ? 1.0
        : midPrice >= 1000 ? 0.1
        : midPrice >= 10 ? 0.01
        : 0.001;
      var baseGridStep = GRID_STEP * pointValue;
      var gridBalance = midPrice * 100;

      var signals = new Array(n).fill(0);
      var gridPos = [];
      var atrPos = [];
      var bnfLong = false;
      var bnfShort = false;
      var bnfEntry = 0;
      var prevState = null;

      for (var i = MA_SLOW_PERIOD; i < n; i++) {
        var price = close[i];
        var curAtr = atrArr[i];
        var mf = maFastArr[i];
        var ms = maSlowArr[i];
        if (mf === null || ms === null) continue;

        var state = detectMarketState(price, curAtr, mf, ms, {
          volatileAtrPct: VOLATILE_ATR_PCT,
          neutralDiffPct: NEUTRAL_DIFF_PCT
        });

        if (state !== prevState) {
          if (state === 'RANGE') {
            atrPos = [];
            bnfLong = false;
            bnfShort = false;
          }
          if (state === 'VOLATILE') {
            gridPos = [];
            bnfLong = false;
            bnfShort = false;
          }
          if (state === 'TREND_UP' || state === 'TREND_DOWN') {
            gridPos = [];
            atrPos = [];
          }
        }
        prevState = state;

        var sig = 0;

        if (state === 'RANGE') {
          var openPnl = 0;
          for (var j = 0; j < gridPos.length; j++) openPnl += price - gridPos[j];
          var equity = gridBalance + openPnl;

          if (gridPos.length > 0 && gridBalance > 0 && (1.0 - equity / gridBalance) >= GRID_STOP_PCT) {
            sig = -1;
            gridBalance = equity;
            gridPos = [];
          } else if (gridPos.length > 0 && openPnl >= gridBalance * GRID_PROFIT_PCT) {
            sig = -1;
            gridBalance += openPnl;
            gridPos = [];
          } else if (gridPos.length < GRID_MAX_LEVEL) {
            var doBuy = gridPos.length === 0;
            if (!doBuy) {
              var minP = gridPos[0];
              for (var k = 1; k < gridPos.length; k++) if (gridPos[k] < minP) minP = gridPos[k];
              doBuy = price <= minP - baseGridStep;
            }
            if (doBuy) {
              gridPos.push(price);
              sig = 1;
            }
          }
        } else if (state === 'TREND_UP' || state === 'TREND_DOWN') {
          var bnfStart = Math.max(0, i - BNF_LOOKBACK);
          var breakoutLevel = -Infinity;
          var breakdownLevel = Infinity;
          for (var k = bnfStart; k < i; k++) {
            if (high[k] > breakoutLevel) breakoutLevel = high[k];
            if (low[k] < breakdownLevel) breakdownLevel = low[k];
          }
          if (STATIC_BREAKOUT_LEVEL > 0) breakoutLevel = Math.max(breakoutLevel, STATIC_BREAKOUT_LEVEL);
          if (STATIC_BREAKDOWN_LEVEL > 0) breakdownLevel = Math.min(breakdownLevel, STATIC_BREAKDOWN_LEVEL);

          if (!bnfLong && !bnfShort) {
            if (price > breakoutLevel) {
              sig = 1;
              bnfLong = true;
              bnfEntry = price;
            } else if (price < breakdownLevel) {
              sig = -1;
              bnfShort = true;
              bnfEntry = price;
            }
          } else if (bnfLong) {
            var stopLossLevel = bnfEntry * BNF_SL_RATIO;
            if (price < breakdownLevel || price < stopLossLevel) {
              sig = -1;
              bnfLong = false;
            }
          } else if (bnfShort) {
            var shortStopLevel = bnfEntry * (2.0 - BNF_SL_RATIO);
            if (price > breakoutLevel || price > shortStopLevel) {
              sig = 1;
              bnfShort = false;
            }
          }
        } else {
          var atrGridStep = curAtr * ATR_ENTRY_MULT;
          var atrTarget = atrGridStep * ATR_EXIT_MULT;
          var atrPnl = 0;
          for (var j = 0; j < atrPos.length; j++) atrPnl += price - atrPos[j];

          if (atrPos.length > 0 && atrPnl >= atrTarget) {
            sig = -1;
            atrPos = [];
          } else if (atrPos.length < ATR_MAX_LEVEL) {
            var doAtr = atrPos.length === 0;
            if (!doAtr) {
              var minA = atrPos[0];
              for (var k = 1; k < atrPos.length; k++) if (atrPos[k] < minA) minA = atrPos[k];
              doAtr = price <= minA - atrGridStep;
            }
            if (doAtr) {
              atrPos.push(price);
              sig = 1;
            }
          }
        }

        signals[i] = sig;
      }

      context.__srV1Cache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
