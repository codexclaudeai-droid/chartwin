import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { getLineDash, type DrawingLineStyle, type DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export type DrawingBoxRenderMetrics = DrawingViewportMetrics;

export interface RenderDrawingBoxParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingBoxRenderMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function parseBoxColor(color: string): { fillColor: string; strokeColor: string } {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  let red = 126;
  let green = 166;
  let blue = 255;
  let alpha = 0.2;
  if (match) {
    const parts = match[1].split(',').map((part) => part.trim());
    red = Number(parts[0] ?? '126');
    green = Number(parts[1] ?? '166');
    blue = Number(parts[2] ?? '255');
    alpha = parts.length >= 4 ? Number(parts[3]) : 0.2;
  }
  return {
    fillColor: `rgba(${red},${green},${blue},${Math.max(0.05, Math.min(1, alpha)).toFixed(2)})`,
    strokeColor: `rgba(${red},${green},${blue},1)`,
  };
}

export function renderDrawingBox(params: RenderDrawingBoxParams): void {
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
  const colors = parseBoxColor(strokeColor || 'rgba(126,166,255,0.2)');

  ctx.strokeStyle = colors.strokeColor;
  ctx.lineWidth = Math.max(1.2, strokeWidth);
  ctx.setLineDash(getLineDash(lineStyle));
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.fillColor;
  ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
  ctx.restore();

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandles) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = colors.strokeColor;
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, strokeWidth);
  const radius = 6.5;
  const drawAnchor = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  drawAnchor(left, top);
  drawAnchor(right, top);
  drawAnchor(right, bottom);
  drawAnchor(left, bottom);
  ctx.restore();
}
