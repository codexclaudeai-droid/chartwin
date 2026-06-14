import type { KalmanAdjustedAtrResult } from '../indicators/kalman-adjusted-atr.ts';
import type { DrawSeriesLine, IndicatorLineStyle } from './main-line-renderer.ts';

export function splitKalmanAdjustedAtrTrendLines(data: KalmanAdjustedAtrResult): {
  upLine: Array<number | null>;
  downLine: Array<number | null>;
} {
  const upLine = new Array<number | null>(data.baseline.length).fill(null);
  const downLine = new Array<number | null>(data.baseline.length).fill(null);
  for (let index = 0; index < data.baseline.length; index += 1) {
    const value = data.baseline[index];
    if (value == null) continue;
    const trend = data.trend[index];
    if (trend === 1) {
      if (index > 0 && data.trend[index - 1] === -1 && data.baseline[index - 1] != null) {
        upLine[index - 1] = data.baseline[index - 1];
      }
      upLine[index] = value;
    } else if (trend === -1) {
      if (index > 0 && data.trend[index - 1] === 1 && data.baseline[index - 1] != null) {
        downLine[index - 1] = data.baseline[index - 1];
      }
      downLine[index] = value;
    }
  }
  return { upLine, downLine };
}

export function renderKalmanAdjustedAtr(params: {
  ctx: CanvasRenderingContext2D;
  data: KalmanAdjustedAtrResult;
  displayData: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  lineStyle: IndicatorLineStyle;
  maStyle: IndicatorLineStyle;
  trendUpStyle: IndicatorLineStyle;
  trendDownStyle: IndicatorLineStyle;
  showLine: boolean;
  showMa: boolean;
  showTrendUp: boolean;
  showTrendDown: boolean;
  drawLine: DrawSeriesLine;
  getY: (price: number) => number;
  fontStack: string;
}): void {
  const {
    ctx,
    data,
    displayData,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    top,
    bottom,
    lineStyle,
    maStyle,
    trendUpStyle,
    trendDownStyle,
    showLine,
    showMa,
    showTrendUp,
    showTrendDown,
    drawLine,
    getY,
    fontStack,
  } = params;

  if (showLine) {
    const { upLine, downLine } = splitKalmanAdjustedAtrTrendLines(data);
    drawLine(upLine, trendUpStyle.color, lineStyle.width, lineStyle.dash);
    drawLine(downLine, trendDownStyle.color, lineStyle.width, lineStyle.dash);
  }
  if (showMa) drawLine(data.ma, maStyle.color, maStyle.width, maStyle.dash);
  if (!showTrendUp && !showTrendDown) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(effectiveChartLeft - totalSp, top, totalSp * (visLength + 2), Math.max(1, bottom - top));
  ctx.clip();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const candle = displayData[gi];
    if (!candle) continue;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    if (showTrendUp && data.trendUp[gi]) {
      drawSignalLabel(ctx, x, Math.min(bottom - 8, getY(candle.low) + 18), 'Up', 'up', trendUpStyle.color, '#04130f', fontStack);
    }
    if (showTrendDown && data.trendDown[gi]) {
      drawSignalLabel(ctx, x, Math.max(top + 8, getY(candle.high) - 18), 'Down', 'down', trendDownStyle.color, '#ffffff', fontStack);
    }
  }
  ctx.restore();
}

function drawSignalLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  direction: 'up' | 'down',
  color: string,
  textColor: string,
  fontStack: string,
): void {
  const width = text === 'Down' ? 42 : 28;
  const height = 18;
  const pointer = 5;
  const boxX = x - width / 2;
  const boxY = direction === 'up' ? y + pointer : y - height - pointer;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, width, height, 4);
  ctx.fill();
  ctx.beginPath();
  if (direction === 'up') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - pointer, boxY);
    ctx.lineTo(x + pointer, boxY);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - pointer, boxY + height);
    ctx.lineTo(x + pointer, boxY + height);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = `700 11px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, boxY + height / 2);
  ctx.restore();
}
