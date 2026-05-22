import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import {
  getLineDash,
  setCanvasStroke,
  type DrawingChartBounds,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export type DrawingFibRenderMetrics = DrawingViewportMetrics & DrawingChartBounds;

export interface RenderDrawingFibParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingFibRenderMetrics;
  alpha: number;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

interface FibLevel {
  ratio: number;
  lineColor: string;
  zoneColor: string;
}

const FIB_LEVELS: FibLevel[] = [
  { ratio: 4.236, lineColor: '#ff2b74', zoneColor: 'rgba(255,43,116,0.16)' },
  { ratio: 3.618, lineColor: '#b437ff', zoneColor: 'rgba(180,55,255,0.14)' },
  { ratio: 2.618, lineColor: '#ff4b62', zoneColor: 'rgba(255,75,98,0.13)' },
  { ratio: 1.618, lineColor: '#2d69ff', zoneColor: 'rgba(45,105,255,0.14)' },
  { ratio: 1, lineColor: '#8d92a3', zoneColor: 'rgba(141,146,163,0.12)' },
  { ratio: 0.786, lineColor: '#00e1ff', zoneColor: 'rgba(0,225,255,0.12)' },
  { ratio: 0.618, lineColor: '#1dd6c4', zoneColor: 'rgba(29,214,196,0.11)' },
  { ratio: 0.5, lineColor: '#2ad65f', zoneColor: 'rgba(42,214,95,0.11)' },
  { ratio: 0.382, lineColor: '#ffa31a', zoneColor: 'rgba(255,163,26,0.12)' },
  { ratio: 0.236, lineColor: '#ff445f', zoneColor: 'rgba(255,68,95,0.12)' },
  { ratio: 0, lineColor: '#7d8495', zoneColor: 'rgba(125,132,149,0.10)' },
];

function formatRatio(ratio: number): string {
  return Number.isInteger(ratio)
    ? `${ratio}`
    : ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function getOutsideLabelX(metrics: DrawingFibRenderMetrics, left: number, right: number): number {
  const leftOutside = left - 132;
  if (leftOutside >= metrics.chartLeft + 6) return leftOutside;
  return Math.min(metrics.chartRight - 180, right + 8);
}

function drawLevelLabel(
  ctx: CanvasRenderingContext2D,
  level: Pick<FibLevel, 'ratio' | 'lineColor'> & { price: number; y: number },
  x: number,
  alpha: number,
  fontStack: string,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = level.lineColor;
  ctx.font = `600 13px ${fontStack}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${formatRatio(level.ratio)} (${level.price.toFixed(2)})`, x, level.y);
  ctx.restore();
}

function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function renderDrawingFib(params: RenderDrawingFibParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    alpha,
    strokeWidth,
    lineStyle,
    selectedDrawingId,
    hoveredDrawingId,
    fontStack,
    xForIndex,
  } = params;

  const a = shape.a;
  const b = shape.b ?? shape.a;
  const ax = xForIndex(a.index, metrics.totalSp, metrics.candleW);
  const ay = metrics.getY(a.price);
  const bx = xForIndex(b.index, metrics.totalSp, metrics.candleW);
  const by = metrics.getY(b.price);
  const price0 = a.price;
  const price1 = b.price;
  const rangePrice = price1 - price0;
  const isTrendBased = shape.kind === 'fib-trend';
  const fibOffset = isTrendBased
    ? ((shape as DrawingShape | DrawingDraft).channelOffset ?? { index: 0, price: 0 })
    : { index: 0, price: 0 };
  const cx = xForIndex(a.index + fibOffset.index, metrics.totalSp, metrics.candleW);
  const cy = metrics.getY(a.price + fibOffset.price);
  const lineDash = getLineDash(lineStyle);

  if (!isTrendBased) {
    const toPrice = (ratio: number) => price0 + rangePrice * ratio;
    const toY = (ratio: number) => metrics.getY(toPrice(ratio));
    const x0 = Math.min(ax, bx);
    const x1 = Math.max(ax, bx);
    const labelX = getOutsideLabelX(metrics, x0, x1);

    for (let i = 0; i < FIB_LEVELS.length - 1; i += 1) {
      const yA = toY(FIB_LEVELS[i].ratio);
      const yB = toY(FIB_LEVELS[i + 1].ratio);
      const top = Math.min(yA, yB);
      const height = Math.abs(yA - yB);
      if (height < 1) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = FIB_LEVELS[i].zoneColor;
      ctx.fillRect(x0, top, Math.max(1, x1 - x0), height);
      ctx.restore();
    }

    FIB_LEVELS.forEach((level) => {
      const y = toY(level.ratio);
      setCanvasStroke(ctx, level.lineColor, Math.max(1.1, strokeWidth * 0.9), lineDash, alpha);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      drawLevelLabel(ctx, { ...level, price: toPrice(level.ratio), y }, labelX, alpha, fontStack);
    });
  } else {
    const cPrice = a.price + fibOffset.price;
    const movePrice = b.price - a.price;
    const xStart = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.min(bx, cx)));
    const xEnd = Math.max(metrics.chartLeft, Math.min(metrics.chartRight - 1, Math.max(bx, cx)));
    const projectedLevels = [...FIB_LEVELS]
      .sort((left, right) => left.ratio - right.ratio)
      .map((level) => {
        const price = cPrice + movePrice * level.ratio;
        return {
          ...level,
          price,
          y: metrics.getY(price),
        };
      });

    if (xEnd - xStart > 1) {
      for (let i = 0; i < projectedLevels.length - 1; i += 1) {
        const upper = projectedLevels[i];
        const lower = projectedLevels[i + 1];
        const top = Math.min(upper.y, lower.y);
        const height = Math.abs(upper.y - lower.y);
        if (height < 1) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = lower.zoneColor;
        ctx.fillRect(xStart, top, xEnd - xStart, height);
        ctx.restore();
      }

      const labelX = getOutsideLabelX(metrics, xStart, xEnd);
      projectedLevels.forEach((level) => {
        setCanvasStroke(ctx, level.lineColor, Math.max(1.1, strokeWidth * 0.9), lineDash, alpha);
        ctx.beginPath();
        ctx.moveTo(xStart, level.y);
        ctx.lineTo(xEnd, level.y);
        ctx.stroke();
        drawLevelLabel(ctx, level, labelX, alpha, fontStack);
      });
    }

    setCanvasStroke(ctx, 'rgba(190,205,233,0.78)', Math.max(1, strokeWidth * 0.85), [6, 6], alpha);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.moveTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandles = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandles) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#2f6cff';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = strokeWidth;
  const radius = 9;
  drawAnchor(ctx, ax, ay, radius);
  drawAnchor(ctx, bx, by, radius);
  if (isTrendBased) drawAnchor(ctx, cx, cy, radius);
  ctx.restore();
}
