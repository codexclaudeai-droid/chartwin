export type DrawingLineStyle = 'solid' | 'dash' | 'dot';

export interface DrawingViewportMetrics {
  totalSp: number;
  candleW: number;
  getY: (price: number) => number;
}

export interface DrawingChartBounds {
  chartLeft: number;
  chartRight: number;
}

export interface DrawingAxisMetrics {
  axisPad: number;
  axisSide: 'left' | 'right';
  axisLeft: number;
}

const DASH_BY_STYLE: Record<DrawingLineStyle, number[]> = {
  solid: [],
  dash: [10, 6],
  dot: [2, 5],
};

export function getLineDash(style: DrawingLineStyle): number[] {
  return DASH_BY_STYLE[style];
}

export function setCanvasStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  dash: number[],
  alpha = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.globalAlpha = alpha;
}

export function drawPriceArrowBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  side: 'left' | 'right',
  arrowDepth = 5,
): void {
  const half = height / 2;
  ctx.beginPath();
  if (side === 'right') {
    ctx.moveTo(x, y);
    ctx.lineTo(x + arrowDepth, y - half);
    ctx.lineTo(x + width, y - half);
    ctx.lineTo(x + width, y + half);
    ctx.lineTo(x + arrowDepth, y + half);
  } else {
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width - arrowDepth, y - half);
    ctx.lineTo(x, y - half);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x + width - arrowDepth, y + half);
  }
  ctx.closePath();
}

export function getPriceArrowTextAnchor(
  x: number,
  width: number,
  side: 'left' | 'right',
  arrowDepth: number,
): { align: CanvasTextAlign; x: number } {
  void side;
  void arrowDepth;
  return { align: 'center', x: x + (width / 2) };
}
