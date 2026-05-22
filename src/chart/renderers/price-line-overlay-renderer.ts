import { getContrastTextColor, toRgba } from '../color-utils.ts';
import {
  drawPriceArrowBox,
  getPriceArrowTextAnchor,
} from '../drawings/drawing-renderer-utils.ts';
import { formatWithComma } from '../axis-utils.ts';

export interface RenderPriceLineOverlayParams {
  ctx: CanvasRenderingContext2D;
  chartLeft: number;
  chartRight: number;
  axisPad: number;
  axisSide: 'left' | 'right';
  totalSp: number;
  mainH: number;
  minP: number;
  maxP: number;
  getY: (price: number) => number;
  fromX: number;
  price: number;
  label: string;
  color: string;
  dash: number[];
  alpha?: number;
  fontStack: string;
  priceDigits: number;
}

export function drawPriceLineOverlay(params: RenderPriceLineOverlayParams): void {
  const {
    ctx,
    chartLeft,
    chartRight,
    axisPad,
    axisSide,
    totalSp,
    mainH,
    minP,
    maxP,
    getY,
    fromX,
    price,
    label,
    color,
    dash,
    alpha = 0.92,
    fontStack,
    priceDigits,
  } = params;
  if (price < minP || price > maxP) return;
  const y = getY(price);
  if (y < 0 || y > mainH) return;

  const priceText = formatWithComma(price, priceDigits);
  const boxHeight = 20;
  const boxWidth = axisSide === 'left'
    ? Math.max(46, axisPad - 10)
    : Math.max(46, axisPad - 2);
  const boxX = axisSide === 'left' ? 6 : chartRight;
  const labelPadX = 6;
  ctx.font = `700 9px ${fontStack}`;
  const labelTextWidth = Math.ceil(ctx.measureText(label).width);
  const labelWidth = Math.max(24, labelTextWidth + labelPadX * 2);
  const labelHeight = 16;
  const labelGap = 4;
  const labelX = axisSide === 'left'
    ? boxX + boxWidth + labelGap
    : boxX - labelWidth - labelGap;
  const lineEndX = axisSide === 'right'
    ? Math.max(fromX + 10, labelX - 6)
    : Math.max(fromX + totalSp * 2, chartRight - 6);

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, 0, Math.max(1, chartRight - chartLeft), Math.max(1, mainH));
  ctx.clip();
  ctx.strokeStyle = toRgba(color, alpha, color);
  ctx.lineWidth = 1.1;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(fromX, Math.round(y) + 0.5);
  ctx.lineTo(lineEndX, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();

  ctx.setLineDash([]);
  ctx.fillStyle = '#111a2b';
  ctx.strokeStyle = toRgba(color, 0.9, color);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(labelX, y - labelHeight / 2, labelWidth, labelHeight, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `700 9px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelX + labelWidth / 2, y + 0.5);

  ctx.fillStyle = toRgba(color, 0.95, color);
  drawPriceArrowBox(ctx, boxX, y, boxWidth, boxHeight, axisSide, 5);
  ctx.fill();
  ctx.strokeStyle = toRgba(color, 1, color);
  ctx.lineWidth = 1;
  ctx.stroke();

  const textAnchor = getPriceArrowTextAnchor(boxX, boxWidth, axisSide, 5);
  ctx.textAlign = textAnchor.align;
  ctx.fillStyle = getContrastTextColor(color);
  ctx.font = `700 10px ${fontStack}`;
  ctx.fillText(priceText, textAnchor.x, y + 0.5);
}
