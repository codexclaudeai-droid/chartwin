import type { DrawingDraft, DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { isTrendlineKind } from '../../ui/workspace/drawing-utils.ts';
import type { TrendlineRenderLine, TrendlineTextLayout } from './drawing-hit-test.ts';
import { getLineDash, type DrawingLineStyle, type DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export type DrawingLineRenderMetrics = DrawingViewportMetrics;

export interface RenderDrawingLineParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingLineRenderMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  hoveredDrawingPart: DrawingHitPart | null;
  editingTextShapeId: string | null;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  getTrendlineRenderLine: (shape: DrawingShape | DrawingDraft, metrics: DrawingLineRenderMetrics) => TrendlineRenderLine;
  getTrendlineTextLayout: (shape: DrawingShape, metrics: DrawingLineRenderMetrics, placeholder: string) => TrendlineTextLayout;
  now?: number;
}

export function renderDrawingLine(params: RenderDrawingLineParams): void {
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
    getTrendlineRenderLine,
    getTrendlineTextLayout,
    now = performance.now(),
  } = params;

  const a = shape.a;
  const b = shape.b;
  const ax = xForIndex(a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(a.price);
  const bx = b ? xForIndex(b.index, metrics.totalSp, metrics.candleW) : ax;
  const by = b ? metrics.getY(b.price) : ay;
  const isPencil = shape.kind === 'draw-pencil';
  const isHighlighter = shape.kind === 'draw-highlighter';
  const activeStrokeColor = isPencil
    ? (strokeColor || '#6ea8ff')
    : (isHighlighter ? (strokeColor || 'rgba(255, 234, 86, 0.4)') : strokeColor);
  const activeStrokeWidth = isHighlighter ? Math.max(8, strokeWidth * 3.5) : strokeWidth;

  ctx.strokeStyle = activeStrokeColor;
  ctx.lineWidth = activeStrokeWidth;
  ctx.setLineDash(getLineDash(lineStyle));
  ctx.globalAlpha = alpha;
  ctx.lineCap = (isPencil || isHighlighter) ? 'round' : 'butt';
  ctx.lineJoin = (isPencil || isHighlighter) ? 'round' : 'miter';

  const pathPoints = (shape as DrawingShape).points ?? [a, b ?? a];
  if (pathPoints.length > 0) {
    const points = isPencil || isHighlighter
      ? pathPoints.map((point) => ({
          x: xForIndex(point.index, metrics.totalSp, metrics.candleW),
          y: metrics.getY(point.price),
        }))
      : (() => {
          const line = getTrendlineRenderLine(shape, metrics);
          return [
            { x: line.lineStartX, y: line.lineStartY },
            { x: line.lineEndX, y: line.lineEndY },
          ];
        })();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.001, points[0].y + 0.001);
    } else if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i += 1) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      const lastIndex = points.length - 1;
      ctx.quadraticCurveTo(points[lastIndex - 1].x, points[lastIndex - 1].y, points[lastIndex].x, points[lastIndex].y);
    }
    ctx.stroke();
  }

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (showHandles) {
    const isHovered = shapeId != null && shapeId === hoveredDrawingId;
    const pulse = (Math.sin(now * 0.012) + 1) * 0.5;
    const radius = (isPencil || isHighlighter) ? 5.8 : 8.25;
    ctx.strokeStyle = activeStrokeColor;
    ctx.lineWidth = isPencil || isHighlighter ? Math.max(1, strokeWidth * 0.8) : strokeWidth;
    ctx.setLineDash([]);
    ctx.fillStyle = '#000000';
    const trendline = !isPencil && !isHighlighter ? getTrendlineRenderLine(shape, metrics) : null;
    ctx.beginPath();
    ctx.arc(trendline?.anchorStartX ?? ax, trendline?.anchorStartY ?? ay, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(trendline?.anchorEndX ?? bx, trendline?.anchorEndY ?? by, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isHovered && !(isPencil || isHighlighter)) {
      ctx.save();
      ctx.globalAlpha = 0.24 + pulse * 0.28;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(trendline?.anchorStartX ?? ax, trendline?.anchorStartY ?? ay, radius + 2 + pulse * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(trendline?.anchorEndX ?? bx, trendline?.anchorEndY ?? by, radius + 2 + pulse * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (!isTrendlineKind(shape.kind)) return;
  const drawingShape = shape as DrawingShape;
  const hasText = (drawingShape.text ?? '').trim().length > 0;
  const isHoveredGuide = shapeId != null
    && shapeId === hoveredDrawingId
    && (hoveredDrawingPart === 'line' || hoveredDrawingPart === 'trendline-text-guide');
  const isEditingText = shapeId != null && shapeId === editingTextShapeId;
  const placeholder = !hasText && isHoveredGuide ? '텍스트 입력' : '';
  const layout = getTrendlineTextLayout(drawingShape, metrics, placeholder);
  if (!layout.text || isEditingText) return;

  ctx.save();
  ctx.translate(layout.x, layout.y);
  ctx.rotate(layout.angle);
  ctx.fillStyle = layout.isPlaceholder ? 'rgba(214,224,242,0.86)' : '#f0f5ff';
  ctx.font = `600 12px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(layout.text, 0, 0);
  if (layout.isPlaceholder) {
    ctx.strokeStyle = 'rgba(214,224,242,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(-layout.width / 2 - 4, 2);
    ctx.lineTo(layout.width / 2 + 4, 2);
    ctx.stroke();
  }
  ctx.restore();
}
