import type { DonchianChannelResult } from '../indicators/donchian-channel.ts';
import type { IndicatorLineStyle } from './main-line-renderer.ts';

type DrawDonchianLine = (
  data: Array<number | null>,
  color: string,
  width?: number,
  dash?: number[],
) => void;

export function renderDonchianChannelFill(params: {
  ctx: CanvasRenderingContext2D;
  data: DonchianChannelResult | null;
  enabled: boolean;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  fillColor?: string;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    data,
    enabled,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    fillColor = 'rgba(66,165,245,0.06)',
    getY,
  } = params;
  if (!enabled || !data) return;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  let first = true;
  for (let i = 0; i < visLength; i += 1) {
    const value = data.upper[startIndex + i];
    if (value == null) continue;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    if (first) {
      ctx.moveTo(x, getY(value));
      first = false;
    } else {
      ctx.lineTo(x, getY(value));
    }
  }
  if (!first) {
    for (let i = visLength - 1; i >= 0; i -= 1) {
      const value = data.lower[startIndex + i];
      if (value == null) continue;
      ctx.lineTo(effectiveChartLeft + i * totalSp + candleW / 2, getY(value));
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function renderDonchianChannelLines(params: {
  data: DonchianChannelResult | null;
  showLine: (key: string) => boolean;
  upperStyle: IndicatorLineStyle;
  middleStyle: IndicatorLineStyle;
  lowerStyle: IndicatorLineStyle;
  drawLine: DrawDonchianLine;
}): void {
  const { data, showLine, upperStyle, middleStyle, lowerStyle, drawLine } = params;
  if (!data) return;
  if (showLine('donchianUpper')) drawLine(data.upper, upperStyle.color, upperStyle.width, upperStyle.dash);
  if (showLine('donchianMiddle')) drawLine(data.middle, middleStyle.color, middleStyle.width, middleStyle.dash);
  if (showLine('donchianLower')) drawLine(data.lower, lowerStyle.color, lowerStyle.width, lowerStyle.dash);
}
