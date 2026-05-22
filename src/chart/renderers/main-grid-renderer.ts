export interface MainGridGeometry {
  side: 'left' | 'right';
  axisPad: number;
}

export interface RenderMainGridParams {
  ctx: CanvasRenderingContext2D;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  width: number;
  mainHeight: number;
  plotHeight: number;
  yAxisTransparent: boolean;
  geometry: MainGridGeometry;
  minPrice: number;
  maxPrice: number;
  mainAxisStep: number;
  getYLinear: (price: number) => number;
  symbolPriceDigits: number;
  chartTextSecondary: string;
  fontStack: string;
  formatPrice: (value: number, digits: number) => string;
  tickIndices: number[];
  effectiveChartLeft: number;
  totalSpacing: number;
  candleWidth: number;
  gridColor?: string;
}

export function getMainGridAxisMetrics(params: {
  minPrice: number;
  maxPrice: number;
  mainAxisStep: number;
}) {
  const { minPrice, maxPrice, mainAxisStep } = params;
  return {
    axisDigits: Math.max(0, Math.ceil(-Math.log10(mainAxisStep)) + 2),
    tickCount: Math.max(1, Math.floor((maxPrice - minPrice) / mainAxisStep) + 1),
    axisBottomPadding: 14,
  };
}

export function renderMainGrid(params: RenderMainGridParams): void {
  const {
    ctx,
    chartLeft,
    chartRight,
    chartWidth,
    width,
    mainHeight,
    plotHeight,
    yAxisTransparent,
    geometry,
    minPrice,
    maxPrice,
    mainAxisStep,
    getYLinear,
    symbolPriceDigits,
    chartTextSecondary,
    fontStack,
    formatPrice,
    tickIndices,
    effectiveChartLeft,
    totalSpacing,
    candleWidth,
    gridColor = '#1e2230',
  } = params;
  const { axisDigits, tickCount, axisBottomPadding } = getMainGridAxisMetrics({
    minPrice,
    maxPrice,
    mainAxisStep,
  });

  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = chartTextSecondary;
  ctx.font = `400 11px ${fontStack}`;
  ctx.textAlign = 'center';
  const axisLineLeft = yAxisTransparent && geometry.side === 'left' ? 0 : chartLeft;
  const axisLineRight = yAxisTransparent && geometry.side === 'right' ? width : chartRight;
  for (let i = 0; i < tickCount; i += 1) {
    const price = maxPrice - i * mainAxisStep;
    if (price < minPrice - mainAxisStep * 0.5) break;
    const y = getYLinear(price);
    if (y >= mainHeight - axisBottomPadding) continue;
    ctx.beginPath();
    ctx.moveTo(axisLineLeft, y);
    ctx.lineTo(axisLineRight, y);
    ctx.stroke();
    const axisTextX = geometry.side === 'left'
      ? (geometry.axisPad * 0.5)
      : (chartRight + (geometry.axisPad * 0.5));
    if (!yAxisTransparent) {
      ctx.fillText(formatPrice(Number(price.toFixed(axisDigits)), symbolPriceDigits), axisTextX, y + 4);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(yAxisTransparent ? 0 : chartLeft, 0, yAxisTransparent ? width : chartWidth, plotHeight);
  ctx.clip();
  ctx.strokeStyle = gridColor;
  tickIndices.forEach((index) => {
    const x = effectiveChartLeft + index * totalSpacing + candleWidth / 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, plotHeight);
    ctx.stroke();
  });
  ctx.restore();
}
