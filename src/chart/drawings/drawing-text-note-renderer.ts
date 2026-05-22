import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import type { DrawingViewportMetrics } from './drawing-renderer-utils.ts';

export type DrawingTextNoteRenderMetrics = DrawingViewportMetrics;

export interface RenderDrawingTextNoteParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  metrics: DrawingTextNoteRenderMetrics;
  alpha: number;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

export function renderDrawingTextNote(params: RenderDrawingTextNoteParams): void {
  const { ctx, shape, metrics, alpha, fontStack, xForIndex } = params;
  const x = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const y = metrics.getY(shape.a.price);
  const text = ('text' in shape ? shape.text : undefined) ?? '텍스트';
  const color = ('color' in shape ? shape.color : undefined) ?? '#e6edf9';
  const height = 22;

  ctx.globalAlpha = alpha;
  ctx.font = `12px ${fontStack}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 6, y - height / 2);
}
