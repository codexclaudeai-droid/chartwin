export const smaCrossPine = {
  id: 'strategy_pine_sma_5_20',
  name: 'SMA 5/20 Cross (Pine)',
  description: 'Pine 입력 전략을 JS로 변환해 실행',
  language: 'pine' as const,
  version: 2,
  sourceCode: `BUY = ta.crossover(ta.sma(close, 5), ta.sma(close, 20))
SELL = ta.crossunder(ta.sma(close, 5), ta.sma(close, 20))`,
};
