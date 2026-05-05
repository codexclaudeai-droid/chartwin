export const gridAtrBnfSrouterV1 = {
  id: 'strategy_js_grid_atr_bnf_srouter_v1',
  name: 'Grid+ATR+BNF+SRouter v1',
  description: '시장 상태(RANGE/TREND/VOLATILE)를 자동 감지해 Grid·BNF·ATR 전략을 라우팅. BNF breakoutLevel·breakdownLevel은 롤링 고가/저가로 동적 산출.',
  language: 'javascript' as const,
  version: 1,
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      var high  = context.high;
      var low   = context.low;
      if (!close || !high || !low || index < 30) return 0;

      var n = close.length;
      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey  = Math.round((close[n - 1] || 0) * 1e4);
      var cacheKey = 'srouter_v1_' + n + '_' + firstKey + '_' + lastKey;
      if (!context.__srV1Cache) context.__srV1Cache = {};
      if (context.__srV1Cache[cacheKey]) return context.__srV1Cache[cacheKey][index] || 0;

      // ══ USER-ADJUSTABLE PARAMETERS ══════════════════════════════════

      // [1] Grid Strategy
      var GRID_STEP        = 300;   // 격자 간격 (포인트 단위, 가격대별 자동 스케일)
      var GRID_PROFIT_PCT  = 0.05;  // 청산 기준 수익률 (0.05 = 5%, 잔고 대비)
      var GRID_STOP_PCT    = 0.10;  // 손절 기준 손실률 (0.10 = 10%, 에쿼티 기준)
      var GRID_MAX_LEVEL   = 5;     // 최대 동시 포지션 수

      // [2] BNF Strategy
      // breakoutLevel  = BNF_LOOKBACK 봉 롤링 최고가 (자동 계산, 매수 기준)
      // breakdownLevel = BNF_LOOKBACK 봉 롤링 최저가 (자동 계산, 매도 기준)
      var BNF_LOOKBACK     = 50;    // 동적 레벨 산출 기간 (봉 수)
      var BNF_SL_RATIO     = 0.97;  // 손절 비율 (예: 0.97 = 진입가 대비 3% 손실 시 청산)

      // [3] ATR Strategy
      var ATR_ENTRY_MULT   = 1.5;   // ATR 진입 배수 (격자 간격 = ATR × 배수)
      var ATR_EXIT_MULT    = 3.0;   // ATR 청산 배수 (목표 수익 = 격자 × 배수)
      var ATR_MAX_LEVEL    = 5;     // 최대 동시 포지션 수

      // [4] StrategyRouter — Market State Detection
      var MA_FAST_PERIOD   = 10;    // 단기 이동평균 기간
      var MA_SLOW_PERIOD   = 30;    // 장기 이동평균 기간
      var ATR_PERIOD       = 14;    // ATR 계산 기간
      var VOLATILE_ATR_PCT = 0.02;  // 변동성 판별 기준 (ATR/가격 > 이값 → VOLATILE)
      var NEUTRAL_DIFF_PCT = 0.01;  // MA 차이 기준 (|maFast-maSlow|/가격 < 이값 → RANGE)

      // ════════════════════════════════════════════════════════════════

      // ── ATR (Wilder's RMA) ────────────────────────────────────────
      var atrArr = new Array(n).fill(0);
      atrArr[0] = high[0] - low[0];
      for (var i = 1; i < n; i++) {
        var tr = Math.max(
          high[i] - low[i],
          Math.abs(high[i] - close[i - 1]),
          Math.abs(low[i]  - close[i - 1])
        );
        atrArr[i] = (atrArr[i - 1] * (ATR_PERIOD - 1) + tr) / ATR_PERIOD;
      }

      // ── SMA Fast / Slow ───────────────────────────────────────────
      var maFastArr = new Array(n).fill(null);
      var maSlowArr = new Array(n).fill(null);
      var sumF = 0, sumS = 0;
      for (var i = 0; i < n; i++) {
        sumF += close[i]; sumS += close[i];
        if (i >= MA_FAST_PERIOD) sumF -= close[i - MA_FAST_PERIOD];
        if (i >= MA_SLOW_PERIOD) sumS -= close[i - MA_SLOW_PERIOD];
        if (i >= MA_FAST_PERIOD - 1) maFastArr[i] = sumF / MA_FAST_PERIOD;
        if (i >= MA_SLOW_PERIOD - 1) maSlowArr[i] = sumS / MA_SLOW_PERIOD;
      }

      // ── Grid step: auto-scale to price tier ───────────────────────
      var midPrice   = close[Math.floor(n / 2)] || 1;
      var pointValue = midPrice >= 10000 ? 1.0
                     : midPrice >= 1000  ? 0.1
                     : midPrice >= 10    ? 0.01
                     :                    0.001;
      var baseGridStep = GRID_STEP * pointValue;
      var gridBalance  = midPrice * 100;

      // ── State ─────────────────────────────────────────────────────
      var signals    = new Array(n).fill(0);
      var gridPos    = [];    // range grid entries
      var atrPos     = [];    // volatile ATR grid entries
      var bnfLong    = false; // BNF long active
      var bnfShort   = false; // BNF short active
      var bnfEntry   = 0;     // BNF entry price (for stop loss)
      var prevState  = null;

      for (var i = MA_SLOW_PERIOD; i < n; i++) {
        var price     = close[i];
        var curAtr    = atrArr[i];
        var mf        = maFastArr[i];
        var ms        = maSlowArr[i];
        if (mf === null || ms === null) continue;

        // ── Market State Detection (StrategyRouter) ───────────────
        var maDiff = Math.abs(mf - ms) / Math.max(Math.abs(price), 1e-10);
        var state;
        if (curAtr > price * VOLATILE_ATR_PCT) {
          state = 'VOLATILE';
        } else if (maDiff >= NEUTRAL_DIFF_PCT && mf > ms) {
          state = 'TREND_UP';
        } else if (maDiff >= NEUTRAL_DIFF_PCT && mf < ms) {
          state = 'TREND_DOWN';
        } else {
          state = 'RANGE';
        }

        // Clear cross-state positions on state transition
        if (state !== prevState) {
          if (state === 'RANGE')    { atrPos = []; bnfLong = false; bnfShort = false; }
          if (state === 'VOLATILE') { gridPos = []; bnfLong = false; bnfShort = false; }
          if (state === 'TREND_UP' || state === 'TREND_DOWN') { gridPos = []; atrPos = []; }
        }
        prevState = state;

        var sig = 0;

        if (state === 'RANGE') {
          // ── [1] Grid Strategy ─────────────────────────────────────
          var openPnl = 0;
          for (var j = 0; j < gridPos.length; j++) openPnl += price - gridPos[j];
          var equity = gridBalance + openPnl;

          // Equity stop loss
          if (gridPos.length > 0 && gridBalance > 0
              && (1.0 - equity / gridBalance) >= GRID_STOP_PCT) {
            sig = -1; gridBalance = equity; gridPos = [];
          }
          // Profit target
          else if (gridPos.length > 0 && openPnl >= gridBalance * GRID_PROFIT_PCT) {
            sig = -1; gridBalance += openPnl; gridPos = [];
          }
          // Grid entry
          else if (gridPos.length < GRID_MAX_LEVEL) {
            var doBuy = gridPos.length === 0;
            if (!doBuy) {
              var minP = gridPos[0];
              for (var k = 1; k < gridPos.length; k++) if (gridPos[k] < minP) minP = gridPos[k];
              doBuy = price <= minP - baseGridStep;
            }
            if (doBuy) { gridPos.push(price); sig = 1; }
          }

        } else if (state === 'TREND_UP' || state === 'TREND_DOWN') {
          // ── [2] BNF Strategy — dynamic breakoutLevel / breakdownLevel ──
          //
          // breakoutLevel  = BNF_LOOKBACK 봉 롤링 최고가 (이전 봉 기준, 매수 저항선)
          // breakdownLevel = BNF_LOOKBACK 봉 롤링 최저가 (이전 봉 기준, 매도 지지선)
          // stopLossLevel  = 진입가 × BNF_SL_RATIO  (동적 손절가)
          //
          var bnfStart      = Math.max(0, i - BNF_LOOKBACK);
          var breakoutLevel  = -Infinity;
          var breakdownLevel =  Infinity;
          for (var k = bnfStart; k < i; k++) { // 현재봉 제외
            if (high[k] > breakoutLevel)  breakoutLevel  = high[k];
            if (low[k]  < breakdownLevel) breakdownLevel = low[k];
          }

          if (!bnfLong && !bnfShort) {
            if (price > breakoutLevel) {
              sig = 1; bnfLong = true; bnfEntry = price;
            } else if (price < breakdownLevel) {
              sig = -1; bnfShort = true; bnfEntry = price;
            }
          } else if (bnfLong) {
            // 롱 청산: 롤링 저가 하향 돌파 OR 손절 (진입가 × BNF_SL_RATIO)
            var stopLossLevel = bnfEntry * BNF_SL_RATIO;
            if (price < breakdownLevel || price < stopLossLevel) {
              sig = -1; bnfLong = false;
            }
          } else if (bnfShort) {
            // 숏 청산: 롤링 고가 상향 돌파 OR 손절 (진입가 × (2 - BNF_SL_RATIO))
            var shortStopLevel = bnfEntry * (2.0 - BNF_SL_RATIO);
            if (price > breakoutLevel || price > shortStopLevel) {
              sig = 1; bnfShort = false;
            }
          }

        } else {
          // ── [3] ATR Dynamic Grid Strategy ─────────────────────────
          var atrGridStep = curAtr * ATR_ENTRY_MULT;
          var atrTarget   = atrGridStep * ATR_EXIT_MULT;
          var atrPnl = 0;
          for (var j = 0; j < atrPos.length; j++) atrPnl += price - atrPos[j];

          if (atrPos.length > 0 && atrPnl >= atrTarget) {
            sig = -1; atrPos = [];
          } else if (atrPos.length < ATR_MAX_LEVEL) {
            var doAtr = atrPos.length === 0;
            if (!doAtr) {
              var minA = atrPos[0];
              for (var k = 1; k < atrPos.length; k++) if (atrPos[k] < minA) minA = atrPos[k];
              doAtr = price <= minA - atrGridStep;
            }
            if (doAtr) { atrPos.push(price); sig = 1; }
          }
        }

        signals[i] = sig;
      }

      context.__srV1Cache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
