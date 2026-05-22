import type { CandleData } from '../../types.ts';
import { drawPriceLineOverlay } from './price-line-overlay-renderer.ts';

export interface FocusedTradeRange {
  startIndex: number;
  endIndex: number;
  style?: 'range' | 'candle';
  type: 'box' | 'connector';
  entryPrice?: number;
  exitPrice?: number;
  isProfit?: boolean;
}

export interface TradeFocusMainScale {
  lo: number;
  hi: number;
  toY: (price: number) => number;
}

export interface RenderTradeFocusOverlayParams {
  ctx: CanvasRenderingContext2D;
  focusedTradeRange: FocusedTradeRange | null;
  focusVisualStartedAt: number;
  data: CandleData[];
  startIndex: number;
  endIndex: number;
  isMouseOver: boolean;
  chartLeft: number;
  chartRight: number;
  mainTop: number;
  mainH: number;
  axisPad: number;
  axisSide: 'left' | 'right';
  totalSp: number;
  effectiveChartLeft: number;
  candleW: number;
  mainScale: TradeFocusMainScale | null;
  fontStack: string;
  priceDigits: number;
  requestOverlayDraw: () => void;
  now?: number;
}

export function renderTradeFocusOverlay(params: RenderTradeFocusOverlayParams): void {
  const {
    ctx,
    focusedTradeRange,
    focusVisualStartedAt,
    data,
    startIndex,
    endIndex,
    isMouseOver,
    chartLeft,
    chartRight,
    mainTop,
    mainH,
    axisPad,
    axisSide,
    totalSp,
    effectiveChartLeft,
    candleW,
    mainScale,
    fontStack,
    priceDigits,
    requestOverlayDraw,
    now = Date.now(),
  } = params;
  if (!focusedTradeRange) return;

  const rangeStart = Math.max(0, Math.min(focusedTradeRange.startIndex, focusedTradeRange.endIndex));
  const rangeEnd = Math.max(0, Math.max(focusedTradeRange.startIndex, focusedTradeRange.endIndex));
  const visibleStart = startIndex;
  const visibleEnd = endIndex - 1;
  const drawStart = Math.max(rangeStart, visibleStart);
  const drawEnd = Math.min(rangeEnd, visibleEnd);
  if (drawStart > drawEnd) return;

  const startLocal = drawStart - startIndex;
  const endLocal = drawEnd - startIndex;
  const x1 = effectiveChartLeft + startLocal * totalSp;
  const x2 = effectiveChartLeft + endLocal * totalSp + candleW;
  const lineStartX = x1 + candleW / 2;
  const lineEndX = x2 - candleW / 2;

  if (focusedTradeRange.type === 'connector' && mainScale) {
    const entryPrice = focusedTradeRange.entryPrice;
    const exitPrice = focusedTradeRange.exitPrice;
    if (Number.isFinite(entryPrice) && Number.isFinite(exitPrice)) {
      const entryY = mainScale.toY(entryPrice as number);
      const exitY = mainScale.toY(exitPrice as number);
      const lineColor = focusedTradeRange.isProfit ? 'rgba(34,171,148,0.9)' : 'rgba(242,54,69,0.9)';
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, mainTop, Math.max(1, chartRight - chartLeft), Math.max(1, mainH - mainTop));
      ctx.clip();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 2]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lineStartX, entryY + 0.5);
      ctx.lineTo(lineEndX, exitY + 0.5);
      ctx.stroke();
      ctx.restore();
      drawPriceLineOverlay({
        ctx,
        chartLeft,
        chartRight,
        axisPad,
        axisSide,
        totalSp,
        mainH,
        minP: mainScale.lo,
        maxP: mainScale.hi,
        getY: mainScale.toY,
        fromX: lineStartX,
        price: entryPrice as number,
        label: 'ENTRY',
        color: '#6ea8ff',
        dash: [6, 3],
        alpha: 0.9,
        fontStack,
        priceDigits,
      });
      drawPriceLineOverlay({
        ctx,
        chartLeft,
        chartRight,
        axisPad,
        axisSide,
        totalSp,
        mainH,
        minP: mainScale.lo,
        maxP: mainScale.hi,
        getY: mainScale.toY,
        fromX: lineEndX,
        price: exitPrice as number,
        label: 'EXIT',
        color: focusedTradeRange.isProfit ? '#39d98a' : '#ff6b6b',
        dash: [6, 3],
        alpha: 0.9,
        fontStack,
        priceDigits,
      });
    }
  } else {
    const elapsed = focusVisualStartedAt > 0 ? (now - focusVisualStartedAt) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed / 170);
    const fillAlpha = 0.18 + pulse * 0.14;
    const strokeAlpha = 0.5 + pulse * 0.38;
    const glowAlpha = 0.14 + pulse * 0.22;
    const rangeWidth = Math.max(2, x2 - x1);
    const candleFocus = focusedTradeRange.style === 'candle' && mainScale && drawStart === drawEnd;
    const candle = candleFocus ? data[drawStart] : null;
    const boxTop = candle && mainScale
      ? Math.max(mainTop, Math.min(mainH, Math.min(mainScale.toY(candle.high), mainScale.toY(candle.low)) - 6 - pulse * 3))
      : mainTop;
    const boxBottom = candle && mainScale
      ? Math.max(mainTop, Math.min(mainH, Math.max(mainScale.toY(candle.high), mainScale.toY(candle.low)) + 6 + pulse * 3))
      : mainH;
    const rangeHeight = Math.max(2, boxBottom - boxTop);
    ctx.save();
    ctx.fillStyle = `rgba(72,118,255,${fillAlpha.toFixed(3)})`;
    ctx.strokeStyle = `rgba(145,188,255,${strokeAlpha.toFixed(3)})`;
    ctx.shadowColor = `rgba(96,154,255,${glowAlpha.toFixed(3)})`;
    ctx.shadowBlur = 16 + pulse * 10;
    ctx.lineWidth = 1.3 + pulse * 0.7;
    ctx.fillRect(x1, boxTop, rangeWidth, rangeHeight);
    ctx.strokeRect(x1 + 0.5, boxTop + 0.5, Math.max(1, rangeWidth - 1), Math.max(1, rangeHeight - 1));
    ctx.restore();
  }

  if (!isMouseOver && focusedTradeRange.type !== 'connector') {
    requestOverlayDraw();
  }
}
