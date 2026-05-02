import type { DrawingAnchor, DrawingDraft, DrawingShape } from './drawing-types';

export function cloneDrawingShape(shape: DrawingShape): DrawingShape {
  return {
    id: shape.id,
    kind: shape.kind,
    a: { index: shape.a.index, price: shape.a.price },
    b: shape.b ? { index: shape.b.index, price: shape.b.price } : undefined,
    points: shape.points ? shape.points.map((p) => ({ index: p.index, price: p.price })) : undefined,
    text: shape.text,
    color: shape.color,
    width: shape.width,
    lineStyle: shape.lineStyle,
    channelOffset: shape.channelOffset ? { ...shape.channelOffset } : undefined,
    hidden: shape.hidden,
    locked: shape.locked,
    alert: shape.alert ? { ...shape.alert } : undefined,
    position: shape.position ? { ...shape.position } : undefined,
  };
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const sx = x1 + t * dx;
  const sy = y1 + t * dy;
  return Math.hypot(px - sx, py - sy);
}

export function getChannelGeometry(shape: DrawingShape | DrawingDraft): {
  a: DrawingAnchor;
  b: DrawingAnchor;
  a2: DrawingAnchor;
  b2: DrawingAnchor;
  offset: DrawingAnchor;
} {
  const a = shape.a;
  const b = shape.b ?? shape.a;
  const offset = shape.channelOffset ?? { index: 0, price: 0 };
  const a2: DrawingAnchor = { index: a.index + offset.index, price: a.price + offset.price };
  const b2: DrawingAnchor = { index: b.index + offset.index, price: b.price + offset.price };
  return { a, b, a2, b2, offset };
}
