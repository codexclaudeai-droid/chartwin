import { toRgba } from '../color-utils.ts';
import type { BbMtfKalmanSignalResult } from '../indicators/bb-mtf-kalman-signal.ts';
import type { DrawSeriesLine, IndicatorLineStyle } from './main-line-renderer.ts';

export function applyBbMtfKalmanLinewidth(style: IndicatorLineStyle, linewidth: number | undefined): IndicatorLineStyle {
  const width = Math.max(1, Math.floor(Number(linewidth) || style.width || 1));
  return {
    ...style,
    width,
  };
}

export function renderBbMtfKalmanSignal(params: {
  ctx: CanvasRenderingContext2D;
  data: BbMtfKalmanSignalResult;
  displayData: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  chartRight: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  ltfBasisStyle: IndicatorLineStyle;
  ltfUpperStyle: IndicatorLineStyle;
  ltfLowerStyle: IndicatorLineStyle;
  htfUpperStyle: IndicatorLineStyle;
  htfLowerStyle: IndicatorLineStyle;
  buyStyle: IndicatorLineStyle;
  sellStyle: IndicatorLineStyle;
  bullishColor: string;
  bearishColor: string;
  textColor: string;
  plotLtfBb: boolean;
  plotHtfBb: boolean;
  plotLabels: boolean;
  signalsEnabled: boolean;
  showErrors: boolean;
  showLtfBasis: boolean;
  showLtfUpper: boolean;
  showLtfLower: boolean;
  showHtfUpper: boolean;
  showHtfLower: boolean;
  showBuySignal: boolean;
  showSellSignal: boolean;
  drawLine: DrawSeriesLine;
  getY: (price: number) => number;
  fontStack: string;
}): void {
  const {
    ctx,
    data,
    displayData,
    startIndex,
    visLength,
    effectiveChartLeft,
    chartRight,
    totalSp,
    candleW,
    top,
    bottom,
    ltfBasisStyle,
    ltfUpperStyle,
    ltfLowerStyle,
    htfUpperStyle,
    htfLowerStyle,
    buyStyle,
    sellStyle,
    bullishColor,
    bearishColor,
    textColor,
    plotLtfBb,
    plotHtfBb,
    plotLabels,
    signalsEnabled,
    showErrors,
    showLtfBasis,
    showLtfUpper,
    showLtfLower,
    showHtfUpper,
    showHtfLower,
    showBuySignal,
    showSellSignal,
    drawLine,
    getY,
    fontStack,
  } = params;

  renderGapFill({
    ctx,
    data,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    top,
    bottom,
    bearishColor,
    bullishColor,
    getY,
  });

  if (plotLtfBb) {
    if (showLtfBasis) drawLine(data.ltfBasis, ltfBasisStyle.color, ltfBasisStyle.width, ltfBasisStyle.dash);
    if (showLtfUpper) drawLine(data.ltfUpper, ltfUpperStyle.color, ltfUpperStyle.width, ltfUpperStyle.dash);
    if (showLtfLower) drawLine(data.ltfLower, ltfLowerStyle.color, ltfLowerStyle.width, ltfLowerStyle.dash);
  }
  if (plotHtfBb) {
    if (showHtfUpper) drawLine(data.htfUpper, htfUpperStyle.color, htfUpperStyle.width, htfUpperStyle.dash);
    if (showHtfLower) drawLine(data.htfLower, htfLowerStyle.color, htfLowerStyle.width, htfLowerStyle.dash);
  }

  if (signalsEnabled && (showBuySignal || showSellSignal)) {
    renderSignals({
      ctx,
      data,
      displayData,
      startIndex,
      visLength,
      effectiveChartLeft,
      totalSp,
      candleW,
      top,
      bottom,
      buyColor: buyStyle.color,
      sellColor: sellStyle.color,
      showBuySignal,
      showSellSignal,
      getY,
    });
  }

  if (plotLabels && plotHtfBb) {
    renderHtfLabels({
      ctx,
      data,
      startIndex,
      visLength,
      effectiveChartLeft,
      chartRight,
      totalSp,
      candleW,
      textColor,
      fontStack,
      showHtfUpper,
      showHtfLower,
      getY,
    });
  }

  if (showErrors && data.warning) {
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = `600 12px ${fontStack}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(data.warning, chartRight - 8, top + 8);
    ctx.restore();
  }
}

function renderGapFill(params: {
  ctx: CanvasRenderingContext2D;
  data: BbMtfKalmanSignalResult;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  top: number;
  bottom: number;
  bearishColor: string;
  bullishColor: string;
  getY: (price: number) => number;
}): void {
  const { ctx, data, startIndex, visLength, effectiveChartLeft, totalSp, top, bottom, bearishColor, bullishColor, getY } = params;
  ctx.save();
  ctx.beginPath();
  ctx.rect(effectiveChartLeft - totalSp, top, totalSp * (visLength + 2), Math.max(1, bottom - top));
  ctx.clip();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const x = effectiveChartLeft + i * totalSp;
    const upperOpacity = data.upperFillOpacity[gi];
    if (upperOpacity != null && data.ltfUpper[gi] != null && data.htfUpper[gi] != null) {
      const alpha = Math.max(0, Math.min(1, (100 - upperOpacity) / 100));
      ctx.fillStyle = toRgba(bearishColor, alpha);
      const y1 = getY(data.ltfUpper[gi]!);
      const y2 = getY(data.htfUpper[gi]!);
      ctx.fillRect(x, Math.min(y1, y2), Math.max(1, totalSp), Math.max(1, Math.abs(y2 - y1)));
    }
    const lowerOpacity = data.lowerFillOpacity[gi];
    if (lowerOpacity != null && data.ltfLower[gi] != null && data.htfLower[gi] != null) {
      const alpha = Math.max(0, Math.min(1, (100 - lowerOpacity) / 100));
      ctx.fillStyle = toRgba(bullishColor, alpha);
      const y1 = getY(data.ltfLower[gi]!);
      const y2 = getY(data.htfLower[gi]!);
      ctx.fillRect(x, Math.min(y1, y2), Math.max(1, totalSp), Math.max(1, Math.abs(y2 - y1)));
    }
  }
  ctx.restore();
}

function renderSignals(params: {
  ctx: CanvasRenderingContext2D;
  data: BbMtfKalmanSignalResult;
  displayData: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  buyColor: string;
  sellColor: string;
  showBuySignal: boolean;
  showSellSignal: boolean;
  getY: (price: number) => number;
}): void {
  const { ctx, data, displayData, startIndex, visLength, effectiveChartLeft, totalSp, candleW, top, bottom, buyColor, sellColor, showBuySignal, showSellSignal, getY } = params;
  ctx.save();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const candle = displayData[gi];
    if (!candle) continue;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    if (showSellSignal && data.sellSignal[gi]) {
      drawTriangle(ctx, x, Math.max(top + 7, getY(candle.high * 1.001)), 'down', sellColor);
    }
    if (showBuySignal && data.buySignal[gi]) {
      drawTriangle(ctx, x, Math.min(bottom - 7, getY(candle.low * 0.999)), 'up', buyColor);
    }
  }
  ctx.restore();
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'up' | 'down', color: string): void {
  const size = 7;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === 'up') {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x + size, y + size);
  } else {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
  }
  ctx.closePath();
  ctx.fill();
}

function renderHtfLabels(params: {
  ctx: CanvasRenderingContext2D;
  data: BbMtfKalmanSignalResult;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  chartRight: number;
  totalSp: number;
  candleW: number;
  textColor: string;
  fontStack: string;
  showHtfUpper: boolean;
  showHtfLower: boolean;
  getY: (price: number) => number;
}): void {
  const { ctx, data, startIndex, visLength, effectiveChartLeft, chartRight, totalSp, candleW, textColor, fontStack, showHtfUpper, showHtfLower, getY } = params;
  let lastIndex = -1;
  for (let i = visLength - 1; i >= 0; i -= 1) {
    const gi = startIndex + i;
    if (data.htfUpper[gi] != null || data.htfLower[gi] != null) {
      lastIndex = gi;
      break;
    }
  }
  if (lastIndex < 0) return;
  const visibleIndex = lastIndex - startIndex;
  const x = Math.min(chartRight - 6, effectiveChartLeft + (visibleIndex + 6) * totalSp + candleW / 2);
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = `500 12px ${fontStack}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if (showHtfUpper && data.htfUpper[lastIndex] != null) ctx.fillText('HTF Upper BB', x, getY(data.htfUpper[lastIndex]!));
  if (showHtfLower && data.htfLower[lastIndex] != null) ctx.fillText('HTF Lower BB', x, getY(data.htfLower[lastIndex]!));
  ctx.restore();
}
