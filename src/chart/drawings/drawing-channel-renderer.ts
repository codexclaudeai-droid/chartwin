import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { getChannelGeometry } from '../../ui/workspace/drawing-utils.ts';
import {
  getLineDash,
  setCanvasStroke,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export type DrawingChannelRenderMetrics = DrawingViewportMetrics;

export interface RenderDrawingChannelParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingChannelRenderMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function drawRoundedHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const width = 10;
  const height = 8;
  const radius = 2;
  ctx.beginPath();
  ctx.moveTo(x - width / 2 + radius, y - height / 2);
  ctx.lineTo(x + width / 2 - radius, y - height / 2);
  ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + radius);
  ctx.lineTo(x + width / 2, y + height / 2 - radius);
  ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - radius, y + height / 2);
  ctx.lineTo(x - width / 2 + radius, y + height / 2);
  ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - radius);
  ctx.lineTo(x - width / 2, y - height / 2 + radius);
  ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + radius, y - height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 6.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function renderDrawingChannel(params: RenderDrawingChannelParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    alpha,
    strokeColor,
    strokeWidth,
    lineStyle,
    selectedDrawingId,
    hoveredDrawingId,
    xForIndex,
  } = params;
  const geometry = getChannelGeometry(shape);
  const ax = xForIndex(geometry.a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(geometry.a.price);
  const bx = xForIndex(geometry.b.index, metrics.totalSp, metrics.candleW);
  const by = metrics.getY(geometry.b.price);
  const a2x = xForIndex(geometry.a2.index, metrics.totalSp, metrics.candleW);
  const a2y = metrics.getY(geometry.a2.price);
  const b2x = xForIndex(geometry.b2.index, metrics.totalSp, metrics.candleW);
  const b2y = metrics.getY(geometry.b2.price);
  const m1x = (ax + bx) / 2;
  const m1y = (ay + by) / 2;
  const m2x = (a2x + b2x) / 2;
  const m2y = (a2y + b2y) / 2;
  const leftMidX = (ax + a2x) / 2;
  const leftMidY = (ay + a2y) / 2;
  const rightMidX = (bx + b2x) / 2;
  const rightMidY = (by + b2y) / 2;
  const offsetPx = Math.hypot(a2x - ax, a2y - ay);

  setCanvasStroke(ctx, strokeColor, strokeWidth, getLineDash(lineStyle), alpha);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  if (offsetPx > 0.8) {
    ctx.moveTo(a2x, a2y);
    ctx.lineTo(b2x, b2y);
  }
  ctx.stroke();

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = !isDraft && shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (offsetPx <= 0.8) {
    if (showHandles) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = '#0f172a';
      ctx.lineWidth = strokeWidth;
      drawCorner(ctx, ax, ay);
      drawCorner(ctx, bx, by);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha * 0.14;
  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(b2x, b2y);
  ctx.lineTo(a2x, a2y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  setCanvasStroke(ctx, strokeColor, Math.max(1, strokeWidth - 0.7), [4, 4], alpha);
  ctx.beginPath();
  ctx.moveTo(leftMidX, leftMidY);
  ctx.lineTo(rightMidX, rightMidY);
  ctx.stroke();

  if (!showHandles) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = strokeWidth;
  drawCorner(ctx, ax, ay);
  drawCorner(ctx, bx, by);
  drawCorner(ctx, a2x, a2y);
  drawCorner(ctx, b2x, b2y);
  drawRoundedHandle(ctx, m1x, m1y);
  drawRoundedHandle(ctx, m2x, m2y);
  ctx.restore();
}
