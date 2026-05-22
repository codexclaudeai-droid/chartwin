import type { CandleData } from '../../types.ts';

export interface CandleHoverHitTestParams {
  mx: number;
  my: number;
  data: CandleData[];
  viewportWidth: number;
  viewportHeight: number;
  xAxisHeight: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  startIndex: number;
  endIndex: number;
  rightGapBars: number;
  activePanels: string[];
  getPanelRatio: (panelId: string) => number;
}

export function isHoveringCandleBody(params: CandleHoverHitTestParams): boolean {
  const {
    mx,
    my,
    data,
    viewportHeight,
    xAxisHeight,
    chartLeft,
    chartRight,
    chartWidth,
    startIndex,
    endIndex,
    rightGapBars,
    activePanels,
    getPanelRatio,
  } = params;
  const plotHeight = Math.max(40, viewportHeight - xAxisHeight);
  const mainTop = 10;
  const subPanelRatio = activePanels.reduce((sum, panelId) => sum + getPanelRatio(panelId), 0);
  const mainH = plotHeight * (1 - subPanelRatio);

  if (mx < chartLeft || mx > chartRight || my < mainTop || my > mainH) return false;

  const visibleCount = Math.max(1, endIndex - startIndex);
  const maxGapBars = 50 / Math.max(1, chartWidth / Math.max(1, endIndex - startIndex));
  const gapBars = Math.min(Math.max(0, rightGapBars), maxGapBars);
  const totalSpacing = chartWidth / (visibleCount + gapBars);
  const candleWidth = Math.max(totalSpacing * 0.8, 1);
  const nearestIndex = Math.max(
    0,
    Math.min(visibleCount - 1, Math.round((mx - chartLeft - candleWidth / 2) / totalSpacing)),
  );
  const candleIndex = startIndex + nearestIndex;
  const candle = data[candleIndex];
  if (!candle) return false;

  const visibleCandles = data.slice(startIndex, endIndex);
  if (!visibleCandles.length) return false;

  let lo = Infinity;
  let hi = -Infinity;
  visibleCandles.forEach((visibleCandle) => {
    lo = Math.min(lo, visibleCandle.low);
    hi = Math.max(hi, visibleCandle.high);
  });
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;

  const toY = (price: number) => mainTop + (hi - price) / (hi - lo || 1) * (mainH - mainTop);
  const yHigh = toY(candle.high);
  const yLow = toY(candle.low);
  const xCenter = chartLeft + nearestIndex * totalSpacing + candleWidth / 2;

  const xHit = Math.abs(mx - xCenter) <= Math.max(6, candleWidth * 0.7);
  const yHit = my >= yHigh - 5 && my <= yLow + 5;
  return xHit && yHit;
}
