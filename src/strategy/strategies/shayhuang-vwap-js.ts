export const shayhuangVwapJs = {
  id: 'strategy_js_shayhuang_vwap_fast',
  name: 'ShayHuang_VWAP_Fast',
  description: '셰이황 패스트 VWAP 단타 전략 — VWAP 돌파 + 연속 양봉/음봉',
  language: 'javascript' as const,
  version: 1,
  sourceCode: `(
    function(context, index, ta) {
      var close = context.close;
      var high = context.high;
      var low = context.low;
      var open = context.open;
      var volume = context.volume;
      if (!close || !high || !low || !open || !volume || index < 1) return 0;

      var cumTpv = 0;
      var cumVol = 0;
      var vwap = [];
      for (var i = 0; i <= index; i++) {
        var tp = (high[i] + low[i] + close[i]) / 3;
        cumTpv += tp * (volume[i] || 0);
        cumVol += (volume[i] || 0);
        vwap[i] = cumVol > 0 ? cumTpv / cumVol : close[i];
      }

      var prevClose = close[index - 1];
      var currClose = close[index];
      var prevVwap = vwap[index - 1];
      var currVwap = vwap[index];
      var prevBullish = prevClose > open[index - 1];
      var currBullish = currClose > open[index];
      var prevBearish = prevClose < open[index - 1];
      var currBearish = currClose < open[index];

      if (prevClose < prevVwap && currClose >= currVwap && currBullish && prevBullish) return 1;
      if (prevClose > prevVwap && currClose <= currVwap && currBearish && prevBearish) return -1;
      return 0;
    }
  )`,
};
