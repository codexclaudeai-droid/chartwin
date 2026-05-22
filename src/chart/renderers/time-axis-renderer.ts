import type { TimeframeKey } from '../../catalog/time';
import { formatAxisTime } from '../axis-utils.ts';

export interface TimeAxisCandle {
  time: number;
}

export interface RenderTimeAxisLabelsParams {
  ctx: CanvasRenderingContext2D;
  candles: TimeAxisCandle[];
  tickIndices: number[];
  candleCount: number;
  effectiveChartLeft: number;
  totalSpacing: number;
  candleWidth: number;
  height: number;
  timezone: string;
  timeframe: TimeframeKey;
  stepCandles: number;
  chartTextMuted: string;
  fontStack: string;
  labelGap?: number;
}

export function renderTimeAxisLabels(params: RenderTimeAxisLabelsParams): void {
  const {
    ctx,
    candles,
    tickIndices,
    candleCount,
    effectiveChartLeft,
    totalSpacing,
    candleWidth,
    height,
    timezone,
    timeframe,
    stepCandles,
    chartTextMuted,
    fontStack,
    labelGap = 10,
  } = params;

  ctx.save();
  ctx.fillStyle = chartTextMuted;
  ctx.font = `11px ${fontStack}`;
  ctx.textAlign = 'center';
  let nextRightBoundary = Number.POSITIVE_INFINITY;
  for (let tickIndex = tickIndices.length - 1; tickIndex >= 0; tickIndex -= 1) {
    const candleIndex = tickIndices[tickIndex];
    if (candleIndex >= candleCount) continue;

    const x = effectiveChartLeft + candleIndex * totalSpacing + candleWidth / 2;
    const label = formatAxisTime(candles[candleIndex].time, timezone, timeframe, stepCandles);
    const width = ctx.measureText(label).width;
    const left = x - width / 2;
    const right = x + width / 2;
    if (right + labelGap <= nextRightBoundary) {
      ctx.fillText(label, x, height - 4);
      nextRightBoundary = left;
    }
  }
  ctx.restore();
}
