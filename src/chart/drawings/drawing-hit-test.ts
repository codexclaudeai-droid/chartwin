import type { DrawingHitPart, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import { isTrendlineKind, pointToSegmentDistance } from '../../ui/workspace/drawing-utils.ts';

export interface DrawingHitTestMetrics {
  chartLeft: number;
  chartRight: number;
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
}

export interface TrendlineRenderLine {
  anchorStartX: number;
  anchorStartY: number;
  anchorEndX: number;
  anchorEndY: number;
  lineStartX: number;
  lineStartY: number;
  lineEndX: number;
  lineEndY: number;
}

export interface TrendlineTextLayout {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  isPlaceholder?: boolean;
}

export interface DrawingHitTestAdapters {
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  getTrendlineRenderLine: (shape: DrawingShape, metrics: DrawingHitTestMetrics) => TrendlineRenderLine;
  getTrendlineTextLayout: (shape: DrawingShape, metrics: DrawingHitTestMetrics, placeholder: string) => TrendlineTextLayout;
  getAnchoredVwapPlot: (shape: DrawingShape) => Array<{ index: number; vwap: number }>;
  isCoarsePointer: () => boolean;
}

export interface HitTestDrawingParams {
  shape: DrawingShape;
  mx: number;
  my: number;
  metrics: DrawingHitTestMetrics;
  hoveredDrawingId: string | null;
  hoveredDrawingPart: DrawingHitPart | null;
  adapters: DrawingHitTestAdapters;
}

export interface FindDrawingAtParams {
  drawings: DrawingShape[];
  drawingsVisible: boolean;
  selectedDrawingId: string | null;
  mx: number;
  my: number;
  metrics: DrawingHitTestMetrics | null;
  hoveredDrawingId: string | null;
  hoveredDrawingPart: DrawingHitPart | null;
  adapters: DrawingHitTestAdapters;
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / Math.max(1e-6, (yj - yi)) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function hitTestDrawing(params: HitTestDrawingParams): DrawingHitPart | null {
  const {
    shape,
    mx,
    my,
    metrics,
    hoveredDrawingId,
    hoveredDrawingPart,
    adapters,
  } = params;
  if (shape.hidden) return null;

  const ax = adapters.xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(shape.a.price);
  const bx = shape.b ? adapters.xForIndex(shape.b.index, metrics.totalSp, metrics.candleW) : ax;
  const by = shape.b ? metrics.getY(shape.b.price) : ay;
  const pad = 8;
  const isCoarsePointer = adapters.isCoarsePointer();
  const anchorHitPad = isCoarsePointer ? 25 : 8;

  if (isTrendlineKind(shape.kind)) {
    const trendline = adapters.getTrendlineRenderLine(shape, metrics);
    const lineHitPad = isCoarsePointer ? 22 : 16;
    if (Math.hypot(mx - trendline.anchorStartX, my - trendline.anchorStartY) <= anchorHitPad) return 'start';
    if (Math.hypot(mx - trendline.anchorEndX, my - trendline.anchorEndY) <= anchorHitPad) return 'end';

    const hasText = (shape.text ?? '').trim().length > 0;
    const isHoveredGuide = shape.id === hoveredDrawingId
      && (hoveredDrawingPart === 'line' || hoveredDrawingPart === 'trendline-text-guide');
    const placeholder = !hasText && isHoveredGuide ? '텍스트 입력' : '';
    const label = adapters.getTrendlineTextLayout(shape, metrics, placeholder);
    if (label.text) {
      const relX = mx - label.x;
      const relY = my - label.y;
      const c = Math.cos(-label.angle);
      const s = Math.sin(-label.angle);
      const lx = relX * c - relY * s;
      const ly = relX * s + relY * c;
      const labelPadX = label.isPlaceholder ? 42 : 8;
      const labelPadY = label.isPlaceholder ? 24 : 8;
      if (
        lx >= -label.width / 2 - labelPadX
        && lx <= label.width / 2 + labelPadX
        && ly >= -label.height - labelPadY
        && ly <= labelPadY * 1.8
      ) {
        return label.isPlaceholder ? 'trendline-text-guide' : 'body';
      }
    }

    if (pointToSegmentDistance(mx, my, trendline.lineStartX, trendline.lineStartY, trendline.lineEndX, trendline.lineEndY) <= lineHitPad) return 'line';
    const left = Math.min(trendline.lineStartX, trendline.lineEndX) - lineHitPad;
    const right = Math.max(trendline.lineStartX, trendline.lineEndX) + lineHitPad;
    const top = Math.min(trendline.lineStartY, trendline.lineEndY) - lineHitPad;
    const bottom = Math.max(trendline.lineStartY, trendline.lineEndY) + lineHitPad;
    return (mx >= left && mx <= right && my >= top && my <= bottom) ? 'body' : null;
  }

  if (shape.kind === 'hline') {
    if (mx < metrics.chartLeft || mx > metrics.chartRight) return null;
    if (Math.abs(my - ay) <= 9) return 'line';
    return Math.abs(my - ay) <= 16 ? 'body' : null;
  }

  if (shape.kind === 'anchored-vwap') {
    const avwapPlot = adapters.getAnchoredVwapPlot(shape);
    if (!avwapPlot.length) return null;
    const anchorPoint = avwapPlot[0] ?? null;
    const anchorY = anchorPoint ? metrics.getY(anchorPoint.vwap) : ay;
    if (Math.hypot(mx - ax, my - anchorY) <= anchorHitPad) return 'start';
    const lineHitPad = isCoarsePointer ? 18 : 10;
    for (let i = 0; i < avwapPlot.length - 1; i += 1) {
      const p1 = avwapPlot[i];
      const p2 = avwapPlot[i + 1];
      const x1 = adapters.xForIndex(p1.index, metrics.totalSp, metrics.candleW);
      const y1 = metrics.getY(p1.vwap);
      const x2 = adapters.xForIndex(p2.index, metrics.totalSp, metrics.candleW);
      const y2 = metrics.getY(p2.vwap);
      if (pointToSegmentDistance(mx, my, x1, y1, x2, y2) <= lineHitPad) return 'line';
    }
    const xs = avwapPlot.map((point) => adapters.xForIndex(point.index, metrics.totalSp, metrics.candleW));
    const ys = avwapPlot.map((point) => metrics.getY(point.vwap));
    return (mx >= Math.min(...xs) - pad && mx <= Math.max(...xs) + pad && my >= Math.min(...ys) - pad && my <= Math.max(...ys) + pad)
      ? 'body'
      : null;
  }

  if (shape.kind === 'draw-pencil' || shape.kind === 'draw-highlighter') {
    const points = shape.points ?? [shape.a, shape.b ?? shape.a];
    const pxy = points.map((point) => ({
      x: adapters.xForIndex(point.index, metrics.totalSp, metrics.candleW),
      y: metrics.getY(point.price),
    }));
    for (let i = 0; i < pxy.length - 1; i += 1) {
      if (pointToSegmentDistance(mx, my, pxy[i].x, pxy[i].y, pxy[i + 1].x, pxy[i + 1].y) <= pad) return 'line';
    }
    const xs = pxy.map((point) => point.x);
    const ys = pxy.map((point) => point.y);
    if (!xs.length) return null;
    return (mx >= Math.min(...xs) - pad && mx <= Math.max(...xs) + pad && my >= Math.min(...ys) - pad && my <= Math.max(...ys) + pad)
      ? 'body'
      : null;
  }

  if (shape.kind === 'draw-box') {
    const left = Math.min(ax, bx);
    const right = Math.max(ax, bx);
    const top = Math.min(ay, by);
    const bottom = Math.max(ay, by);
    if (Math.hypot(mx - left, my - top) <= anchorHitPad) return 'box-tl';
    if (Math.hypot(mx - right, my - top) <= anchorHitPad) return 'box-tr';
    if (Math.hypot(mx - right, my - bottom) <= anchorHitPad) return 'box-br';
    if (Math.hypot(mx - left, my - bottom) <= anchorHitPad) return 'box-bl';
    const onEdge = (
      (Math.abs(my - top) <= 8 && mx >= left - pad && mx <= right + pad)
      || (Math.abs(my - bottom) <= 8 && mx >= left - pad && mx <= right + pad)
      || (Math.abs(mx - left) <= 8 && my >= top - pad && my <= bottom + pad)
      || (Math.abs(mx - right) <= 8 && my >= top - pad && my <= bottom + pad)
    );
    if (onEdge) return 'line';
    return (mx >= left - pad && mx <= right + pad && my >= top - pad && my <= bottom + pad) ? 'body' : null;
  }

  if (shape.kind === 'channel') {
    const offset = shape.channelOffset ?? { index: 0, price: 0 };
    const a2 = { index: shape.a.index + offset.index, price: shape.a.price + offset.price };
    const bAnchor = shape.b ?? shape.a;
    const b2 = { index: bAnchor.index + offset.index, price: bAnchor.price + offset.price };
    const a2x = adapters.xForIndex(a2.index, metrics.totalSp, metrics.candleW);
    const a2y = metrics.getY(a2.price);
    const b2x = adapters.xForIndex(b2.index, metrics.totalSp, metrics.candleW);
    const b2y = metrics.getY(b2.price);
    if (Math.hypot(mx - ax, my - ay) <= anchorHitPad) return 'channel-a';
    if (Math.hypot(mx - bx, my - by) <= anchorHitPad) return 'channel-b';
    const baseMidX = (ax + bx) / 2;
    const baseMidY = (ay + by) / 2;
    const paraMidX = (a2x + b2x) / 2;
    const paraMidY = (a2y + b2y) / 2;
    if (mx >= baseMidX - 8 && mx <= baseMidX + 8 && my >= baseMidY - 8 && my <= baseMidY + 8) return 'channel-mid-base';
    if (mx >= paraMidX - 8 && mx <= paraMidX + 8 && my >= paraMidY - 8 && my <= paraMidY + 8) return 'channel-mid-parallel';
    const midX = (ax + bx + a2x + b2x) / 4;
    const midY = (ay + by + a2y + b2y) / 4;
    if (mx >= midX - 8 && mx <= midX + 8 && my >= midY - 8 && my <= midY + 8) return 'channel-center';
    if (Math.hypot(mx - a2x, my - a2y) <= 8 || Math.hypot(mx - b2x, my - b2y) <= 8) return 'channel-offset';
    const lineHit = pointToSegmentDistance(mx, my, ax, ay, bx, by) <= 10
      || pointToSegmentDistance(mx, my, a2x, a2y, b2x, b2y) <= 10;
    if (lineHit) return 'line';
    if (pointInPolygon(mx, my, [{ x: ax, y: ay }, { x: bx, y: by }, { x: b2x, y: b2y }, { x: a2x, y: a2y }])) return 'body';
    return (mx >= Math.min(ax, bx, a2x, b2x) - 10 && mx <= Math.max(ax, bx, a2x, b2x) + 10 && my >= Math.min(ay, by, a2y, b2y) - 10 && my <= Math.max(ay, by, a2y, b2y) + 10)
      ? 'body'
      : null;
  }

  if (shape.kind === 'fib-retracement' || shape.kind === 'fib-trend') {
    if (Math.hypot(mx - ax, my - ay) <= anchorHitPad) return 'start';
    if (Math.hypot(mx - bx, my - by) <= anchorHitPad) return 'end';
    const fibRatios = [4.236, 3.618, 2.618, 1.618, 1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
    if (shape.kind === 'fib-trend' && shape.channelOffset) {
      const cx = adapters.xForIndex(shape.a.index + shape.channelOffset.index, metrics.totalSp, metrics.candleW);
      const cy = metrics.getY(shape.a.price + shape.channelOffset.price);
      if (Math.hypot(mx - cx, my - cy) <= anchorHitPad) return 'fib-offset';
    }
    if (shape.kind === 'fib-retracement') {
      const price0 = shape.a.price;
      const price1 = shape.b ? shape.b.price : shape.a.price;
      const rangePrice = price1 - price0;
      const yValues = fibRatios.map((ratio) => metrics.getY(price0 + rangePrice * ratio));
      const x0 = Math.min(ax, bx);
      const x1 = Math.max(ax, bx);
      if (mx < x0 - pad || mx > x1 + pad || my < Math.min(...yValues) - pad || my > Math.max(...yValues) + pad) return null;
      return yValues.some((y) => Math.abs(my - y) <= 9 && mx >= x0 - pad && mx <= x1 + pad) ? 'line' : 'body';
    }
    const fibOffset = shape.channelOffset ?? { index: 0, price: 0 };
    const cPrice = shape.a.price + fibOffset.price;
    const movePrice = (shape.b?.price ?? shape.a.price) - shape.a.price;
    const cXRaw = adapters.xForIndex(shape.a.index + fibOffset.index, metrics.totalSp, metrics.candleW);
    const xStart = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.min(bx, cXRaw)));
    const xEnd = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.max(bx, cXRaw)));
    const yValues = fibRatios.map((ratio) => metrics.getY(cPrice + movePrice * ratio));
    if (xEnd - xStart > 1 && mx >= xStart - pad && mx <= xEnd + pad && my >= Math.min(...yValues) - pad && my <= Math.max(...yValues) + pad) {
      return yValues.some((y) => Math.abs(my - y) <= 9) ? 'line' : 'body';
    }
    return (
      pointToSegmentDistance(mx, my, ax, ay, bx, by) <= 9
      || pointToSegmentDistance(mx, my, bx, by, cXRaw, metrics.getY(cPrice)) <= 9
    ) ? 'line' : null;
  }

  if (shape.kind === 'long-position' || shape.kind === 'short-position') {
    const positionAnchorHitPad = isCoarsePointer ? 28 : 20;
    const targetOffset = shape.channelOffset ?? { index: 0, price: 0 };
    const tx = adapters.xForIndex(shape.a.index + targetOffset.index, metrics.totalSp, metrics.candleW);
    const ty = metrics.getY(shape.a.price + targetOffset.price);
    let posLeft = Math.min(ax, tx);
    let posRight = Math.max(ax, tx);
    const minBoxWidthPx = 228;
    if (Math.abs(posRight - posLeft) < minBoxWidthPx) {
      if (tx >= ax) {
        posLeft = ax;
        posRight = ax + minBoxWidthPx;
      } else {
        posRight = ax;
        posLeft = ax - minBoxWidthPx;
      }
    }
    if (Math.hypot(mx - posLeft, my - ay) <= positionAnchorHitPad) return 'start';
    if (Math.hypot(mx - posLeft, my - by) <= positionAnchorHitPad) return 'end';
    if (shape.channelOffset && Math.hypot(mx - posLeft, my - ty) <= positionAnchorHitPad) return 'position-target';
    if (Math.hypot(mx - posRight, my - ay) <= positionAnchorHitPad) return 'position-right';
    if (mx >= posRight - (positionAnchorHitPad + 8) && mx <= posRight + (positionAnchorHitPad + 8) && my >= ay - (positionAnchorHitPad + 8) && my <= ay + (positionAnchorHitPad + 8)) return 'position-right';
    if (mx >= posLeft - (positionAnchorHitPad + 6) && mx <= posLeft + (positionAnchorHitPad + 6) && my >= by - (positionAnchorHitPad + 6) && my <= by + (positionAnchorHitPad + 6)) return 'end';
    if (shape.channelOffset && mx >= posLeft - (positionAnchorHitPad + 6) && mx <= posLeft + (positionAnchorHitPad + 6) && my >= ty - (positionAnchorHitPad + 6) && my <= ty + (positionAnchorHitPad + 6)) return 'position-target';
    const badgeCenterX = (posLeft + posRight) / 2;
    const badgeW = Math.max(86, Math.abs(posRight - posLeft) * 0.62);
    const badgeH = 20;
    if (mx >= badgeCenterX - badgeW / 2 && mx <= badgeCenterX + badgeW / 2 && my >= ay - badgeH / 2 && my <= ay + badgeH / 2) return 'position-entry-info';
    if (Math.abs(my - ty) <= 7 && mx >= posLeft - 4 && mx <= posRight + 4) return 'position-target';
    if (Math.abs(my - by) <= 7 && mx >= posLeft - 4 && mx <= posRight + 4) return 'end';
    return (mx >= posLeft - pad && mx <= posRight + pad && my >= Math.min(ay, by, ty) - pad && my <= Math.max(ay, by, ty) + pad) ? 'body' : null;
  }

  if (shape.kind === 'measure') {
    if (Math.hypot(mx - ax, my - ay) <= 10) return 'start';
    if (Math.hypot(mx - bx, my - by) <= 10) return 'end';
    return (mx >= Math.min(ax, bx) - pad && mx <= Math.max(ax, bx) + pad && my >= Math.min(ay, by) - pad && my <= Math.max(ay, by) + pad) ? 'body' : null;
  }

  if (shape.kind === 'text-note') {
    const text = shape.text ?? '텍스트';
    const textWidth = Math.max(40, text.length * 7 + 12);
    const textHeight = 22;
    return (mx >= ax - pad && mx <= ax + textWidth + pad && my >= ay - textHeight - pad && my <= ay + pad) ? 'body' : null;
  }

  return null;
}

export function findDrawingAt(params: FindDrawingAtParams): { shape: DrawingShape; part: DrawingHitPart } | null {
  const {
    drawings,
    drawingsVisible,
    selectedDrawingId,
    mx,
    my,
    metrics,
    hoveredDrawingId,
    hoveredDrawingPart,
    adapters,
  } = params;
  if (!drawingsVisible || !metrics) return null;
  if (selectedDrawingId) {
    const selected = drawings.find((shape) => shape.id === selectedDrawingId) ?? null;
    if (selected) {
      const part = hitTestDrawing({ shape: selected, mx, my, metrics, hoveredDrawingId, hoveredDrawingPart, adapters });
      if (part) return { shape: selected, part };
    }
  }
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const shape = drawings[i];
    if (shape.id === selectedDrawingId) continue;
    const part = hitTestDrawing({ shape, mx, my, metrics, hoveredDrawingId, hoveredDrawingPart, adapters });
    if (part) return { shape, part };
  }
  return null;
}
