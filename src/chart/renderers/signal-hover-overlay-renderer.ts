import { getContrastTextColor } from '../color-utils.ts';

export interface SignalHoverArea {
  x: number;
  y: number;
  r: number;
  signal: number;
  candleIndex: number;
  entryPrice: number;
}

export interface SignalHoverMainScale {
  toY: (price: number) => number;
}

export interface RenderSignalHoverOverlayParams {
  ctx: CanvasRenderingContext2D;
  hoverSignal: SignalHoverArea | null;
  width: number;
  chartLeft: number;
  chartRight: number;
  mainTop: number;
  mainH: number;
  axisPad: number;
  axisSide: 'left' | 'right';
  fontStack: string;
  mainScale: SignalHoverMainScale | null;
  formatPrice: (value: number) => string;
}

export interface SelectSignalHoverAreaParams {
  areas: SignalHoverArea[];
  mouseX: number;
  mouseY: number;
  chartLeft: number;
  chartRight: number;
  candleW: number;
  totalSp: number;
  visibleCount: number;
  startIndex: number;
  focusedSignalCandleIndex: number | null;
}

export function selectSignalHoverArea(params: SelectSignalHoverAreaParams): SignalHoverArea | null {
  const {
    areas,
    mouseX,
    mouseY,
    chartLeft,
    chartRight,
    candleW,
    totalSp,
    visibleCount,
    startIndex,
    focusedSignalCandleIndex,
  } = params;

  let hoverSignal: SignalHoverArea | null = null;
  let minDistanceSq = Number.POSITIVE_INFINITY;
  for (const area of areas) {
    const dx = mouseX - area.x;
    const dy = mouseY - area.y;
    const distanceSq = dx * dx + dy * dy;
    const hitRadius = area.r + 6;
    if (distanceSq <= hitRadius * hitRadius && distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
      hoverSignal = area;
    }
  }

  if (!hoverSignal && focusedSignalCandleIndex != null) {
    hoverSignal = areas.find((area) => area.candleIndex === focusedSignalCandleIndex) ?? null;
  }

  if (!hoverSignal) {
    const axisCandleIndex = (() => {
      if (mouseX < chartLeft || mouseX > chartRight) return -1;
      const nearestIndex = Math.round((mouseX - chartLeft - candleW / 2) / totalSp);
      const clampedIndex = Math.max(0, Math.min(visibleCount - 1, nearestIndex));
      return startIndex + clampedIndex;
    })();

    if (axisCandleIndex >= 0) {
      hoverSignal = areas.find((area) => area.candleIndex === axisCandleIndex) ?? null;
    }
  }

  return hoverSignal;
}

export function renderSignalHoverOverlay(params: RenderSignalHoverOverlayParams): void {
  const {
    ctx,
    hoverSignal,
    width,
    chartLeft,
    chartRight,
    mainTop,
    mainH,
    axisPad,
    axisSide,
    fontStack,
    mainScale,
    formatPrice,
  } = params;
  if (!hoverSignal) return;

  const sideText = hoverSignal.signal > 0 ? 'BUY' : 'SELL';
  const priceText = `진입가 ${formatPrice(hoverSignal.entryPrice)}`;
  const text = `${sideText} · ${priceText}`;
  ctx.font = `12px ${fontStack}`;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  const boxWidth = textWidth + 16;
  const boxHeight = 24;
  const boxX = Math.min(
    Math.max(chartLeft + 8, hoverSignal.x + 12),
    chartRight - boxWidth - 4,
  );
  const boxY = Math.max(8, hoverSignal.y - boxHeight - 8);

  ctx.save();
  if (mainScale) {
    const entryY = mainScale.toY(hoverSignal.entryPrice);
    if (entryY >= mainTop && entryY <= mainH) {
      const lineColor = hoverSignal.signal > 0 ? '#2ecc71' : '#ff5252';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, entryY);
      ctx.lineTo(chartRight, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = lineColor;
      const entryBoxWidth = axisSide === 'left'
        ? Math.max(20, axisPad - 10)
        : Math.max(20, axisPad - 4);
      const entryBoxX = axisSide === 'left' ? 6 : (width - entryBoxWidth - 2);
      ctx.fillRect(entryBoxX, entryY - 10, entryBoxWidth, 20);
      ctx.fillStyle = getContrastTextColor(lineColor);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatPrice(hoverSignal.entryPrice), entryBoxX + (entryBoxWidth / 2), entryY);
    }
  }

  ctx.beginPath();
  ctx.strokeStyle = hoverSignal.signal > 0 ? '#2ecc71' : '#ff5252';
  ctx.lineWidth = 1.5;
  ctx.arc(hoverSignal.x, hoverSignal.y, hoverSignal.r + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(19,23,34,0.96)';
  ctx.strokeStyle = '#4a5060';
  ctx.lineWidth = 1;
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = '#f2f4f8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + 8, boxY + boxHeight / 2);
  ctx.restore();
}
