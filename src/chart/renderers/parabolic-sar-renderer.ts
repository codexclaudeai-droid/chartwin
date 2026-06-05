export interface ParabolicSarRenderStyle {
  color: string;
  width: number;
}

export interface ParabolicSarRenderParams {
  ctx: CanvasRenderingContext2D;
  data: Array<number | null>;
  startIndex: number;
  visLength: number;
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  style: ParabolicSarRenderStyle;
  getY: (price: number) => number;
}

export function getParabolicSarMarkerSize(candleW: number): number {
  return Math.max(3, Math.min(7, candleW * 0.32));
}

export function renderParabolicSar(params: ParabolicSarRenderParams): void {
  const {
    ctx,
    data,
    startIndex,
    visLength,
    chartLeft,
    chartRight,
    effectiveChartLeft,
    totalSp,
    candleW,
    top,
    bottom,
    style,
    getY,
  } = params;
  const markerSize = getParabolicSarMarkerSize(candleW);

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, Math.max(1, chartRight - chartLeft), Math.max(1, bottom - top));
  ctx.clip();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;

  for (let i = 0; i < visLength; i += 1) {
    const value = data[startIndex + i];
    if (value == null) continue;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    const y = getY(value);
    ctx.beginPath();
    ctx.moveTo(x - markerSize, y);
    ctx.lineTo(x + markerSize, y);
    ctx.moveTo(x, y - markerSize);
    ctx.lineTo(x, y + markerSize);
    ctx.stroke();
  }

  ctx.restore();
}
