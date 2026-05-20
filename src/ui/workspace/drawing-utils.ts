import type {
  DrawingAnchor,
  DrawingDraft,
  DrawingShape,
  TrendlineDrawingToolId,
} from './drawing-types';

type ScreenPoint = {
  x: number;
  y: number;
};

type ScreenBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function isTrendlineKind(kind: string | null | undefined): kind is TrendlineDrawingToolId {
  return kind === 'trendline' || kind === 'extended-trendline' || kind === 'ray-trendline';
}

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
    avwap: shape.avwap ? {
      ...shape.avwap,
      bands: shape.avwap.bands.map((band) => ({ ...band })) as typeof shape.avwap.bands,
    } : undefined,
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

function uniqueScreenPoints(points: Array<ScreenPoint & { t: number }>): Array<ScreenPoint & { t: number }> {
  return points.filter((point, index) => (
    points.findIndex((candidate) => (
      Math.abs(candidate.x - point.x) < 1e-6
      && Math.abs(candidate.y - point.y) < 1e-6
    )) === index
  ));
}

function getLineBoundsIntersections(
  a: ScreenPoint,
  b: ScreenPoint,
  bounds: ScreenBounds,
): Array<ScreenPoint & { t: number }> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const hits: Array<ScreenPoint & { t: number }> = [];
  const pushIfInside = (t: number, x: number, y: number) => {
    if (
      Number.isFinite(t)
      && x >= bounds.left - 1e-6
      && x <= bounds.right + 1e-6
      && y >= bounds.top - 1e-6
      && y <= bounds.bottom + 1e-6
    ) {
      hits.push({ t, x, y });
    }
  };

  if (Math.abs(dx) > 1e-9) {
    const leftT = (bounds.left - a.x) / dx;
    pushIfInside(leftT, bounds.left, a.y + leftT * dy);
    const rightT = (bounds.right - a.x) / dx;
    pushIfInside(rightT, bounds.right, a.y + rightT * dy);
  }
  if (Math.abs(dy) > 1e-9) {
    const topT = (bounds.top - a.y) / dy;
    pushIfInside(topT, a.x + topT * dx, bounds.top);
    const bottomT = (bounds.bottom - a.y) / dy;
    pushIfInside(bottomT, a.x + bottomT * dx, bounds.bottom);
  }

  return uniqueScreenPoints(hits);
}

export function getTrendlineScreenLine(
  a: ScreenPoint,
  b: ScreenPoint,
  bounds: ScreenBounds,
  kind: TrendlineDrawingToolId,
): { x1: number; y1: number; x2: number; y2: number } {
  if (kind === 'trendline' || (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9)) {
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  const intersections = getLineBoundsIntersections(a, b, bounds);
  if (intersections.length < 2) {
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  if (kind === 'extended-trendline') {
    const sorted = intersections.slice().sort((left, right) => left.t - right.t);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
  }

  const forward = intersections
    .filter((point) => point.t >= 1 - 1e-6)
    .sort((left, right) => right.t - left.t)[0];
  if (!forward) {
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  return { x1: a.x, y1: a.y, x2: forward.x, y2: forward.y };
}
