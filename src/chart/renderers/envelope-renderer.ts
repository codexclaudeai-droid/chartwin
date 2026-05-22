import type { IndicatorLineStyle } from './main-line-renderer.ts';
import type { EnvelopeResult } from '../indicators/index.ts';

type DrawEnvelopeLine = (
  data: Array<number | null>,
  color: string,
  width?: number,
  dash?: number[],
) => void;

export function renderEnvelopeFill(params: {
  ctx: CanvasRenderingContext2D;
  data: EnvelopeResult | null;
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
    fillColor = 'rgba(255,200,50,0.05)',
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
  for (let i = visLength - 1; i >= 0; i -= 1) {
    const value = data.lower[startIndex + i];
    if (value == null) continue;
    ctx.lineTo(effectiveChartLeft + i * totalSp + candleW / 2, getY(value));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderEnvelopeLines(params: {
  data: EnvelopeResult | null;
  showLine: (key: string) => boolean;
  upperStyle: IndicatorLineStyle;
  middleStyle: IndicatorLineStyle;
  lowerStyle: IndicatorLineStyle;
  drawLine: DrawEnvelopeLine;
}): void {
  const { data, showLine, upperStyle, middleStyle, lowerStyle, drawLine } = params;
  if (!data) return;
  if (showLine('envelopeUpper')) drawLine(data.upper, upperStyle.color, upperStyle.width, upperStyle.dash);
  if (showLine('envelopeMiddle')) drawLine(data.mid, middleStyle.color, middleStyle.width, middleStyle.dash);
  if (showLine('envelopeLower')) drawLine(data.lower, lowerStyle.color, lowerStyle.width, lowerStyle.dash);
}
