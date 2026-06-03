import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { getCircleScreenGeometry } from '../../ui/workspace/drawing-utils.ts';
import type { TrendlineTextLayout } from './drawing-hit-test.ts';
import { getLineDash, type DrawingLineStyle, type DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export interface RenderDrawingCircleParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingViewportMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  hoveredDrawingPart: string | null;
  editingTextShapeId: string | null;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  getTrendlineTextLayout: (shape: DrawingShape, metrics: DrawingViewportMetrics, placeholder: string) => TrendlineTextLayout;
}

function parseCircleColor(color: string): { fillColor: string; strokeColor: string } {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  let red = 126;
  let green = 166;
  let blue = 255;
  let alpha = 0.16;
  if (match) {
    const parts = match[1].split(',').map((part) => part.trim());
    red = Number(parts[0] ?? '126');
    green = Number(parts[1] ?? '166');
    blue = Number(parts[2] ?? '255');
    alpha = parts.length >= 4 ? Number(parts[3]) : 0.16;
  }
  return {
    fillColor: `rgba(${red},${green},${blue},${Math.max(0.04, Math.min(1, alpha)).toFixed(2)})`,
    strokeColor: `rgba(${red},${green},${blue},1)`,
  };
}

export function renderDrawingCircle(params: RenderDrawingCircleParams): void {
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
    hoveredDrawingPart,
    editingTextShapeId,
    fontStack,
    xForIndex,
    getTrendlineTextLayout,
  } = params;

  const a = shape.a;
  const b = shape.b ?? shape.a;
  const ax = xForIndex(a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(a.price);
  const bx = xForIndex(b.index, metrics.totalSp, metrics.candleW);
  const by = metrics.getY(b.price);
  const geometry = getCircleScreenGeometry({ x: ax, y: ay }, { x: bx, y: by });
  const radiusX = Math.max(1, geometry.radiusX);
  const radiusY = Math.max(1, geometry.radiusY);
  const colors = parseCircleColor(strokeColor || 'rgba(126,166,255,0.16)');

  ctx.strokeStyle = colors.strokeColor;
  ctx.lineWidth = Math.max(1.2, strokeWidth);
  ctx.setLineDash(getLineDash(lineStyle));
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(geometry.centerX, geometry.centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.fillColor;
  ctx.beginPath();
  ctx.ellipse(geometry.centerX, geometry.centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (isDraft) return;
  const shapeId = ('id' in shape) ? shape.id : null;
  const drawingShape = shape as DrawingShape;
  const hasText = (drawingShape.text ?? '').trim().length > 0;
  const isHoveredGuide = shapeId != null
    && shapeId === hoveredDrawingId
    && (hoveredDrawingPart === 'line' || hoveredDrawingPart === 'body' || hoveredDrawingPart === 'trendline-text-guide');
  const isEditingText = shapeId != null && shapeId === editingTextShapeId;
  const placeholder = !hasText && isHoveredGuide ? '텍스트 입력' : '';
  const layout = getTrendlineTextLayout(drawingShape, metrics, placeholder);
  if (!layout.text || isEditingText) return;

  ctx.save();
  ctx.fillStyle = layout.isPlaceholder ? 'rgba(214,224,242,0.86)' : '#f0f5ff';
  ctx.font = `600 12px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(layout.text, layout.x, layout.y);
  if (layout.isPlaceholder) {
    ctx.strokeStyle = 'rgba(214,224,242,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(layout.x - layout.width / 2 - 4, layout.y + layout.height * 0.6);
    ctx.lineTo(layout.x + layout.width / 2 + 4, layout.y + layout.height * 0.6);
    ctx.stroke();
  }
  ctx.restore();

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
  drawAnchor(ax, ay);
  drawAnchor(bx, by);
  ctx.restore();
}
