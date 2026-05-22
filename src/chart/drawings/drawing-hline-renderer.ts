import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { getContrastTextColor } from '../color-utils.ts';
import {
  drawPriceArrowBox,
  getLineDash,
  getPriceArrowTextAnchor,
  setCanvasStroke,
  type DrawingAxisMetrics,
  type DrawingChartBounds,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export type DrawingHlineRenderMetrics = DrawingViewportMetrics & DrawingChartBounds & DrawingAxisMetrics;

export interface RenderDrawingHlineParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingHlineRenderMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  fontStack: string;
  formatPrice: (value: number) => string;
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const size = 10;
  const radius = 3;
  ctx.beginPath();
  ctx.roundRect(x - size / 2, y - size / 2, size, size, radius);
  ctx.fill();
  ctx.stroke();
}

export function renderDrawingHline(params: RenderDrawingHlineParams): void {
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
    fontStack,
    formatPrice,
  } = params;

  const y = metrics.getY(shape.a.price);
  setCanvasStroke(ctx, strokeColor, strokeWidth, getLineDash(lineStyle), alpha);
  ctx.beginPath();
  ctx.moveTo(metrics.chartLeft, y);
  ctx.lineTo(metrics.chartRight, y);
  ctx.stroke();

  const boxWidth = Math.max(20, metrics.axisPad - 2);
  const boxX = metrics.axisSide === 'left' ? 2 : metrics.axisLeft;
  const boxHeight = 20;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = strokeColor;
  drawPriceArrowBox(ctx, boxX, y, boxWidth, boxHeight, metrics.axisSide);
  ctx.fill();
  ctx.fillStyle = getContrastTextColor(strokeColor);
  ctx.font = `700 12px ${fontStack}`;
  const textAnchor = getPriceArrowTextAnchor(boxX, boxWidth, metrics.axisSide, 5);
  ctx.textAlign = textAnchor.align;
  ctx.textBaseline = 'middle';
  ctx.fillText(formatPrice(shape.a.price), textAnchor.x, y);
  ctx.restore();

  const text = ('text' in shape ? shape.text : '') ?? '';
  if (text.trim()) {
    ctx.save();
    ctx.fillStyle = '#f0f5ff';
    ctx.font = `600 12px ${fontStack}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, 8, y - 6);
    ctx.restore();
  }

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandles) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.2, strokeWidth);
  const handleOffset = Math.max(20, boxWidth * 2);
  const handleXRaw = metrics.axisSide === 'left'
    ? metrics.chartLeft + handleOffset
    : metrics.axisLeft - handleOffset;
  const handleX = Math.max(metrics.chartLeft + 12, Math.min(metrics.chartRight - 12, handleXRaw));
  drawHandle(ctx, handleX, y);
  ctx.restore();
}
