import type { DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';

export interface PositionDrawingHitMetrics {
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
}

export interface NormalizePositionDrawingHitPartParams {
  shape: DrawingShape;
  part: DrawingHitPart;
  mouseX: number;
  mouseY: number;
  metrics: PositionDrawingHitMetrics | null;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function isPositionShape(shape: DrawingShape): boolean {
  return shape.kind === 'long-position' || shape.kind === 'short-position';
}

function isPositionBodyPart(part: DrawingHitPart): boolean {
  return part === 'body' || part === 'line' || part === 'position-entry-info';
}

export function normalizePositionDrawingHitPart(params: NormalizePositionDrawingHitPartParams): DrawingHitPart {
  const {
    shape,
    part,
    mouseX,
    mouseY,
    metrics,
    xForIndex,
  } = params;

  if (!isPositionShape(shape) || !isPositionBodyPart(part) || !metrics) return part;

  const ax = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(shape.a.price);
  const by = metrics.getY(shape.b?.price ?? shape.a.price);
  const targetOffset = shape.channelOffset ?? { index: 0, price: 0 };
  const tx = xForIndex(shape.a.index + targetOffset.index, metrics.totalSp, metrics.candleW);
  const ty = metrics.getY(shape.a.price + targetOffset.price);
  const minBoxWidthPx = 228;
  let posLeft = Math.min(ax, tx);
  let posRight = Math.max(ax, tx);
  const currentWidth = Math.abs(posRight - posLeft);

  if (currentWidth < minBoxWidthPx) {
    if (tx >= ax) {
      posLeft = ax;
      posRight = ax + minBoxWidthPx;
    } else {
      posRight = ax;
      posLeft = ax - minBoxWidthPx;
    }
  }

  const anchorPad = 24;
  if (Math.abs(mouseX - posRight) <= anchorPad && Math.abs(mouseY - ay) <= anchorPad) return 'position-right';
  if (Math.abs(mouseX - posLeft) <= anchorPad && Math.abs(mouseY - by) <= anchorPad) return 'end';
  if (Math.abs(mouseX - posLeft) <= anchorPad && Math.abs(mouseY - ty) <= anchorPad) return 'position-target';

  const distRight = Math.hypot(mouseX - posRight, mouseY - ay);
  const distStop = Math.hypot(mouseX - posLeft, mouseY - by);
  const distTarget = Math.hypot(mouseX - posLeft, mouseY - ty);
  const minDist = Math.min(distRight, distStop, distTarget);
  if (minDist > anchorPad) return part;
  if (minDist === distRight) return 'position-right';
  if (minDist === distTarget) return 'position-target';
  return 'end';
}

export interface ConstrainPositionDrawingPointerParams {
  shape: DrawingShape | null;
  part: DrawingHitPart;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export function constrainPositionDrawingPointer(params: ConstrainPositionDrawingPointerParams): { x: number; y: number } {
  const {
    shape,
    part,
    x,
    y,
    startX,
    startY,
  } = params;

  if (!shape || !isPositionShape(shape)) return { x, y };
  if (part === 'position-right') return { x, y: startY };
  if (part === 'position-target' || part === 'end' || part === 'position-stop') {
    return { x: startX, y };
  }
  return { x, y };
}
