import type {
  AnchoredVwapSettings,
  DrawingDraft,
  DrawingShape,
  DrawingHitPart,
} from '../../ui/workspace/drawing-types.ts';
import type { TrendlineRenderLine, TrendlineTextLayout } from './drawing-hit-test.ts';
import { renderDrawingAnchoredVwap, type AnchoredVwapPlotPoint } from './drawing-anchored-vwap-renderer.ts';
import { renderDrawingBox } from './drawing-box-renderer.ts';
import { renderDrawingCircle } from './drawing-circle-renderer.ts';
import { renderDrawingChannel } from './drawing-channel-renderer.ts';
import { renderDrawingFib } from './drawing-fib-renderer.ts';
import { renderDrawingHline } from './drawing-hline-renderer.ts';
import { renderDrawingLine } from './drawing-line-renderer.ts';
import { renderDrawingMeasure } from './drawing-measure-renderer.ts';
import { renderDrawingPattern } from './drawing-pattern-renderer.ts';
import { renderDrawingPosition } from './drawing-position-renderer.ts';
import { renderSingleAnchorLine } from './drawing-single-anchor-line-renderer.ts';
import { renderDrawingTextNote } from './drawing-text-note-renderer.ts';
import type {
  DrawingAxisMetrics,
  DrawingChartBounds,
  DrawingLineStyle,
  DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';
import { isPatternDrawingKind } from '../../ui/workspace/drawing-utils.ts';
import type { TimeframeKey } from '../../catalog/time.ts';
import type { SingleAnchorLineCandle } from './drawing-single-anchor-line-renderer.ts';

export type DrawingShapeRenderMetrics = DrawingViewportMetrics & DrawingChartBounds & DrawingAxisMetrics & {
  top: number;
  mainH: number;
  plotHeight?: number;
};

export interface RenderDrawingShapeParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingShapeRenderMetrics | null;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  hoveredDrawingPart: DrawingHitPart | null;
  editingTextShapeId: string | null;
  symbol: string;
  upColor: string;
  downColor: string;
  viewportHeight: number;
  xAxisHeight: number;
  fontStack: string;
  formatPrice: (value: number) => string;
  candles?: SingleAnchorLineCandle[];
  timezone?: string;
  timeframe?: TimeframeKey;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
  getAnchoredVwapSettings: (shape: DrawingShape) => AnchoredVwapSettings;
  getAnchoredVwapPlot: (shape: DrawingShape) => AnchoredVwapPlotPoint[];
  getTrendlineRenderLine: (shape: DrawingShape | DrawingDraft, metrics: DrawingViewportMetrics) => TrendlineRenderLine;
  getTrendlineTextLayout: (shape: DrawingShape, metrics: DrawingViewportMetrics, placeholder: string) => TrendlineTextLayout;
}

function getDrawingStyle(shape: DrawingShape | DrawingDraft): {
  alphaColor: string;
  width: number;
  lineStyle: DrawingLineStyle;
} {
  const defaultColor = shape.kind === 'head-shoulders-pattern'
    ? '#00a68f'
    : shape.kind === 'abcd-pattern'
      ? '#00a68f'
    : shape.kind === 'triangle-pattern' || shape.kind === 'three-drives-pattern'
      ? '#7c4dff'
      : '#2f6cff';
  return {
    alphaColor: ('color' in shape && shape.color) ? shape.color : defaultColor,
    width: ('width' in shape && shape.width) ? shape.width : 2,
    lineStyle: ('lineStyle' in shape && shape.lineStyle) ? shape.lineStyle : 'solid',
  };
}

export function renderDrawingShape(params: RenderDrawingShapeParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    selectedDrawingId,
    hoveredDrawingId,
    hoveredDrawingPart,
    editingTextShapeId,
    symbol,
    upColor,
    downColor,
    viewportHeight,
    xAxisHeight,
    fontStack,
    formatPrice,
    candles,
    timezone,
    timeframe,
    xForIndex,
    getAnchoredVwapSettings,
    getAnchoredVwapPlot,
    getTrendlineRenderLine,
    getTrendlineTextLayout,
  } = params;
  if (!metrics) return;
  if ('hidden' in shape && shape.hidden) return;

  const alpha = isDraft ? 0.72 : 1;
  const style = getDrawingStyle(shape);
  const shouldClipToChart = shape.kind !== 'hline'
    && shape.kind !== 'anchored-vwap'
    && shape.kind !== 'vertical-line'
    && shape.kind !== 'cross-line'
    && shape.kind !== 'xabcd-pattern'
    && shape.kind !== 'head-shoulders-pattern';
  if (shouldClipToChart) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      metrics.chartLeft,
      metrics.top,
      Math.max(1, metrics.chartRight - metrics.chartLeft),
      Math.max(1, metrics.mainH - metrics.top),
    );
    ctx.clip();
  }

  switch (shape.kind) {
    case 'xabcd-pattern':
    case 'cypher-pattern':
    case 'head-shoulders-pattern':
    case 'abcd-pattern':
    case 'triangle-pattern':
    case 'three-drives-pattern':
    case 'elliott-impulse-wave':
    case 'elliott-correction-wave':
    case 'elliott-triangle-wave':
    case 'elliott-double-combo-wave':
    case 'elliott-triple-combo-wave': {
      if (isPatternDrawingKind(shape.kind)) {
        renderDrawingPattern({
          ctx,
          shape,
          isDraft,
          metrics,
          alpha,
          strokeColor: style.alphaColor,
          strokeWidth: style.width,
          lineStyle: style.lineStyle,
          selectedDrawingId,
          hoveredDrawingId,
          fontStack,
          formatPrice,
          xForIndex,
        });
      }
      break;
    }
    case 'anchored-vwap': {
      const anchoredShape = shape as DrawingShape;
      renderDrawingAnchoredVwap({
        ctx,
        shape,
        isDraft,
        metrics,
        plot: getAnchoredVwapPlot(anchoredShape),
        settings: getAnchoredVwapSettings(anchoredShape),
        alpha,
        strokeColor: style.alphaColor,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        fontStack,
        formatPrice,
        xForIndex,
      });
      break;
    }
    case 'trendline':
    case 'extended-trendline':
    case 'ray-trendline':
    case 'vertical-line':
    case 'cross-line':
    case 'draw-pencil':
    case 'draw-highlighter': {
      if (shape.kind === 'vertical-line' || shape.kind === 'cross-line') {
        renderSingleAnchorLine({
          ctx,
          shape,
          isDraft,
          metrics,
          alpha,
          strokeColor: style.alphaColor,
          strokeWidth: style.width,
          lineStyle: style.lineStyle,
          selectedDrawingId,
          hoveredDrawingId,
          fontStack,
          formatPrice,
          candles,
          timezone,
          timeframe,
          xAxisHeight,
          viewportHeight,
          xForIndex,
        });
      } else {
        renderDrawingLine({
          ctx,
          shape,
          isDraft,
          metrics,
          alpha,
          strokeColor: style.alphaColor,
          strokeWidth: style.width,
          lineStyle: style.lineStyle,
          selectedDrawingId,
          hoveredDrawingId,
          hoveredDrawingPart,
          editingTextShapeId,
          fontStack,
          xForIndex,
          getTrendlineRenderLine,
          getTrendlineTextLayout,
        });
      }
      break;
    }
    case 'draw-box': {
      renderDrawingBox({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeColor: style.alphaColor,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        xForIndex,
      });
      break;
    }
    case 'draw-circle': {
      renderDrawingCircle({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeColor: style.alphaColor,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        hoveredDrawingPart,
        editingTextShapeId,
        fontStack,
        xForIndex,
        getTrendlineTextLayout,
      });
      break;
    }
    case 'hline': {
      renderDrawingHline({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeColor: style.alphaColor,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        fontStack,
        formatPrice,
      });
      break;
    }
    case 'channel': {
      renderDrawingChannel({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeColor: style.alphaColor,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        xForIndex,
      });
      break;
    }
    case 'fib-retracement':
    case 'fib-trend': {
      renderDrawingFib({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        fontStack,
        xForIndex,
      });
      break;
    }
    case 'long-position':
    case 'short-position': {
      renderDrawingPosition({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        strokeWidth: style.width,
        lineStyle: style.lineStyle,
        selectedDrawingId,
        hoveredDrawingId,
        symbol,
        fontStack,
        xForIndex,
      });
      break;
    }
    case 'text-note': {
      renderDrawingTextNote({
        ctx,
        shape,
        metrics,
        alpha,
        fontStack,
        xForIndex,
      });
      break;
    }
    case 'measure': {
      renderDrawingMeasure({
        ctx,
        shape,
        isDraft,
        metrics,
        alpha,
        selectedDrawingId,
        hoveredDrawingId,
        upColor,
        downColor,
        viewportHeight,
        xAxisHeight,
        fontStack,
        xForIndex,
      });
      break;
    }
    default:
      break;
  }

  if (shouldClipToChart) {
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
