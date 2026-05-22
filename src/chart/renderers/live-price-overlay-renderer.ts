import type { CandleData } from '../../types.ts';
import { getContrastTextColor } from '../color-utils.ts';
import {
  drawPriceArrowBox,
  getPriceArrowTextAnchor,
} from '../drawings/drawing-renderer-utils.ts';

export interface LivePriceOverlayGeometry {
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  axisPad: number;
  side: 'left' | 'right';
}

export interface RenderLivePriceOverlayParams {
  ctx: CanvasRenderingContext2D;
  data: CandleData[];
  endIndex: number;
  mainTop: number;
  mainH: number;
  geometry: LivePriceOverlayGeometry;
  linearToY: ((price: number) => number) | null;
  hidden: boolean;
  fontStack: string;
  formatPrice: (value: number) => string;
}

export function renderLivePriceOverlay(params: RenderLivePriceOverlayParams): void {
  const {
    ctx,
    data,
    endIndex,
    mainTop,
    mainH,
    geometry,
    linearToY,
    hidden,
    fontStack,
    formatPrice,
  } = params;

  if (!data.length || !linearToY || hidden) return;

  const rawPriceIndex = Number.isFinite(endIndex) ? endIndex - 1 : data.length - 1;
  const priceIndex = Math.max(0, Math.min(data.length - 1, rawPriceIndex));
  const priceCandle = data[priceIndex];
  if (!priceCandle) return;

  const last = priceCandle.close;
  const previous = priceIndex > 0 ? data[priceIndex - 1].close : last;
  const y = linearToY(last);
  if (y < mainTop || y > mainH) return;

  const isUp = last >= previous;
  const boxColor = isUp ? '#22ab94' : '#f23645';
  ctx.strokeStyle = isUp ? 'rgba(34,171,148,0.9)' : 'rgba(242,54,69,0.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 2]);
  ctx.lineCap = 'round';
  ctx.save();
  ctx.beginPath();
  ctx.rect(geometry.chartLeft, mainTop, geometry.chartWidth, Math.max(0, mainH - mainTop));
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(geometry.chartLeft, y);
  ctx.lineTo(geometry.chartRight, y);
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';

  const boundaryPadding = 12;
  if (y >= mainH - boundaryPadding) return;

  ctx.fillStyle = boxColor;
  const priceBoxWidth = geometry.side === 'left'
    ? Math.max(20, geometry.axisPad - 10)
    : Math.max(20, geometry.axisPad - 2);
  const priceBoxX = geometry.side === 'left' ? 6 : geometry.chartRight;
  drawPriceArrowBox(ctx, priceBoxX, y, priceBoxWidth, 20, geometry.side);
  ctx.fill();
  ctx.fillStyle = getContrastTextColor(boxColor);
  const priceTextAnchor = getPriceArrowTextAnchor(priceBoxX, priceBoxWidth, geometry.side, 5);
  ctx.font = `500 11px ${fontStack}`;
  ctx.textAlign = priceTextAnchor.align;
  ctx.fillText(formatPrice(last), priceTextAnchor.x, y + 4);
}
