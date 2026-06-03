import type { DrawingDraft, DrawingShape, SingleAnchorLineDrawingToolId } from '../../ui/workspace/drawing-types.ts';
import { getSingleAnchorLineSegments } from '../../ui/workspace/drawing-utils.ts';
import { getLineDash, type DrawingLineStyle, type DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export interface RenderSingleAnchorLineParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingViewportMetrics & { top: number; mainH: number; chartLeft: number; chartRight: number };
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  now?: number;
}

export function renderSingleAnchorLine(params: RenderSingleAnchorLineParams): void {
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
    now = performance.now(),
  } = params;

  const anchorX = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const anchorY = metrics.getY(shape.a.price);
  const segments = getSingleAnchorLineSegments(
    { x: anchorX, y: anchorY },
    {
      left: metrics.chartLeft,
      right: metrics.chartRight,
      top: metrics.top,
      bottom: metrics.mainH,
    },
    shape.kind as SingleAnchorLineDrawingToolId,
  );

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash(getLineDash(lineStyle));
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  segments.forEach((segment) => {
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  });

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandle = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandle) return;

  const isHovered = shapeId === hoveredDrawingId;
  const pulse = (Math.sin(now * 0.012) + 1) * 0.5;
  const radius = 8.25;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash([]);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (isHovered) {
    ctx.save();
    ctx.globalAlpha = 0.24 + pulse * 0.28;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, radius + 2 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
