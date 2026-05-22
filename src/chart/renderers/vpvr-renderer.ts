import { toRgba } from '../color-utils.ts';
import type { IndicatorCandle } from '../indicators/index.ts';
import {
  buildVpvrProfile,
  calculateVpvrLayout,
  calculateVpvrValueArea,
} from '../indicators/vpvr.ts';

function formatVolumeFallback(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

export function getVpvrDashPattern(mode: string): number[] {
  if (mode === 'dotted') return [2, 3];
  if (mode === 'dashed') return [6, 4];
  return [];
}

export function renderVpvrBackground(params: {
  ctx: CanvasRenderingContext2D;
  enabled: boolean;
  vp: any;
  candles: IndicatorCandle[];
  minPrice: number;
  maxPrice: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  plotTop: number;
  plotBottom: number;
  symbolPriceDigits: number;
  fontStack: string;
  formatPrice: (value: number, digits: number) => string;
  formatVolume?: (value: number, digits: number) => string;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    enabled,
    vp,
    candles,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    symbolPriceDigits,
    fontStack,
    formatPrice,
    formatVolume = (value: number) => formatVolumeFallback(value),
    getY,
  } = params;
  if (!enabled) return;

  const layout = calculateVpvrLayout({ vp, minPrice, maxPrice, chartLeft, chartRight, chartWidth, symbolPriceDigits });
  const profile = buildVpvrProfile({
    candles,
    rows: layout.rows,
    minPrice,
    maxPrice,
    bucketSpan: layout.effectiveBucketSpan,
  });
  const maxTotal = Math.max(...profile.map((bucket) => bucket.total), 0);
  const maxAbsDelta = Math.max(...profile.map((bucket) => Math.abs(bucket.delta)), 0);
  if ((layout.volumeMode !== 'delta' && maxTotal <= 0) || (layout.volumeMode === 'delta' && maxAbsDelta <= 0)) return;

  const upColor = toRgba(String(vp.upColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(vp.upOpacity ?? 45) || 0) / 100)));
  const downColor = toRgba(String(vp.downColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(vp.downOpacity ?? 45) || 0) / 100)));
  const totalColor = toRgba(String(vp.totalColor ?? '#7f8aa3'), Math.max(0, Math.min(1, (Number(vp.totalOpacity ?? 40) || 0) / 100)));
  const deltaPosColor = toRgba(String(vp.deltaPosColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(vp.deltaOpacity ?? 50) || 0) / 100)));
  const deltaNegColor = toRgba(String(vp.deltaNegColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(vp.deltaOpacity ?? 50) || 0) / 100)));

  const { pocIndex, vaLow, vaHigh } = calculateVpvrValueArea(profile, layout.valueAreaVolume);

  const valPrice = minPrice + vaLow * layout.effectiveBucketSpan;
  const vahPrice = minPrice + (vaHigh + 1) * layout.effectiveBucketSpan;
  const pocLow = minPrice + pocIndex * layout.effectiveBucketSpan;
  const pocHigh = pocLow + layout.effectiveBucketSpan;
  const pocPrice = (pocLow + pocHigh) * 0.5;
  let pocY: number | null = null;
  let vahY: number | null = null;
  let valY: number | null = null;

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, plotTop, chartWidth, Math.max(1, plotBottom - plotTop));
  ctx.clip();

  if (vp.showVaBackground !== false) {
    const vaBg = toRgba(String(vp.vaBgColor ?? '#3a5f94'), Math.max(0, Math.min(1, (Number(vp.vaBgOpacity ?? 18) || 0) / 100)));
    const yTop = getY(vahPrice);
    const yBottom = getY(valPrice);
    ctx.fillStyle = vaBg;
    ctx.fillRect(chartLeft, Math.min(yTop, yBottom), chartWidth, Math.max(1, Math.abs(yBottom - yTop)));
  }

  for (let index = 0; index < layout.rows; index += 1) {
    const bucket = profile[index];
    if (bucket.total <= 0) continue;
    const low = minPrice + index * layout.effectiveBucketSpan;
    const high = low + layout.effectiveBucketSpan;
    const yTop = getY(high);
    const yBottom = getY(low);
    const y = Math.min(yTop, yBottom);
    const height = Math.max(1, Math.abs(yBottom - yTop) - 1);

    if (layout.volumeMode === 'total') {
      const width = (bucket.total / maxTotal) * layout.regionWidth;
      if (width <= 0.5) continue;
      const x = layout.placement === 'left' ? layout.regionStart : (layout.regionEnd - width);
      ctx.fillStyle = totalColor;
      ctx.fillRect(x, y, width, height);
    } else if (layout.volumeMode === 'up_down') {
      const totalWidth = (bucket.total / maxTotal) * layout.regionWidth;
      if (totalWidth <= 0.5) continue;
      const downWidth = totalWidth * (bucket.down / Math.max(bucket.total, 1e-12));
      const upWidth = Math.max(0, totalWidth - downWidth);
      let xCursor = layout.placement === 'left' ? layout.regionStart : (layout.regionEnd - totalWidth);
      if (downWidth > 0.5) {
        ctx.fillStyle = downColor;
        ctx.fillRect(xCursor, y, downWidth, height);
      }
      xCursor += downWidth;
      if (upWidth > 0.5) {
        ctx.fillStyle = upColor;
        ctx.fillRect(xCursor, y, upWidth, height);
      }
    } else {
      const delta = bucket.delta;
      const width = (Math.abs(delta) / maxAbsDelta) * (layout.regionWidth * 0.5);
      if (width <= 0.5) continue;
      ctx.fillStyle = delta >= 0 ? deltaPosColor : deltaNegColor;
      ctx.fillRect(delta >= 0 ? layout.centerX : layout.centerX - width, y, width, height);
    }

    if (vp.valuesVisible === true && height >= 10) {
      const value = layout.volumeMode === 'delta' ? bucket.delta : bucket.total;
      const text = formatVolume(value, 0);
      if (text !== '-') {
        ctx.fillStyle = String(vp.valuesTextColor ?? '#cfd8ea');
        ctx.font = `10px ${fontStack}`;
        ctx.textAlign = layout.placement === 'left' ? 'left' : 'right';
        const textX = layout.placement === 'left' ? (layout.regionStart + 2) : (layout.regionEnd - 2);
        ctx.fillText(text, textX, y + Math.max(9, height * 0.75));
      }
    }
  }

  if (vp.showPoc !== false) {
    ctx.strokeStyle = String(vp.pocColor ?? '#ffc107');
    ctx.lineWidth = Math.max(0.5, Number(vp.pocWidth ?? 1.2) || 1.2);
    ctx.setLineDash(getVpvrDashPattern(String(vp.pocLineStyle ?? 'dashed')));
    pocY = getY(pocPrice);
    ctx.beginPath();
    ctx.moveTo(layout.regionStart, pocY);
    ctx.lineTo(layout.regionEnd, pocY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (vp.showVahVal !== false) {
    ctx.strokeStyle = String(vp.vahValColor ?? '#8ab4ff');
    ctx.lineWidth = Math.max(0.5, Number(vp.vahValWidth ?? 1) || 1);
    ctx.setLineDash(getVpvrDashPattern(String(vp.vahValLineStyle ?? 'dashed')));
    vahY = getY(vahPrice);
    valY = getY(valPrice);
    ctx.beginPath();
    ctx.moveTo(layout.regionStart, vahY);
    ctx.lineTo(layout.regionEnd, vahY);
    ctx.moveTo(layout.regionStart, valY);
    ctx.lineTo(layout.regionEnd, valY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  const drawLevelTag = (y: number, price: number, suffix: string, bgColor: string, textColor: string) => {
    const label = `${formatPrice(price, symbolPriceDigits)} ${suffix}`;
    ctx.save();
    ctx.font = `600 10px ${fontStack}`;
    const padX = 6;
    const height = 16;
    const width = Math.ceil(ctx.measureText(label).width) + padX * 2;
    const clampedY = Math.max(height * 0.5 + 2, Math.min(plotBottom - height * 0.5 - 2, y));
    const yTop = Math.round(clampedY - height * 0.5);
    const x = layout.placement === 'right'
      ? Math.max(chartLeft + 2, layout.regionEnd - width - 2)
      : Math.min(chartRight - width - 2, layout.regionStart + 2);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, yTop, width, height);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + padX, yTop + 11);
    ctx.restore();
  };

  if (pocY != null && vp.showPoc !== false) {
    drawLevelTag(pocY, pocPrice, 'POC', String(vp.pocColor ?? '#ffc107'), '#111827');
  }
  if (vahY != null && vp.showVahVal !== false) {
    drawLevelTag(vahY, vahPrice, 'VAH', String(vp.vahValColor ?? '#8ab4ff'), '#0b1220');
  }
  if (valY != null && vp.showVahVal !== false) {
    drawLevelTag(valY, valPrice, 'VAL', String(vp.vahValColor ?? '#8ab4ff'), '#0b1220');
  }
}
