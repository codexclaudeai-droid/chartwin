export const smaCrossJs = {
  id: 'strategy_js_sma_9_21',
  name: 'SMA 9/21 Cross (JS)',
  description: 'Fast/slow SMA crossover signal',
  language: 'javascript' as const,
  version: 1,
  sourceCode: `(
    function(context, index, ta) {
      const fast = ta.sma(context.close, 9, index);
      const slow = ta.sma(context.close, 21, index);
      if (fast == null || slow == null) return 0;
      const fa = context.close.map((_, i) => ta.sma(context.close, 9, i) ?? 0);
      const sa = context.close.map((_, i) => ta.sma(context.close, 21, i) ?? 0);
      if (ta.crossover(fa, sa, index)) return 1;
      if (ta.crossunder(fa, sa, index)) return -1;
      return 0;
    }
  )`,
};
