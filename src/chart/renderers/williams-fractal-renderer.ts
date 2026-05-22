export interface WilliamsFractalRenderStyle {
  color: string;
}

export interface WilliamsFractalRenderData {
  highs: Array<number | null>;
  lows: Array<number | null>;
}

export interface WilliamsFractalRenderParams {
  ctx: CanvasRenderingContext2D;
  data: WilliamsFractalRenderData;
  startIndex: number;
  visLength: number;
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  highStyle: WilliamsFractalRenderStyle;
  lowStyle: WilliamsFractalRenderStyle;
  showHigh: boolean;
  showLow: boolean;
  getY: (price: number) => number;
}

export function getWilliamsFractalMarkerGeometry(candleW: number): {
  markerSize: number;
  markerOffset: number;
} {
  const markerSize = Math.max(5, Math.min(10, candleW * 0.42));
  const markerOffset = Math.max(7, markerSize + 3);
  return { markerSize, markerOffset };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  pointsUp: boolean,
  markerSize: number,
): void {
  ctx.beginPath();
  if (pointsUp) {
    ctx.moveTo(x, y - markerSize);
    ctx.lineTo(x - markerSize * 0.72, y + markerSize * 0.45);
    ctx.lineTo(x + markerSize * 0.72, y + markerSize * 0.45);
  } else {
    ctx.moveTo(x, y + markerSize);
    ctx.lineTo(x - markerSize * 0.72, y - markerSize * 0.45);
    ctx.lineTo(x + markerSize * 0.72, y - markerSize * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function renderWilliamsFractals(params: WilliamsFractalRenderParams): void {
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
    highStyle,
    lowStyle,
    showHigh,
    showLow,
    getY,
  } = params;
  const { markerSize, markerOffset } = getWilliamsFractalMarkerGeometry(candleW);

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, Math.max(1, chartRight - chartLeft), Math.max(1, bottom - top));
  ctx.clip();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const x = effectiveChartLeft + i * totalSp + candleW / 2;
    const high = data.highs[gi];
    const low = data.lows[gi];
    if (high != null && showHigh) {
      drawTriangle(ctx, x, getY(high) - markerOffset, highStyle.color, false, markerSize);
    }
    if (low != null && showLow) {
      drawTriangle(ctx, x, getY(low) + markerOffset, lowStyle.color, true, markerSize);
    }
  }
  ctx.restore();
}
