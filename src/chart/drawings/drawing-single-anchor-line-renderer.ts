import type { DrawingDraft, DrawingShape, SingleAnchorLineDrawingToolId } from '../../ui/workspace/drawing-types.ts';
import { getSingleAnchorLineSegments } from '../../ui/workspace/drawing-utils.ts';
import type { TimeframeKey } from '../../catalog/time.ts';
import { formatCrosshairTimelineLabel } from '../axis-utils.ts';
import { getContrastTextColor } from '../color-utils.ts';
import {
  drawPriceArrowBox,
  getLineDash,
  getPriceArrowTextAnchor,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export interface SingleAnchorLineCandle {
  time: number;
}

export interface RenderSingleAnchorLineParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingViewportMetrics & {
    top: number;
    mainH: number;
    chartLeft: number;
    chartRight: number;
    axisPad?: number;
    axisSide?: 'left' | 'right';
    axisLeft?: number;
    plotHeight?: number;
    plotBottom?: number;
  };
  alpha: number;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  fontStack?: string;
  formatPrice?: (value: number) => string;
  candles?: SingleAnchorLineCandle[];
  timezone?: string;
  timeframe?: TimeframeKey;
  xAxisHeight?: number;
  viewportHeight?: number;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  now?: number;
}

function drawAxisPriceLabel(params: {
  ctx: CanvasRenderingContext2D;
  y: number;
  price: number;
  metrics: RenderSingleAnchorLineParams['metrics'];
  strokeColor: string;
  fontStack: string;
  formatPrice: (value: number) => string;
}): void {
  const { ctx, y, price, metrics, strokeColor, fontStack, formatPrice } = params;
  if (metrics.axisPad == null || metrics.axisSide == null || metrics.axisLeft == null) return;

  const boxWidth = Math.max(20, metrics.axisPad - 2);
  const boxX = metrics.axisSide === 'left' ? 2 : metrics.axisLeft;
  const boxHeight = 20;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = strokeColor;
  drawPriceArrowBox(ctx, boxX, y, boxWidth, boxHeight, metrics.axisSide);
  ctx.fill();
  ctx.fillStyle = getContrastTextColor(strokeColor);
  ctx.font = `700 12px ${fontStack}`;
  const textAnchor = getPriceArrowTextAnchor(boxX, boxWidth, metrics.axisSide, 5);
  ctx.textAlign = textAnchor.align;
  ctx.textBaseline = 'middle';
  ctx.fillText(formatPrice(price), textAnchor.x, y);
  ctx.restore();
}

function drawTimelineLabel(params: {
  ctx: CanvasRenderingContext2D;
  x: number;
  label: string;
  chartLeft: number;
  chartRight: number;
  plotBottom: number;
  xAxisHeight: number;
  fillColor: string;
  fontStack: string;
}): void {
  const { ctx, x, label, chartLeft, chartRight, plotBottom, xAxisHeight, fillColor, fontStack } = params;
  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `11px ${fontStack}`;
  const boxWidth = Math.ceil(ctx.measureText(label).width) + 16;
  const boxHeight = xAxisHeight;
  const boxX = Math.min(Math.max(chartLeft + 2, x - boxWidth / 2), chartRight - boxWidth - 2);
  ctx.fillStyle = fillColor;
  ctx.fillRect(boxX, plotBottom, boxWidth, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, boxX + boxWidth / 2, plotBottom + boxHeight / 2 + 0.5);
  ctx.restore();
}

export function renderSingleAnchorLine(params: RenderSingleAnchorLineParams): void {
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
    fontStack = 'Arial',
    formatPrice = (value) => String(value),
    candles,
    timezone = 'UTC+9',
    xAxisHeight = 22,
    viewportHeight,
    xForIndex,
    now = performance.now(),
  } = params;

  const anchorX = xForIndex(shape.a.index, metrics.totalSp, metrics.candleW);
  const anchorY = metrics.getY(shape.a.price);
  const plotBottom = metrics.plotBottom ?? metrics.plotHeight ?? metrics.mainH;
  const segments = getSingleAnchorLineSegments(
    { x: anchorX, y: anchorY },
    {
      left: metrics.chartLeft,
      right: metrics.chartRight,
      top: metrics.top,
      bottom: plotBottom,
    },
    shape.kind as SingleAnchorLineDrawingToolId,
  );

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash(getLineDash(lineStyle));
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  segments.forEach((segment) => {
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
  });

  drawAxisPriceLabel({
    ctx,
    y: anchorY,
    price: shape.a.price,
    metrics,
    strokeColor,
    fontStack,
    formatPrice,
  });

  const candle = candles?.[Math.max(0, Math.min(candles.length - 1, Math.round(shape.a.index)))];
  const timelineBottom = Math.min(
    plotBottom,
    Math.max(0, (viewportHeight ?? (plotBottom + xAxisHeight)) - xAxisHeight),
  );
  if (candle && Number.isFinite(candle.time)) {
    drawTimelineLabel({
      ctx,
      x: anchorX,
      label: formatCrosshairTimelineLabel(candle.time, timezone),
      chartLeft: metrics.chartLeft,
      chartRight: metrics.chartRight,
      plotBottom: timelineBottom,
      xAxisHeight,
      fillColor: strokeColor,
      fontStack,
    });
  }

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const showHandle = shapeId != null && (shapeId === selectedDrawingId || shapeId === hoveredDrawingId);
  if (!showHandle) return;

  const isHovered = shapeId === hoveredDrawingId;
  const pulse = (Math.sin(now * 0.012) + 1) * 0.5;
  const radius = 8.25;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash([]);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (isHovered) {
    ctx.save();
    ctx.globalAlpha = 0.24 + pulse * 0.28;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, radius + 2 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
