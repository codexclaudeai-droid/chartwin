import type { MainGridGeometry } from './main-grid-renderer.ts';

export interface AxisOverlayMetrics {
  axisDigits: number;
  tickCount: number;
  axisBottomPadding: number;
}

export interface SharedYAxisOverlayParams {
  ctx: CanvasRenderingContext2D;
  geometry: MainGridGeometry;
  chartRight: number;
  mainHeight: number;
  minPrice: number;
  maxPrice: number;
  mainAxisStep: number;
  getYLinear: (price: number) => number;
  symbolPriceDigits: number;
  chartTextSecondary: string;
  fontStack: string;
  formatPrice: (value: number, digits: number) => string;
  metrics: AxisOverlayMetrics;
}

export function renderLeftYAxisOverlay(params: SharedYAxisOverlayParams & {
  yAxisTransparent: boolean;
}): void {
  const {
    ctx,
    geometry,
    mainHeight,
    minPrice,
    maxPrice,
    mainAxisStep,
    getYLinear,
    symbolPriceDigits,
    chartTextSecondary,
    fontStack,
    formatPrice,
    metrics,
    yAxisTransparent,
  } = params;
  if (geometry.side !== 'left') return;

  ctx.save();
  if (!yAxisTransparent) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, geometry.axisPad, mainHeight);
    ctx.strokeStyle = '#2a3142';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(geometry.axisPad - 0.5, 0);
    ctx.lineTo(geometry.axisPad - 0.5, mainHeight);
    ctx.stroke();
  }
  ctx.fillStyle = chartTextSecondary;
  ctx.font = `400 11px ${fontStack}`;
  ctx.textAlign = 'right';
  for (let i = 0; i < metrics.tickCount; i += 1) {
    const price = maxPrice - i * mainAxisStep;
    if (price < minPrice - mainAxisStep * 0.5) break;
    const y = getYLinear(price);
    if (y >= mainHeight - metrics.axisBottomPadding) continue;
    if (!yAxisTransparent) {
      ctx.fillText(
        formatPrice(Number(price.toFixed(metrics.axisDigits)), symbolPriceDigits),
        geometry.axisPad - 6,
        y + 4,
      );
    }
  }
  ctx.restore();
}

export function renderPanelTimeSeparator(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  plotHeight: number;
}): void {
  const { ctx, width, plotHeight } = params;
  ctx.save();
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, plotHeight + 0.5);
  ctx.lineTo(width, plotHeight + 0.5);
  ctx.stroke();
  ctx.restore();
}

export function renderTransparentYAxisLabels(params: SharedYAxisOverlayParams): void {
  const {
    ctx,
    geometry,
    chartRight,
    mainHeight,
    minPrice,
    maxPrice,
    mainAxisStep,
    getYLinear,
    symbolPriceDigits,
    chartTextSecondary,
    fontStack,
    formatPrice,
    metrics,
  } = params;

  ctx.save();
  ctx.fillStyle = chartTextSecondary;
  ctx.font = `400 11px ${fontStack}`;
  ctx.textAlign = geometry.side === 'left' ? 'right' : 'left';
  const transparentAxisTextX = geometry.side === 'left' ? geometry.axisPad - 6 : chartRight + 4;
  for (let i = 0; i < metrics.tickCount; i += 1) {
    const price = maxPrice - i * mainAxisStep;
    if (price < minPrice - mainAxisStep * 0.5) break;
    const y = getYLinear(price);
    if (y >= mainHeight - metrics.axisBottomPadding) continue;
    ctx.fillText(
      formatPrice(Number(price.toFixed(metrics.axisDigits)), symbolPriceDigits),
      transparentAxisTextX,
      y + 4,
    );
  }
  ctx.restore();
}
