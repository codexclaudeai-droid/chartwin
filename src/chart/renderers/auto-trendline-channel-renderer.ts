import type { AutoTrendlineChannelResult, AutoTrendlineChannelTrend } from '../../strategy/strategies/auto-trendline-channel-runtime.ts';

type ChannelLine = Array<number | null>;
type AutoTrendlineChannelLineStyle = {
  color: string;
  width: number;
  dash?: number[];
};

function trendColor(trend: AutoTrendlineChannelTrend, alpha = 1): string {
  if (trend === 'bullish') return `rgba(8,153,129,${alpha})`;
  if (trend === 'bearish') return `rgba(242,54,69,${alpha})`;
  return `rgba(135,139,148,${alpha})`;
}

function renderSegmentedLine(params: {
  ctx: CanvasRenderingContext2D;
  data: ChannelLine;
  trend: AutoTrendlineChannelResult['trend'];
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
  style: AutoTrendlineChannelLineStyle;
  alpha: number;
  useTrendColor?: boolean;
}): void {
  const {
    ctx,
    data,
    trend,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    getY,
    style,
    alpha,
    useTrendColor = true,
  } = params;

  let currentTrend: AutoTrendlineChannelTrend | null = null;
  let started = false;
  ctx.save();
  ctx.lineWidth = style.width;
  ctx.setLineDash(style.dash ?? []);
  for (let i = 0; i < visLength; i += 1) {
    const globalIndex = startIndex + i;
    const value = data[globalIndex];
    const state = trend[globalIndex] ?? 'neutral';
    if (value == null) {
      if (started) ctx.stroke();
      started = false;
      currentTrend = null;
      continue;
    }
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    const y = getY(value);
    if (!started || currentTrend !== state) {
      if (started) ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = useTrendColor ? trendColor(state, alpha) : style.color;
      ctx.moveTo(x, y);
      started = true;
      currentTrend = state;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function renderAutoTrendlineChannel(params: {
  ctx: CanvasRenderingContext2D;
  data: AutoTrendlineChannelResult | null;
  startIndex: number;
  visLength: number;
  chartLeft: number;
  chartRight: number;
  plotTop: number;
  plotBottom: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
  showFill?: boolean;
  showUpper?: boolean;
  showBasis?: boolean;
  showLower?: boolean;
  upperStyle?: AutoTrendlineChannelLineStyle;
  basisStyle?: AutoTrendlineChannelLineStyle;
  lowerStyle?: AutoTrendlineChannelLineStyle;
}): void {
  const {
    ctx,
    data,
    startIndex,
    visLength,
    chartLeft,
    chartRight,
    plotTop,
    plotBottom,
    effectiveChartLeft,
    totalSp,
    candleW,
    getY,
    showFill = true,
    showUpper = true,
    showBasis = true,
    showLower = true,
    upperStyle = { color: '', width: 1.8, dash: [] },
    basisStyle = { color: '', width: 1.1, dash: [5, 4] },
    lowerStyle = { color: '', width: 1.8, dash: [] },
  } = params;
  if (!data || !visLength) return;
  const useTrendLineColors = !upperStyle.color && !basisStyle.color && !lowerStyle.color;

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, plotTop, Math.max(1, chartRight - chartLeft), Math.max(1, plotBottom - plotTop));
  ctx.clip();

  if (showFill) {
    for (let i = 0; i < visLength - 1; i += 1) {
      const globalIndex = startIndex + i;
      const nextIndex = globalIndex + 1;
      const upperA = data.upper[globalIndex];
      const lowerA = data.lower[globalIndex];
      const upperB = data.upper[nextIndex];
      const lowerB = data.lower[nextIndex];
      if (upperA == null || lowerA == null || upperB == null || lowerB == null) continue;
      const xA = effectiveChartLeft + i * totalSp + candleW / 2;
      const xB = effectiveChartLeft + (i + 1) * totalSp + candleW / 2;
      const state = data.trend[globalIndex] ?? 'neutral';
      ctx.fillStyle = trendColor(state, state === 'neutral' ? 0.05 : 0.075);
      ctx.beginPath();
      ctx.moveTo(xA, getY(upperA));
      ctx.lineTo(xB, getY(upperB));
      ctx.lineTo(xB, getY(lowerB));
      ctx.lineTo(xA, getY(lowerA));
      ctx.closePath();
      ctx.fill();
    }
  }

  if (showUpper) {
    renderSegmentedLine({
      ctx,
      data: data.upper,
      trend: data.trend,
      startIndex,
      visLength,
      effectiveChartLeft,
      totalSp,
      candleW,
      getY,
      style: upperStyle,
      alpha: 0.9,
      useTrendColor: useTrendLineColors,
    });
  }
  if (showBasis) {
    renderSegmentedLine({
      ctx,
      data: data.basis,
      trend: data.trend,
      startIndex,
      visLength,
      effectiveChartLeft,
      totalSp,
      candleW,
      getY,
      style: basisStyle,
      alpha: 0.72,
      useTrendColor: useTrendLineColors,
    });
  }
  if (showLower) {
    renderSegmentedLine({
      ctx,
      data: data.lower,
      trend: data.trend,
      startIndex,
      visLength,
      effectiveChartLeft,
      totalSp,
      candleW,
      getY,
      style: lowerStyle,
      alpha: 0.9,
      useTrendColor: useTrendLineColors,
    });
  }

  ctx.restore();
}
