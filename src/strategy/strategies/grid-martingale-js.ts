export const gridMartingaleJs = {
  id: 'strategy_js_grid_martingale',
  name: 'Grid Martingale Scalping',
  description: '그리드 마틴게일 스캘핑 — 그리드 간격마다 매수 추가, 목표 수익/에쿼티 손절 자동 청산',
  language: 'javascript' as const,
  version: 1,
  sourceCode: `(
    function(context, index) {
      var close = context.close;
      if (!close || index < 1) return 0;

      var firstKey = Math.round((close[0] || 0) * 1e4);
      var lastKey  = Math.round((close[close.length - 1] || 0) * 1e4);
      var cacheKey = 'gm_' + close.length + '_' + firstKey + '_' + lastKey;

      if (!context.__gmCache) context.__gmCache = {};
      if (context.__gmCache[cacheKey]) return context.__gmCache[cacheKey][index] || 0;

      // === 설정값 ===
      var GRID_STEP       = 300;   // 그리드 간격 (Point 단위)
      var MAX_LEVEL       = 10;    // 최대 포지션 수
      var EQUITY_STOP_PCT = 20.0;  // 에쿼티 보호 손절 (%)

      // 가격대별 포인트 단위 자동 감지
      var midPrice   = close[Math.floor(close.length / 2)] || 1;
      var pointValue = midPrice >= 10000 ? 1.0
                     : midPrice >= 1000  ? 0.1
                     : midPrice >= 10    ? 0.01
                     :                    0.0001;
      var gridStep     = GRID_STEP * pointValue;
      var targetProfit = gridStep * 5; // 목표 수익 = 그리드 5칸 상당

      var n        = close.length;
      var signals  = new Array(n).fill(0);
      var positions = []; // 진입가 배열 (숫자)
      var balance  = midPrice * 100;

      for (var i = 1; i < n; i++) {
        var price   = close[i];
        var openPnl = 0;
        for (var j = 0; j < positions.length; j++) openPnl += price - positions[j];
        var equity = balance + openPnl;

        // STOP_OUT: 에쿼티가 잔고 대비 EQUITY_STOP_PCT% 이상 손실
        if (balance > 0 && (1.0 - equity / balance) * 100.0 >= EQUITY_STOP_PCT && positions.length > 0) {
          signals[i] = -1;
          balance    = equity;
          positions  = [];
          continue;
        }

        // CLOSE_ALL: 목표 수익 달성
        if (openPnl >= targetProfit && positions.length > 0) {
          signals[i] = -1;
          balance   += openPnl;
          positions  = [];
          continue;
        }

        // BUY 그리드 진입
        if (positions.length < MAX_LEVEL) {
          var doBuy = positions.length === 0;
          if (!doBuy) {
            var minPrice = positions[0];
            for (var k = 1; k < positions.length; k++) {
              if (positions[k] < minPrice) minPrice = positions[k];
            }
            doBuy = price <= minPrice - gridStep;
          }
          if (doBuy) {
            positions.push(price);
            signals[i] = 1;
          }
        }
      }

      context.__gmCache[cacheKey] = signals;
      return signals[index] || 0;
    }
  )`,
};
