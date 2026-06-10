import type { AtrTrailingEmaSignalResult } from '../indicators/atr-trailing-ema-signal.ts';
import type { DrawSeriesLine, IndicatorLineStyle } from './main-line-renderer.ts';

export function renderAtrTrailingEmaSignal(params: {
  ctx: CanvasRenderingContext2D;
  data: AtrTrailingEmaSignalResult;
  displayData: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  trendEmaStyle: IndicatorLineStyle;
  atrStopStyle: IndicatorLineStyle;
  buyStyle: IndicatorLineStyle;
  sellStyle: IndicatorLineStyle;
  showTrendEma: boolean;
  showAtrStop: boolean;
  showBuySignal: boolean;
  showSellSignal: boolean;
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
    trendEmaStyle,
    atrStopStyle,
    buyStyle,
    sellStyle,
    showTrendEma,
    showAtrStop,
    showBuySignal,
    showSellSignal,
    drawLine,
    getY,
    fontStack,
  } = params;

  if (showTrendEma) drawLine(data.trendEma, trendEmaStyle.color, trendEmaStyle.width, trendEmaStyle.dash);
  if (showAtrStop) drawLine(data.atrStop, atrStopStyle.color, atrStopStyle.width, atrStopStyle.dash);
  if (!showBuySignal && !showSellSignal) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(effectiveChartLeft - totalSp, top, totalSp * (visLength + 2), Math.max(1, bottom - top));
  ctx.clip();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const candle = displayData[gi];
    if (!candle) continue;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    if (showBuySignal && data.buySignal[gi]) {
      drawSignalLabel({
        ctx,
        x,
        y: Math.min(bottom - 8, getY(candle.low) + 18),
        text: 'Buy',
        direction: 'up',
        color: buyStyle.color,
        textColor: '#050607',
        fontStack,
      });
    }
    if (showSellSignal && data.sellSignal[gi]) {
      drawSignalLabel({
        ctx,
        x,
        y: Math.max(top + 8, getY(candle.high) - 18),
        text: 'Sell',
        direction: 'down',
        color: sellStyle.color,
        textColor: '#ffffff',
        fontStack,
      });
    }
  }
  ctx.restore();
}

function drawSignalLabel(params: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  text: string;
  direction: 'up' | 'down';
  color: string;
  textColor: string;
  fontStack: string;
}): void {
  const { ctx, x, y, text, direction, color, textColor, fontStack } = params;
  const width = 34;
  const height = 18;
  const radius = 4;
  const pointer = 5;
  const boxX = x - width / 2;
  const boxY = direction === 'up' ? y + pointer : y - height - pointer;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, width, height, radius);
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
