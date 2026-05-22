import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import type { DrawingAxisMetrics, DrawingChartBounds, DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export type DrawingLayerMetrics = DrawingViewportMetrics & DrawingChartBounds & DrawingAxisMetrics & {
  top: number;
  mainH: number;
};

export interface RenderDrawingLayerParams<TMetrics extends DrawingLayerMetrics = DrawingLayerMetrics> {
  ctx: CanvasRenderingContext2D;
  drawings: DrawingShape[];
  draft: DrawingDraft | null;
  selectedDrawingId: string | null;
  drawingsVisible: boolean;
  metrics: TMetrics | null;
  renderShape: (ctx: CanvasRenderingContext2D, shape: DrawingShape | DrawingDraft, isDraft: boolean, metrics: TMetrics) => void;
  renderSelection: (ctx: CanvasRenderingContext2D, shape: DrawingShape, metrics: TMetrics) => void;
}

function shouldClipSelection(shape: DrawingShape): boolean {
  return shape.kind !== 'hline' && shape.kind !== 'anchored-vwap';
}

function renderSelectedOverlay<TMetrics extends DrawingLayerMetrics>(params: {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape;
  metrics: TMetrics;
  renderSelection: (ctx: CanvasRenderingContext2D, shape: DrawingShape, metrics: TMetrics) => void;
}): void {
  const { ctx, shape, metrics, renderSelection } = params;
  if (!shouldClipSelection(shape)) {
    renderSelection(ctx, shape, metrics);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    metrics.chartLeft,
    metrics.top,
    Math.max(1, metrics.chartRight - metrics.chartLeft),
    Math.max(1, metrics.mainH - metrics.top),
  );
  ctx.clip();
  renderSelection(ctx, shape, metrics);
  ctx.restore();
}

export function renderDrawingLayer<TMetrics extends DrawingLayerMetrics>(params: RenderDrawingLayerParams<TMetrics>): void {
  const {
    ctx,
    drawings,
    draft,
    selectedDrawingId,
    drawingsVisible,
    metrics,
    renderShape,
    renderSelection,
  } = params;

  if (!drawingsVisible || !metrics) return;

  ctx.save();
  drawings.forEach((shape) => {
    renderShape(ctx, shape, false, metrics);
    if (shape.id === selectedDrawingId) {
      renderSelectedOverlay({ ctx, shape, metrics, renderSelection });
    }
  });
  if (draft) {
    renderShape(ctx, draft, true, metrics);
  }
  ctx.restore();
}
