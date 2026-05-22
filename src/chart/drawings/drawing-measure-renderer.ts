import { getContrastTextColor, toRgba } from '../color-utils.ts';
import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import type { DrawingChartBounds, DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export type DrawingMeasureRenderMetrics = DrawingViewportMetrics & DrawingChartBounds;

export interface RenderDrawingMeasureParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingMeasureRenderMetrics;
  alpha: number;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  upColor: string;
  downColor: string;
  viewportHeight: number;
  xAxisHeight: number;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function drawHorizontalArrow(ctx: CanvasRenderingContext2D, left: number, right: number, midY: number): void {
  const arrow = 7;
  ctx.beginPath();
  ctx.moveTo(left + 6, midY);
  ctx.lineTo(right - 8, midY);
  ctx.lineTo(right - 8 - arrow, midY - arrow * 0.5);
  ctx.moveTo(right - 8, midY);
  ctx.lineTo(right - 8 - arrow, midY + arrow * 0.5);
  ctx.stroke();
}

function drawVerticalArrow(ctx: CanvasRenderingContext2D, midX: number, top: number, bottom: number, isDown: boolean): void {
  const arrow = 7;
  ctx.beginPath();
  if (isDown) {
    ctx.moveTo(midX, top + 6);
    ctx.lineTo(midX, bottom - 8);
    ctx.lineTo(midX - arrow * 0.5, bottom - 8 - arrow);
    ctx.moveTo(midX, bottom - 8);
    ctx.lineTo(midX + arrow * 0.5, bottom - 8 - arrow);
  } else {
    ctx.moveTo(midX, bottom - 6);
    ctx.lineTo(midX, top + 8);
    ctx.lineTo(midX - arrow * 0.5, top + 8 + arrow);
    ctx.moveTo(midX, top + 8);
    ctx.lineTo(midX + arrow * 0.5, top + 8 + arrow);
  }
  ctx.stroke();
}

function drawMeasureHandles(ctx: CanvasRenderingContext2D, points: Array<[number, number]>): void {
  ctx.save();
  ctx.strokeStyle = '#2f6cff';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  const radius = 5;
  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

export function renderDrawingMeasure(params: RenderDrawingMeasureParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    alpha,
    selectedDrawingId,
    hoveredDrawingId,
    upColor,
    downColor,
    viewportHeight,
    xAxisHeight,
    fontStack,
    xForIndex,
  } = params;

  const a = shape.a;
  const b = shape.b ?? shape.a;
  const ax = xForIndex(a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(a.price);
  const bx = xForIndex(b.index, metrics.totalSp, metrics.candleW);
  const by = metrics.getY(b.price);
  const left = Math.min(ax, bx);
  const right = Math.max(ax, bx);
  const top = Math.min(ay, by);
  const bottom = Math.max(ay, by);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const isDown = by > ay;
  const baseColor = isDown ? downColor : upColor;
  const lineColor = toRgba(baseColor, 0.95, isDown ? 'rgba(242,54,69,0.95)' : 'rgba(34,171,148,0.95)');
  const fillColor = toRgba(baseColor, 0.22, isDown ? 'rgba(242,54,69,0.22)' : 'rgba(34,171,148,0.22)');
  const priceDelta = b.price - a.price;
  const pct = a.price !== 0 ? (priceDelta / Math.abs(a.price)) * 100 : 0;
  const absDelta = Math.abs(priceDelta);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillColor;
  ctx.fillRect(left, top, width, height);

  const midX = left + width / 2;
  const midY = top + height / 2;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 0.6;
  drawHorizontalArrow(ctx, left, right, midY);
  drawVerticalArrow(ctx, midX, top, bottom, isDown);

  const deltaText = absDelta.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = `${priceDelta >= 0 ? '+' : '-'}${deltaText} (${priceDelta >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
  ctx.font = `700 13px ${fontStack}`;
  const textWidth = Math.ceil(ctx.measureText(label).width);
  const boxWidth = textWidth + 22;
  const boxHeight = 30;
  const boxX = Math.max(metrics.chartLeft + 8, Math.min(metrics.chartRight - boxWidth - 8, midX - boxWidth / 2));
  const boxY = Math.min(viewportHeight - xAxisHeight - boxHeight - 6, bottom + 10);
  ctx.fillStyle = lineColor;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
  ctx.fill();
  ctx.fillStyle = getContrastTextColor(lineColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, boxX + boxWidth / 2, boxY + boxHeight / 2);
  ctx.restore();

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandles) return;
  drawMeasureHandles(ctx, [[ax, ay], [bx, by]]);
}
