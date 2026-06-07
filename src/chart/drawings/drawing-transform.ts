import type { DrawingAnchor, DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import {
  cloneDrawingShape,
  getDrawingPointPartIndex,
  getDrawingShapePoints,
  isPatternDrawingKind,
  isSingleAnchorLineKind,
  isTrendlineKind,
} from '../../ui/workspace/drawing-utils.ts';

export interface DrawingTransformMetrics {
  totalSp: number;
  mainH: number;
  top: number;
  range: number;
}

export interface MoveDrawingByDeltaParams {
  base: DrawingShape;
  dx: number;
  dy: number;
  part?: DrawingHitPart;
  metrics: DrawingTransformMetrics | null;
  dataLength: number;
  applyMagnet: (anchor: DrawingAnchor) => DrawingAnchor;
}

function cloneShape(shape: DrawingShape): DrawingShape {
  return cloneDrawingShape(shape);
}

function projectAnchorPriceOnLine(lineA: DrawingAnchor, lineB: DrawingAnchor, index: number): number {
  const dx = lineB.index - lineA.index;
  if (Math.abs(dx) < 1e-9) return lineB.price;
  const t = (index - lineA.index) / dx;
  return lineA.price + ((lineB.price - lineA.price) * t);
}

function interpolateAnchorOnLine(lineA: DrawingAnchor, lineB: DrawingAnchor, t: number): DrawingAnchor {
  return {
    index: lineA.index + ((lineB.index - lineA.index) * t),
    price: lineA.price + ((lineB.price - lineA.price) * t),
  };
}

function getAnchorLineRatio(lineA: DrawingAnchor, lineB: DrawingAnchor, point: DrawingAnchor): number {
  const dx = lineB.index - lineA.index;
  if (Math.abs(dx) >= 1e-9) return (point.index - lineA.index) / dx;
  const dy = lineB.price - lineA.price;
  if (Math.abs(dy) >= 1e-9) return (point.price - lineA.price) / dy;
  return 1;
}

function snapTriangleExtensionAnchors(
  points: DrawingAnchor[],
  previousPoints: DrawingAnchor[],
  movedPointIndex: number | null,
): DrawingAnchor[] {
  if (points.length <= 4) return points;
  const [a, b, c, d] = points;
  const [previousA, previousB, previousC, previousD] = previousPoints;
  const shouldPreserveGuideRatio = movedPointIndex == null || movedPointIndex < 4;
  return points.map((point, index) => {
    if (index < 4) return point;
    const useLowerGuide = index % 2 === 0;
    const guideA = useLowerGuide ? a : b;
    const guideB = useLowerGuide ? c : d;
    if (shouldPreserveGuideRatio) {
      const previousGuideA = useLowerGuide ? previousA : previousB;
      const previousGuideB = useLowerGuide ? previousC : previousD;
      const previousPoint = previousPoints[index] ?? point;
      const ratio = getAnchorLineRatio(previousGuideA, previousGuideB, previousPoint);
      return interpolateAnchorOnLine(guideA, guideB, ratio);
    }
    return {
      ...point,
      price: projectAnchorPriceOnLine(guideA, guideB, point.index),
    };
  });
}

export function moveDrawingByDelta(params: MoveDrawingByDeltaParams): DrawingShape {
  const { base, dx, dy, part = 'line', metrics, dataLength, applyMagnet } = params;
  if (!metrics) return cloneShape(base);

  const deltaIndex = dx / Math.max(1e-6, metrics.totalSp);
  const deltaPrice = -(dy / Math.max(1, metrics.mainH - metrics.top)) * metrics.range;
  const maxIndex = Math.max(0, dataLength - 1);
  const moveAnchor = (anchor: DrawingAnchor): DrawingAnchor => {
    const raw: DrawingAnchor = {
      index: Math.max(0, Math.min(maxIndex, anchor.index + deltaIndex)),
      price: anchor.price + deltaPrice,
    };
    return applyMagnet(raw);
  };
  const moveAnchorRaw = (anchor: DrawingAnchor): DrawingAnchor => ({
    index: Math.max(0, Math.min(maxIndex, anchor.index + deltaIndex)),
    price: anchor.price + deltaPrice,
  });

  if (base.locked) return cloneShape(base);

  if (isPatternDrawingKind(base.kind)) {
    const next = cloneShape(base);
    const previousPoints = getDrawingShapePoints(base).map((point) => ({ ...point }));
    const points = getDrawingShapePoints(base).map((point) => ({ ...point }));
    const pointIndex = getDrawingPointPartIndex(part);
    if (pointIndex != null && points[pointIndex]) {
      points[pointIndex] = moveAnchor(points[pointIndex]);
    } else {
      for (let i = 0; i < points.length; i += 1) {
        points[i] = moveAnchor(points[i]);
      }
    }
    const nextPoints = base.kind === 'triangle-pattern'
      ? snapTriangleExtensionAnchors(points, previousPoints, pointIndex)
      : points;
    next.points = nextPoints;
    next.a = nextPoints[0] ?? next.a;
    next.b = nextPoints[nextPoints.length - 1] ?? next.b;
    return next;
  }

  if (isSingleAnchorLineKind(base.kind)) {
    if (part === 'start' || part === 'line' || part === 'body') {
      return {
        ...cloneShape(base),
        a: moveAnchor(base.a),
        b: undefined,
      };
    }
  }

  if (isTrendlineKind(base.kind)) {
    if (part === 'start') {
      return {
        ...cloneShape(base),
        a: moveAnchor(base.a),
        b: base.b ? { ...base.b } : base.b,
      };
    }
    if (part === 'end' && base.b) {
      return {
        ...cloneShape(base),
        a: { ...base.a },
        b: moveAnchor(base.b),
      };
    }
  }

  if (base.kind === 'anchored-vwap') {
    if (part === 'start' || part === 'line' || part === 'body') {
      return {
        ...cloneShape(base),
        a: moveAnchor(base.a),
        b: undefined,
      };
    }
  }

  if (base.kind === 'fib-retracement' || base.kind === 'fib-trend') {
    const next = cloneShape(base);
    if (part === 'start') {
      return {
        ...next,
        a: moveAnchor(base.a),
        b: base.b ? { ...base.b } : base.b,
      };
    }
    if (part === 'end' && base.b) {
      return {
        ...next,
        a: { ...base.a },
        b: moveAnchor(base.b),
      };
    }
    if (base.kind === 'fib-trend' && part === 'fib-offset') {
      if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
      next.channelOffset = {
        index: next.channelOffset.index + deltaIndex,
        price: next.channelOffset.price + deltaPrice,
      };
      return next;
    }
    if (part === 'line' || part === 'body') {
      return {
        ...next,
        a: moveAnchor(base.a),
        b: base.b ? moveAnchor(base.b) : base.b,
      };
    }
  }

  if (base.kind === 'long-position' || base.kind === 'short-position') {
    const next = cloneShape(base);
    if (part === 'start') {
      next.a = moveAnchor(base.a);
      return next;
    }
    if (part === 'end' || part === 'position-stop') {
      if (!base.b) return next;
      next.b = { index: base.a.index, price: base.b.price + deltaPrice };
      return next;
    }
    if (part === 'position-target') {
      if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
      next.channelOffset = {
        index: next.channelOffset.index,
        price: next.channelOffset.price + deltaPrice,
      };
      return next;
    }
    if (part === 'position-right') {
      if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
      const minOffsetIndex = 228 / Math.max(1e-6, metrics.totalSp);
      const rawNextIndex = next.channelOffset.index + deltaIndex;
      next.channelOffset = {
        index: rawNextIndex >= 0
          ? Math.max(minOffsetIndex, rawNextIndex)
          : Math.min(-minOffsetIndex, rawNextIndex),
        price: next.channelOffset.price,
      };
      return next;
    }
    if (part === 'position-entry-info') return next;
    if (part === 'line' || part === 'body') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
  }

  if (base.kind === 'measure') {
    const next = cloneShape(base);
    if (part === 'start') {
      next.a = moveAnchor(base.a);
      return next;
    }
    if (part === 'end' && base.b) {
      next.b = moveAnchor(base.b);
      return next;
    }
    if (part === 'line' || part === 'body') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
  }

  if (base.kind === 'draw-pencil' || base.kind === 'draw-highlighter') {
    const next = cloneShape(base);
    const points = (base.points ?? [base.a, base.b ?? base.a]).map((point) => moveAnchorRaw(point));
    next.points = points;
    next.a = points[0] ?? next.a;
    next.b = points[points.length - 1] ?? next.b;
    return next;
  }

  if (base.kind === 'draw-box') {
    const next = cloneShape(base);
    const a0 = { ...base.a };
    const b0 = base.b ? { ...base.b } : { ...base.a };
    const left = Math.min(a0.index, b0.index);
    const right = Math.max(a0.index, b0.index);
    const top = Math.max(a0.price, b0.price);
    const bottom = Math.min(a0.price, b0.price);
    const moved = moveAnchor({ index: left, price: top });
    const movedTR = moveAnchor({ index: right, price: top });
    const movedBR = moveAnchor({ index: right, price: bottom });
    const movedBL = moveAnchor({ index: left, price: bottom });
    if (part === 'box-tl') {
      next.a = { index: moved.index, price: moved.price };
      next.b = { index: right, price: bottom };
      return next;
    }
    if (part === 'box-tr') {
      next.a = { index: left, price: movedTR.price };
      next.b = { index: movedTR.index, price: bottom };
      return next;
    }
    if (part === 'box-br') {
      next.a = { index: left, price: top };
      next.b = { index: movedBR.index, price: movedBR.price };
      return next;
    }
    if (part === 'box-bl') {
      next.a = { index: movedBL.index, price: top };
      next.b = { index: right, price: movedBL.price };
      return next;
    }
    if (part === 'start') {
      next.a = moveAnchor(base.a);
      return next;
    }
    if (part === 'end' && base.b) {
      next.b = moveAnchor(base.b);
      return next;
    }
    if (part === 'line' || part === 'body') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
  }

  if (base.kind === 'draw-circle') {
    const next = cloneShape(base);
    if (part === 'start') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
    if (part === 'end' && base.b) {
      next.b = moveAnchor(base.b);
      return next;
    }
    if (part === 'line' || part === 'body') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
  }

  if (base.kind === 'channel') {
    const next = cloneShape(base);
    if (!next.channelOffset) next.channelOffset = { index: 0, price: 0 };
    if (part === 'channel-a') {
      next.a = moveAnchor(base.a);
      return next;
    }
    if (part === 'channel-b' && base.b) {
      next.b = moveAnchor(base.b);
      return next;
    }
    if (part === 'channel-offset') {
      next.channelOffset = {
        index: next.channelOffset.index + deltaIndex,
        price: next.channelOffset.price + deltaPrice,
      };
      return next;
    }
    if (part === 'channel-mid-base') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      next.channelOffset = {
        index: next.channelOffset.index - deltaIndex,
        price: next.channelOffset.price - deltaPrice,
      };
      return next;
    }
    if (part === 'channel-mid-parallel') {
      next.channelOffset = {
        index: next.channelOffset.index + deltaIndex,
        price: next.channelOffset.price + deltaPrice,
      };
      return next;
    }
    if (part === 'channel-center' || part === 'line' || part === 'body') {
      next.a = moveAnchor(base.a);
      next.b = base.b ? moveAnchor(base.b) : base.b;
      return next;
    }
  }

  return {
    id: base.id,
    kind: base.kind,
    a: moveAnchor(base.a),
    b: base.b ? moveAnchor(base.b) : undefined,
    text: base.text,
    color: base.color,
    width: base.width,
    lineStyle: base.lineStyle,
    channelOffset: base.channelOffset ? { ...base.channelOffset } : undefined,
    hidden: base.hidden,
    locked: base.locked,
    alert: base.alert ? { ...base.alert } : undefined,
    position: base.position ? { ...base.position } : undefined,
  };
}
