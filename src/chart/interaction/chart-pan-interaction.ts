export interface ResolveHorizontalPanVirtualStartParams {
  pointerX: number;
  dragStartX: number;
  dragStartIndex: number;
  dragStartLeftPanBars: number;
  chartWidth: number;
  visibleCount: number;
  rightGapBars: number;
  normalizeHorizontalVirtualStart: (virtualStart: number, baseVirtualStart: number) => number;
}

export function resolveHorizontalPanVirtualStart(params: ResolveHorizontalPanVirtualStartParams): number | null {
  const {
    pointerX,
    dragStartX,
    dragStartIndex,
    dragStartLeftPanBars,
    chartWidth,
    visibleCount,
    rightGapBars,
    normalizeHorizontalVirtualStart,
  } = params;
  const candlePixelWidth = chartWidth / (visibleCount + Math.max(0, rightGapBars));
  if (candlePixelWidth <= 0) return null;
  const dx = pointerX - dragStartX;
  const shift = Math.floor(dx / candlePixelWidth) * -1;
  const baseVirtualStart = dragStartIndex - dragStartLeftPanBars;
  return normalizeHorizontalVirtualStart(baseVirtualStart + shift, baseVirtualStart);
}

export interface ResolveVerticalPanOffsetParams {
  pointerY: number;
  dragStartY: number;
  dragStartPriceOffset: number;
  currentPriceOffset: number;
  pricePerPixel: number;
}

export function resolveVerticalPanOffset(params: ResolveVerticalPanOffsetParams): number | null {
  const {
    pointerY,
    dragStartY,
    dragStartPriceOffset,
    currentPriceOffset,
    pricePerPixel,
  } = params;
  const dy = pointerY - dragStartY;
  const nextPriceOffset = dragStartPriceOffset + dy * pricePerPixel;
  if (!Number.isFinite(nextPriceOffset)) return null;
  if (Math.abs(nextPriceOffset - currentPriceOffset) <= 1e-12) return null;
  return nextPriceOffset;
}
