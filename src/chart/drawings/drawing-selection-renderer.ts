import { isSingleAnchorLineKind, isTrendlineKind } from '../../ui/workspace/drawing-utils.ts';
import type { DrawingShape } from '../../ui/workspace/drawing-types.ts';

export interface DrawingSelectionMetrics {
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
}

export interface RenderDrawingSelectionOverlayParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape;
  metrics: DrawingSelectionMetrics;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function shouldHideSelectionBox(shape: DrawingShape): boolean {
  return (
    shape.kind === 'hline'
    || isSingleAnchorLineKind(shape.kind)
    || shape.kind === 'measure'
    || isTrendlineKind(shape.kind)
    || shape.kind === 'channel'
    || shape.kind === 'text-note'
    || shape.kind === 'long-position'
    || shape.kind === 'short-position'
    || shape.kind === 'fib-retracement'
    || shape.kind === 'fib-trend'
    || shape.kind === 'anchored-vwap'
    || shape.kind === 'draw-box'
    || shape.kind === 'draw-circle'
    || shape.kind === 'draw-pencil'
    || shape.kind === 'draw-highlighter'
  );
}

export function renderDrawingSelectionOverlay(params: RenderDrawingSelectionOverlayParams): void {
  const { ctx, shape, metrics, xForIndex } = params;
  const ax = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(shape.a.price);
  const bx = shape.b ? xForIndex(shape.b.index, metrics.totalSp, metrics.candleW) : ax;
  const by = shape.b ? metrics.getY(shape.b.price) : ay;
  const left = Math.min(ax, bx);
  const right = Math.max(ax, bx);
  const top = Math.min(ay, by);
  const bottom = Math.max(ay, by);

  ctx.save();
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  if (!shouldHideSelectionBox(shape)) {
    ctx.strokeRect(left - 4, top - 4, Math.max(8, right - left + 8), Math.max(8, bottom - top + 8));
  }
  ctx.setLineDash([]);

  if (!shouldHideSelectionBox(shape)) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (shape.b) {
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
