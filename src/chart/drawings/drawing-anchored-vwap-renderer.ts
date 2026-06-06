import type { AnchoredVwapSettings, DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { getContrastTextColor } from '../color-utils.ts';
import {
  drawPriceArrowBox,
  getLineDash,
  getPriceArrowTextAnchor,
  setCanvasStroke,
  type DrawingAxisMetrics,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export interface AnchoredVwapPlotPoint {
  index: number;
  vwap: number;
  stdDev: number;
}

export type DrawingAnchoredVwapRenderMetrics = DrawingViewportMetrics & DrawingAxisMetrics;

export interface RenderDrawingAnchoredVwapParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingAnchoredVwapRenderMetrics;
  plot: AnchoredVwapPlotPoint[];
  settings: AnchoredVwapSettings;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  fontStack: string;
  formatPrice: (value: number) => string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  series: Array<{ x: number; y: number }>,
  color: string,
  width: number,
  dash: number[],
  alpha: number,
): void {
  if (!series.length) return;
  setCanvasStroke(ctx, color, width, dash, alpha);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(series[0].x, series[0].y);
  for (let i = 1; i < series.length; i += 1) {
    ctx.lineTo(series[i].x, series[i].y);
  }
  ctx.stroke();
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  lineWidth: number,
  radius = 6,
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.2, lineWidth);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderDrawingAnchoredVwap(params: RenderDrawingAnchoredVwapParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    plot,
    settings,
    alpha,
    strokeColor,
    strokeWidth,
    lineStyle,
    selectedDrawingId,
    hoveredDrawingId,
    fontStack,
    formatPrice,
    xForIndex,
  } = params;
  if (!plot.length) return;

  const xSeries = plot.map((point) => xForIndex(point.index, metrics.totalSp, metrics.candleW));
  const centerSeries = plot.map((point, index) => ({
    x: xSeries[index],
    y: metrics.getY(point.vwap),
  }));
  const bandSeries = settings.bands.map((band) => plot.map((point, index) => ({
    x: xSeries[index],
    upperY: metrics.getY(point.vwap + (point.stdDev * band.multiplier)),
    lowerY: metrics.getY(point.vwap - (point.stdDev * band.multiplier)),
  })));

  const firstEnabledBandIndex = settings.bands.findIndex((band) => band.enabled && band.visible);
  if (settings.showBackground && firstEnabledBandIndex >= 0) {
    const fillSeries = bandSeries[firstEnabledBandIndex];
    if (fillSeries.length > 1) {
      ctx.save();
      ctx.globalAlpha = alpha * (settings.backgroundOpacity / 100);
      ctx.fillStyle = settings.backgroundColor;
      ctx.beginPath();
      ctx.moveTo(fillSeries[0].x, fillSeries[0].upperY);
      for (let i = 1; i < fillSeries.length; i += 1) {
        ctx.lineTo(fillSeries[i].x, fillSeries[i].upperY);
      }
      for (let i = fillSeries.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(fillSeries[i].x, fillSeries[i].lowerY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const lineDash = getLineDash(lineStyle);
  settings.bands.forEach((band, bandIndex) => {
    if (!band.enabled || !band.visible) return;
    const series = bandSeries[bandIndex];
    drawSeries(ctx, series.map((point) => ({ x: point.x, y: point.lowerY })), band.color, Math.max(1, strokeWidth * 0.9), lineDash, alpha);
    drawSeries(ctx, series.map((point) => ({ x: point.x, y: point.upperY })), band.color, Math.max(1, strokeWidth * 0.9), lineDash, alpha);
  });

  if (settings.showLine) {
    drawSeries(ctx, centerSeries, strokeColor, strokeWidth, lineDash, alpha);
  }

  if (settings.showPriceLabels) {
    const lastCenter = plot[plot.length - 1];
    const labelItems: Array<{ y: number; color: string; value: number }> = [];
    if (settings.showLine && lastCenter) {
      labelItems.push({ y: metrics.getY(lastCenter.vwap), color: strokeColor, value: lastCenter.vwap });
    }
    settings.bands.forEach((band) => {
      if (!band.enabled || !band.visible || !lastCenter) return;
      const delta = lastCenter.stdDev * band.multiplier;
      labelItems.push({ y: metrics.getY(lastCenter.vwap - delta), color: band.color, value: lastCenter.vwap - delta });
      labelItems.push({ y: metrics.getY(lastCenter.vwap + delta), color: band.color, value: lastCenter.vwap + delta });
    });

    labelItems.forEach((item) => {
      const boxWidth = Math.max(20, metrics.axisPad - 2);
      const boxX = metrics.axisSide === 'left' ? 2 : metrics.axisLeft;
      const boxHeight = 18;
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = item.color;
      drawPriceArrowBox(ctx, boxX, item.y, boxWidth, boxHeight, metrics.axisSide, 5);
      ctx.fill();
      ctx.fillStyle = getContrastTextColor(item.color);
      ctx.font = `700 11px ${fontStack}`;
      const anchor = getPriceArrowTextAnchor(boxX, boxWidth, metrics.axisSide, 5);
      ctx.textAlign = anchor.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(formatPrice(item.value), anchor.x, item.y);
      ctx.restore();
    });
  }

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandles) return;

  const anchorPoint = plot[0] ?? null;
  const anchorX = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const anchorY = anchorPoint ? metrics.getY(anchorPoint.vwap) : metrics.getY(shape.a.price);
  drawHandle(ctx, anchorX, anchorY, strokeColor, strokeWidth);

  if (shapeId !== selectedDrawingId || centerSeries.length < 2) return;

  const midIndex = Math.floor((centerSeries.length - 1) / 2);
  const centerMid = centerSeries[midIndex];
  if (centerMid) {
    drawHandle(ctx, centerMid.x, centerMid.y, strokeColor, strokeWidth, 3);
  }

  settings.bands.forEach((band, bandIndex) => {
    if (!band.enabled || !band.visible) return;
    const bandMid = bandSeries[bandIndex]?.[midIndex];
    if (!bandMid) return;
    drawHandle(ctx, bandMid.x, bandMid.upperY, band.color, Math.max(1, strokeWidth * 0.9), 3);
    drawHandle(ctx, bandMid.x, bandMid.lowerY, band.color, Math.max(1, strokeWidth * 0.9), 3);
  });
}
