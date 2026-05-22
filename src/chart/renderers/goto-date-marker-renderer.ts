import type { CandleData } from '../../types.ts';

export interface GotoDateMarker {
  candleIndex: number;
  label: string;
}

export interface RenderGotoDateMarkerParams {
  ctx: CanvasRenderingContext2D;
  marker: GotoDateMarker | null;
  data: CandleData[];
  startIndex: number;
  endIndex: number;
  chartLeft: number;
  chartRight: number;
  mainTop: number;
  mainH: number;
  totalSp: number;
  candleW: number;
  fontStack: string;
  getY: ((price: number) => number) | null;
  getCandleCenterX: (index: number) => number | null;
}

export function renderGotoDateMarker(params: RenderGotoDateMarkerParams): void {
  const {
    ctx,
    marker,
    data,
    startIndex,
    endIndex,
    chartLeft,
    chartRight,
    mainTop,
    mainH,
    totalSp,
    candleW,
    fontStack,
    getY,
    getCandleCenterX,
  } = params;
  if (!marker || !getY) return;

  const index = marker.candleIndex;
  const candle = data[index];
  if (index < startIndex || index >= endIndex || !candle) return;

  const markerX = getCandleCenterX(index) ?? (chartLeft + (index - startIndex) * totalSp + candleW / 2);
  const markerY = Math.max(mainTop + 14, Math.min(mainH - 10, getY(candle.high) - 10));
  const text = marker.label;

  ctx.save();
  ctx.font = `700 11px ${fontStack}`;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  const boxWidth = Math.max(70, textWidth + 12);
  const boxHeight = 20;
  const boxX = Math.max(chartLeft + 4, Math.min(chartRight - boxWidth - 4, markerX - boxWidth / 2));
  const boxY = Math.max(mainTop + 2, markerY - boxHeight - 12);

  ctx.beginPath();
  ctx.moveTo(markerX, markerY);
  ctx.lineTo(markerX - 6, boxY + boxHeight);
  ctx.lineTo(markerX + 6, boxY + boxHeight);
  ctx.closePath();
  ctx.fillStyle = '#111827';
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f9fafb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5);
  ctx.restore();
}
