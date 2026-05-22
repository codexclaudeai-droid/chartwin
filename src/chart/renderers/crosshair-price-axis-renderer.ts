import {
  drawPriceArrowBox,
  getPriceArrowTextAnchor,
} from '../drawings/drawing-renderer-utils.ts';

export interface CrosshairPlusHit {
  x: number;
  y: number;
  r: number;
  price: number;
}

export interface RenderCrosshairPriceAxisParams {
  ctx: CanvasRenderingContext2D;
  mouseY: number;
  mainTop: number;
  mainH: number;
  chartRight: number;
  axisPad: number;
  axisSide: 'left' | 'right';
  axisLeft: number;
  axisRight: number;
  lo: number;
  hi: number;
  noDrawingInteraction: boolean;
  onYAxis: boolean;
  plusHovered: boolean;
  textColor: string;
  fontStack: string;
  formatPrice: (value: number) => string;
}

export function renderCrosshairPriceAxis(params: RenderCrosshairPriceAxisParams): CrosshairPlusHit | null {
  const {
    ctx,
    mouseY,
    mainTop,
    mainH,
    chartRight,
    axisPad,
    axisSide,
    axisLeft,
    axisRight,
    lo,
    hi,
    noDrawingInteraction,
    onYAxis,
    plusHovered,
    textColor,
    fontStack,
    formatPrice,
  } = params;

  if (mouseY >= mainH || !noDrawingInteraction || onYAxis) return null;

  const price = hi - (mouseY - mainTop) / (mainH - mainTop || 1) * (hi - lo);
  ctx.fillStyle = '#2a2e39';
  const priceBoxWidth = axisSide === 'left'
    ? Math.max(20, axisPad - 10)
    : Math.max(20, axisPad - 2);
  const priceBoxX = axisSide === 'left' ? 6 : chartRight;
  drawPriceArrowBox(ctx, priceBoxX, mouseY, priceBoxWidth, 20, axisSide);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();
  const textAnchor = getPriceArrowTextAnchor(priceBoxX, priceBoxWidth, axisSide, 5);
  ctx.fillStyle = textColor;
  ctx.font = `500 11px ${fontStack}`;
  ctx.textAlign = textAnchor.align;
  ctx.fillText(formatPrice(price), textAnchor.x, mouseY + 4);

  const plusRadius = 9;
  const plusX = axisSide === 'left'
    ? (axisRight + plusRadius + 4)
    : (axisLeft - plusRadius - 4);
  const plusY = mouseY;
  ctx.save();
  ctx.beginPath();
  ctx.arc(plusX, plusY, plusRadius, 0, Math.PI * 2);
  ctx.fillStyle = plusHovered ? '#2962ff' : 'rgba(41,98,255,0.75)';
  ctx.fill();
  ctx.strokeStyle = plusHovered ? '#6fa3ff' : 'rgba(130,170,255,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(plusX - 4.5, plusY);
  ctx.lineTo(plusX + 4.5, plusY);
  ctx.moveTo(plusX, plusY - 4.5);
  ctx.lineTo(plusX, plusY + 4.5);
  ctx.stroke();
  ctx.restore();

  return { x: plusX, y: plusY, r: plusRadius * 2 + 4, price };
}
