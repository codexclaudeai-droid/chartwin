import type {
  DrawingAnchor,
  DrawingDraft,
  DrawingShape,
  PatternDrawingToolId,
} from '../../ui/workspace/drawing-types.ts';
import {
  getDrawingShapePoints,
  getPatternPointLabels,
  isPatternDrawingKind,
} from '../../ui/workspace/drawing-utils.ts';
import type {
  DrawingAxisMetrics,
  DrawingChartBounds,
  DrawingLineStyle,
  DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';
import {
  drawPriceArrowBox,
  getPriceArrowTextAnchor,
} from './drawing-renderer-utils.ts';

export type DrawingPatternMetrics = DrawingViewportMetrics & DrawingChartBounds & DrawingAxisMetrics;

type PatternScreenPoint = { x: number; y: number };

export interface RenderDrawingPatternParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingPatternMetrics;
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  fontStack: string;
  formatPrice: (value: number) => string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

function dashForStyle(style: DrawingLineStyle): number[] {
  if (style === 'dash') return [7, 5];
  if (style === 'dot') return [2, 4];
  return [];
}

function shouldClosePattern(kind: PatternDrawingToolId): boolean {
  return kind === 'xabcd-pattern'
    || kind === 'cypher-pattern'
    || kind === 'abcd-pattern'
    || kind === 'triangle-pattern'
    || kind === 'head-shoulders-pattern';
}

function drawRoundedBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font: string;
    minWidth: number;
    height: number;
    radius: number;
    fill: string;
    textColor: string;
    stroke?: string;
  },
): void {
  ctx.save();
  ctx.font = options.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = Math.max(options.minWidth, ctx.measureText(text).width + 10);
  ctx.fillStyle = options.fill;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - options.height / 2, width, options.height, options.radius);
  ctx.fill();
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = options.textColor;
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function safeRatio(numerator: number, denominator: number): number | null {
  const base = Math.abs(denominator);
  if (base < 1e-9) return null;
  return Math.abs(numerator) / base;
}

function calculateXabcdRatios(anchors: DrawingAnchor[]): {
  AB_XA: number | null;
  BC_AB: number | null;
  CD_BC: number | null;
  XD_XA: number | null;
} {
  const [x, a, b, c, d] = anchors;
  return {
    AB_XA: x && a && b ? safeRatio(b.price - a.price, a.price - x.price) : null,
    BC_AB: a && b && c ? safeRatio(c.price - b.price, b.price - a.price) : null,
    CD_BC: b && c && d ? safeRatio(d.price - c.price, c.price - b.price) : null,
    XD_XA: x && a && d ? safeRatio(d.price - x.price, a.price - x.price) : null,
  };
}

function drawSegment(ctx: CanvasRenderingContext2D, from: PatternScreenPoint, to: PatternScreenPoint): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawRatioBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  from: PatternScreenPoint,
  to: PatternScreenPoint,
  fontStack: string,
  offsetY = 0,
): void {
  drawRoundedBadge(ctx, text, (from.x + to.x) / 2, ((from.y + to.y) / 2) + offsetY, {
    font: `700 12px ${fontStack}`,
    minWidth: 42,
    height: 22,
    radius: 5,
    fill: '#2f6cff',
    textColor: '#ffffff',
  });
}

function drawAnchorLabel(
  ctx: CanvasRenderingContext2D,
  point: PatternScreenPoint,
  label: string,
  index: number,
  fontStack: string,
): void {
  const offsets = [
    { x: 0, y: 22 },
    { x: 0, y: -22 },
    { x: 0, y: 22 },
    { x: 0, y: -22 },
    { x: 0, y: 22 },
  ];
  const offset = offsets[index] ?? { x: 0, y: -22 };
  drawRoundedBadge(ctx, label, point.x + offset.x, point.y + offset.y, {
    font: `700 12px ${fontStack}`,
    minWidth: 22,
    height: 24,
    radius: 5,
    fill: '#2f6cff',
    textColor: '#ffffff',
  });
}

function getProjectedY(from: PatternScreenPoint, to: PatternScreenPoint, x: number): number {
  const dx = to.x - from.x;
  if (Math.abs(dx) < 1e-6) return to.y;
  const t = (x - from.x) / dx;
  return from.y + ((to.y - from.y) * t);
}

function getSegmentLineIntersection(
  segmentA: PatternScreenPoint,
  segmentB: PatternScreenPoint,
  lineA: PatternScreenPoint,
  lineB: PatternScreenPoint,
): PatternScreenPoint | null {
  const segmentDx = segmentB.x - segmentA.x;
  const segmentDy = segmentB.y - segmentA.y;
  const lineDx = lineB.x - lineA.x;
  const lineDy = lineB.y - lineA.y;
  const denominator = (segmentDx * lineDy) - (segmentDy * lineDx);
  if (Math.abs(denominator) < 1e-6) return null;
  const sourceDx = lineA.x - segmentA.x;
  const sourceDy = lineA.y - segmentA.y;
  const t = ((sourceDx * lineDy) - (sourceDy * lineDx)) / denominator;
  if (t < -1e-6 || t > 1 + 1e-6) return null;
  return {
    x: segmentA.x + (segmentDx * t),
    y: segmentA.y + (segmentDy * t),
  };
}

function isSamePoint(a: PatternScreenPoint, b: PatternScreenPoint): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

function drawHeadShouldersLabel(
  ctx: CanvasRenderingContext2D,
  point: PatternScreenPoint,
  label: string,
  fontStack: string,
): void {
  drawRoundedBadge(ctx, label, point.x, point.y - 22, {
    font: `700 13px ${fontStack}`,
    minWidth: 44,
    height: 28,
    radius: 5,
    fill: '#00a68f',
    textColor: '#ffffff',
  });
}

function drawHeadShouldersNeckline(
  ctx: CanvasRenderingContext2D,
  metrics: DrawingPatternMetrics,
  neckLeft: PatternScreenPoint,
  neckRight: PatternScreenPoint,
): void {
  const fromX = metrics.chartLeft;
  const toX = metrics.chartRight;
  const fromY = getProjectedY(neckLeft, neckRight, fromX);
  const toY = getProjectedY(neckLeft, neckRight, toX);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function fillPeakAboveNeckline(
  ctx: CanvasRenderingContext2D,
  metrics: DrawingPatternMetrics,
  leftBase: PatternScreenPoint,
  peak: PatternScreenPoint,
  rightBase: PatternScreenPoint,
  neckLeft: PatternScreenPoint,
  neckRight: PatternScreenPoint,
): void {
  const leftBaseNeckY = getProjectedY(neckLeft, neckRight, leftBase.x);
  const rightBaseNeckY = getProjectedY(neckLeft, neckRight, rightBase.x);
  if (!isSamePoint(leftBase, neckLeft) && leftBase.y < leftBaseNeckY - 1e-6) return;
  if (!isSamePoint(rightBase, neckRight) && rightBase.y < rightBaseNeckY - 1e-6) return;
  const leftNeck = getSegmentLineIntersection(leftBase, peak, neckLeft, neckRight);
  const rightNeck = getSegmentLineIntersection(peak, rightBase, neckLeft, neckRight);
  if (!leftNeck || !rightNeck) return;
  const peakNeckY = getProjectedY(neckLeft, neckRight, peak.x);
  if (peak.y >= peakNeckY) return;

  const leftX = Math.max(metrics.chartLeft, Math.min(metrics.chartRight, leftNeck.x));
  const rightX = Math.max(metrics.chartLeft, Math.min(metrics.chartRight, rightNeck.x));
  const leftY = leftX === leftNeck.x ? leftNeck.y : getProjectedY(neckLeft, neckRight, leftX);
  const rightY = rightX === rightNeck.x ? rightNeck.y : getProjectedY(neckLeft, neckRight, rightX);

  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(peak.x, peak.y);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
}

function drawHeadShouldersFillAboveNeckline(
  ctx: CanvasRenderingContext2D,
  metrics: DrawingPatternMetrics,
  screenPoints: PatternScreenPoint[],
): void {
  if (screenPoints.length < 5) return;
  const neckLeft = screenPoints[2];
  const neckRight = screenPoints[4];
  ctx.save();
  fillPeakAboveNeckline(ctx, metrics, screenPoints[0], screenPoints[1], neckLeft, neckLeft, neckRight);
  fillPeakAboveNeckline(ctx, metrics, neckLeft, screenPoints[3], neckRight, neckLeft, neckRight);
  if (screenPoints.length >= 6) {
    const rightShoulderBase = screenPoints[6] ?? { x: screenPoints[5].x, y: getProjectedY(neckLeft, neckRight, screenPoints[5].x) };
    fillPeakAboveNeckline(ctx, metrics, neckRight, screenPoints[5], rightShoulderBase, neckLeft, neckRight);
  }
  ctx.restore();
}

function getLineIntersection(
  firstA: PatternScreenPoint,
  firstB: PatternScreenPoint,
  secondA: PatternScreenPoint,
  secondB: PatternScreenPoint,
): PatternScreenPoint | null {
  const firstDx = firstB.x - firstA.x;
  const firstDy = firstB.y - firstA.y;
  const secondDx = secondB.x - secondA.x;
  const secondDy = secondB.y - secondA.y;
  const denominator = (firstDx * secondDy) - (firstDy * secondDx);
  if (Math.abs(denominator) < 1e-6) return null;
  const sourceDx = secondA.x - firstA.x;
  const sourceDy = secondA.y - firstA.y;
  const t = ((sourceDx * secondDy) - (sourceDy * secondDx)) / denominator;
  return {
    x: firstA.x + (firstDx * t),
    y: firstA.y + (firstDy * t),
  };
}

function getTriangleGuideApex(
  a: PatternScreenPoint,
  b: PatternScreenPoint,
  c: PatternScreenPoint,
  d: PatternScreenPoint,
  metrics: DrawingPatternMetrics,
): PatternScreenPoint {
  const apex = getLineIntersection(b, d, a, c);
  if (apex && apex.x > Math.max(c.x, d.x)) return apex;
  const fallbackX = Math.min(metrics.chartRight, Math.max(c.x, d.x) + Math.max(60, (d.x - a.x) * 0.36));
  return {
    x: fallbackX,
    y: (getProjectedY(b, d, fallbackX) + getProjectedY(a, c, fallbackX)) / 2,
  };
}

function renderTrianglePattern(
  params: RenderDrawingPatternParams,
  screenPoints: PatternScreenPoint[],
  labels: string[],
  isActive: boolean,
): boolean {
  if (params.shape.kind !== 'triangle-pattern' || screenPoints.length < 4) return false;

  const {
    ctx,
    metrics,
    alpha,
    strokeColor,
    strokeWidth,
    fontStack,
  } = params;
  const [a, b, c, d] = screenPoints;
  const apex = getTriangleGuideApex(a, b, c, d, metrics);
  const leftTop = { x: a.x, y: getProjectedY(b, d, a.x) };

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(leftTop.x, leftTop.y);
  ctx.lineTo(apex.x, apex.y);
  ctx.closePath();
  ctx.fillStyle = strokeColor;
  ctx.globalAlpha = Math.min(alpha * 0.15, 0.22);
  ctx.fill();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 8]);
  drawSegment(ctx, leftTop, apex);
  drawSegment(ctx, a, apex);
  drawSegment(ctx, a, leftTop);

  ctx.setLineDash([]);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, strokeWidth * 1.2);
  drawSegment(ctx, a, b);
  drawSegment(ctx, b, c);
  drawSegment(ctx, c, d);

  screenPoints.slice(0, 4).forEach((point, index) => {
    const label = labels[index] ?? String(index + 1);
    const radius = isActive ? 5 : 4.2;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#2f6cff';
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawRoundedBadge(ctx, label, point.x, point.y + (index === 0 || index === 2 ? 22 : -22), {
      font: `700 12px ${fontStack}`,
      minWidth: 22,
      height: 24,
      radius: 5,
      fill: strokeColor,
      textColor: '#ffffff',
    });
  });

  ctx.restore();
  return true;
}

function calculateThreeDriveRatios(points: PatternScreenPoint[]): {
  A_B: number | null;
  B_C: number | null;
} {
  const [drive1, correctionA, drive2, correctionB, drive3, correctionC] = points;
  return {
    A_B: drive1 && correctionA && drive2 && correctionB
      ? safeRatio(drive2.y - correctionB.y, drive1.y - correctionA.y)
      : null,
    B_C: drive2 && correctionB && drive3 && correctionC
      ? safeRatio(drive3.y - correctionC.y, drive2.y - correctionB.y)
      : null,
  };
}

function renderThreeDrivesPattern(
  params: RenderDrawingPatternParams,
  screenPoints: PatternScreenPoint[],
  labels: string[],
  isActive: boolean,
): boolean {
  if (params.shape.kind !== 'three-drives-pattern' || screenPoints.length < 4) return false;
  void labels;

  const {
    ctx,
    alpha,
    strokeColor,
    strokeWidth,
    fontStack,
  } = params;
  const ratios = calculateThreeDriveRatios(screenPoints);
  const [, a, , b, , c] = screenPoints;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, strokeWidth * 1.2);
  ctx.setLineDash([]);
  for (let i = 1; i < Math.min(screenPoints.length, 7); i += 1) {
    drawSegment(ctx, screenPoints[i - 1], screenPoints[i]);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = Math.min(alpha * 0.85, 0.95);
  ctx.setLineDash([2, 8]);
  if (screenPoints.length >= 4) drawSegment(ctx, a, b);
  if (screenPoints.length >= 6) drawSegment(ctx, b, c);
  ctx.setLineDash([]);
  ctx.globalAlpha = alpha;

  if (screenPoints.length >= 4 && ratios.A_B !== null) drawRatioBadge(ctx, ratios.A_B.toFixed(2), a, b, fontStack, 0);
  if (screenPoints.length >= 6 && ratios.B_C !== null) drawRatioBadge(ctx, ratios.B_C.toFixed(2), b, c, fontStack, 0);

  screenPoints.slice(0, 7).forEach((point) => {
    const radius = isActive ? 5 : 4.2;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#2f6cff';
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
  return true;
}

function calculateAbcdRatios(anchors: DrawingAnchor[]): {
  AC_AB: number | null;
  BD_BC: number | null;
} {
  const [a, b, c, d] = anchors;
  return {
    AC_AB: a && b && c ? safeRatio(c.price - b.price, b.price - a.price) : null,
    BD_BC: b && c && d ? safeRatio(d.price - c.price, c.price - b.price) : null,
  };
}

function renderAbcdPattern(
  params: RenderDrawingPatternParams,
  anchors: DrawingAnchor[],
  screenPoints: PatternScreenPoint[],
  labels: string[],
  isActive: boolean,
): boolean {
  if (params.shape.kind !== 'abcd-pattern' || screenPoints.length < 3) return false;

  const {
    ctx,
    alpha,
    strokeColor,
    strokeWidth,
    fontStack,
  } = params;
  const [a, b, c, d] = screenPoints;
  const ratios = calculateAbcdRatios(anchors);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, strokeWidth * 1.2);
  ctx.setLineDash([]);
  for (let i = 1; i < Math.min(screenPoints.length, 4); i += 1) {
    drawSegment(ctx, screenPoints[i - 1], screenPoints[i]);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = Math.min(alpha * 0.85, 0.95);
  ctx.setLineDash([2, 8]);
  if (screenPoints.length >= 3) drawSegment(ctx, a, c);
  if (screenPoints.length >= 4) drawSegment(ctx, b, d);
  ctx.setLineDash([]);
  ctx.globalAlpha = alpha;

  if (screenPoints.length >= 3 && ratios.AC_AB !== null) drawRatioBadge(ctx, ratios.AC_AB.toFixed(3), a, c, fontStack, 0);
  if (screenPoints.length >= 4 && ratios.BD_BC !== null) drawRatioBadge(ctx, ratios.BD_BC.toFixed(3), b, d, fontStack, 0);

  screenPoints.slice(0, 4).forEach((point, index) => {
    const label = labels[index] ?? String(index + 1);
    const radius = isActive ? 5 : 4.2;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#2f6cff';
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawRoundedBadge(ctx, label, point.x, point.y + (index === 0 || index === 2 ? 22 : -22), {
      font: `700 12px ${fontStack}`,
      minWidth: 22,
      height: 24,
      radius: 5,
      fill: strokeColor,
      textColor: '#ffffff',
    });
  });

  ctx.restore();
  return true;
}

function renderHeadShouldersPattern(
  params: RenderDrawingPatternParams,
  anchors: DrawingAnchor[],
  screenPoints: PatternScreenPoint[],
  isActive: boolean,
): boolean {
  if (params.shape.kind !== 'head-shoulders-pattern' || screenPoints.length < 2) return false;

  const {
    ctx,
    metrics,
    alpha,
    strokeColor,
    strokeWidth,
    fontStack,
    formatPrice,
    isDraft,
  } = params;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (screenPoints.length >= 5) {
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = Math.min(alpha * 0.16, 0.22);
    drawHeadShouldersFillAboveNeckline(ctx, metrics, screenPoints);
    ctx.globalAlpha = alpha;
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, strokeWidth * 1.2);
  ctx.setLineDash([]);
  for (let i = 1; i < Math.min(screenPoints.length, 7); i += 1) {
    drawSegment(ctx, screenPoints[i - 1], screenPoints[i]);
  }

  if (screenPoints.length >= 5) {
    const neckLeft = screenPoints[2];
    const neckRight = screenPoints[4];
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = Math.min(alpha * 0.9, 0.95);
    ctx.setLineDash([1, 9]);
    drawHeadShouldersNeckline(ctx, metrics, neckLeft, neckRight);
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;
  }

  screenPoints.slice(0, 7).forEach((point) => {
    const radius = isActive ? 5 : 4.2;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#2f6cff';
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  if (screenPoints.length >= 2) drawHeadShouldersLabel(ctx, screenPoints[1], '왼어깨', fontStack);
  if (screenPoints.length >= 4) drawHeadShouldersLabel(ctx, screenPoints[3], '머리', fontStack);
  if (screenPoints.length >= 6) drawHeadShouldersLabel(ctx, screenPoints[5], '오른어깨', fontStack);

  if (!isDraft) {
    anchors.slice(0, 7).forEach((anchor, index) => {
      drawXabcdAxisPriceLabel(ctx, metrics, screenPoints[index].y, formatPrice(anchor.price), fontStack);
    });
  }

  ctx.restore();
  return true;
}

function drawXabcdAxisPriceLabel(
  ctx: CanvasRenderingContext2D,
  metrics: DrawingPatternMetrics,
  y: number,
  text: string,
  fontStack: string,
): void {
  const arrowDepth = 5;
  const height = 22;
  const width = Math.max(58, metrics.axisPad - 4);
  const x = metrics.axisSide === 'right'
    ? metrics.axisLeft
    : Math.max(0, metrics.axisLeft + metrics.axisPad - width);

  ctx.save();
  ctx.fillStyle = '#2f6cff';
  drawPriceArrowBox(ctx, x, y, width, height, metrics.axisSide, arrowDepth);
  ctx.fill();
  const textAnchor = getPriceArrowTextAnchor(x, width, metrics.axisSide, arrowDepth);
  ctx.font = `700 12px ${fontStack}`;
  ctx.textAlign = textAnchor.align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, textAnchor.x, y + 0.5);
  ctx.restore();
}

function renderXabcdPattern(
  params: RenderDrawingPatternParams,
  anchors: ReturnType<typeof getDrawingShapePoints>,
  screenPoints: PatternScreenPoint[],
  labels: string[],
  isActive: boolean,
): boolean {
  if (params.shape.kind !== 'xabcd-pattern' || screenPoints.length < 3 || anchors.length < 3) return false;

  const {
    ctx,
    metrics,
    alpha,
    strokeColor,
    strokeWidth,
    fontStack,
    formatPrice,
    isDraft,
  } = params;
  const [x, a, b, c, d] = screenPoints;
  const ratios = calculateXabcdRatios(anchors);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x.x, x.y);
  screenPoints.slice(1, 5).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = strokeColor;
  ctx.globalAlpha = Math.min(alpha * 0.16, 0.22);
  ctx.fill();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, strokeWidth * 1.35);
  ctx.setLineDash([]);
  for (let i = 1; i < Math.min(screenPoints.length, 5); i += 1) {
    drawSegment(ctx, screenPoints[i - 1], screenPoints[i]);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = Math.min(alpha * 0.75, 0.85);
  ctx.setLineDash([1, 4]);
  if (screenPoints.length >= 3) drawSegment(ctx, x, b);
  if (screenPoints.length >= 4) drawSegment(ctx, a, c);
  if (screenPoints.length >= 5) {
    drawSegment(ctx, b, d);
    drawSegment(ctx, x, d);
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = alpha;

  if (screenPoints.length >= 3 && ratios.AB_XA !== null) drawRatioBadge(ctx, ratios.AB_XA.toFixed(3), x, b, fontStack, 2);
  if (screenPoints.length >= 4 && ratios.BC_AB !== null) drawRatioBadge(ctx, ratios.BC_AB.toFixed(3), a, c, fontStack, -8);
  if (screenPoints.length >= 5 && ratios.CD_BC !== null) drawRatioBadge(ctx, ratios.CD_BC.toFixed(3), b, d, fontStack, 0);
  if (screenPoints.length >= 5 && ratios.XD_XA !== null) drawRatioBadge(ctx, ratios.XD_XA.toFixed(3), x, d, fontStack, -4);

  screenPoints.slice(0, 5).forEach((point, index) => {
    const radius = isActive ? 5 : 4.2;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawAnchorLabel(ctx, point, labels[index] ?? String(index + 1), index, fontStack);
  });

  if (!isDraft) {
    anchors.slice(0, 5).forEach((anchor, index) => {
      drawXabcdAxisPriceLabel(ctx, metrics, screenPoints[index].y, formatPrice(anchor.price), fontStack);
    });
  }
  ctx.restore();
  return true;
}

export function renderDrawingPattern(params: RenderDrawingPatternParams): void {
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
    fontStack,
    xForIndex,
  } = params;
  if (!isPatternDrawingKind(shape.kind)) return;

  const anchors = getDrawingShapePoints(shape);
  if (anchors.length < 1) return;
  const screenPoints = anchors.map((point) => ({
    x: xForIndex(point.index, metrics.totalSp, metrics.candleW),
    y: metrics.getY(point.price),
  }));
  const labels = getPatternPointLabels(shape.kind);
  const isActive = !isDraft && 'id' in shape && (shape.id === selectedDrawingId || shape.id === hoveredDrawingId);

  if (renderXabcdPattern(params, anchors, screenPoints, labels, isActive)) return;
  if (renderHeadShouldersPattern(params, anchors, screenPoints, isActive)) return;
  if (renderTrianglePattern(params, screenPoints, labels, isActive)) return;
  if (renderThreeDrivesPattern(params, screenPoints, labels, isActive)) return;
  if (renderAbcdPattern(params, anchors, screenPoints, labels, isActive)) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = Math.max(1, strokeWidth);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dashForStyle(lineStyle));

  if (screenPoints.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i += 1) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    if (!isDraft && shouldClosePattern(shape.kind) && screenPoints.length >= 3) {
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = Math.min(alpha * 0.12, 0.18);
      ctx.fill();
      ctx.restore();
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.font = `700 12px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  screenPoints.forEach((point, index) => {
    const label = labels[index] ?? String(index + 1);
    const radius = isActive || isDraft ? 4.6 : 3.6;
    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const labelY = point.y - 16;
    const labelWidth = Math.max(18, ctx.measureText(label).width + 10);
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(point.x - labelWidth / 2, labelY - 8, labelWidth, 16, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, point.x, labelY + 0.5);
  });
  ctx.restore();
}
