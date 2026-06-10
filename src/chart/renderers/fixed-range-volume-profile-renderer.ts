import { toRgba } from '../color-utils.ts';
import {
  buildFixedRangeVolumeProfile,
  getFixedRangeCandles,
  type FixedRangeVolumeMode,
} from '../indicators/fixed-range-volume-profile.ts';
import { calculateVpvrValueArea } from '../indicators/vpvr.ts';
import type { CandleData } from '../../types.ts';
import { getVpvrDashPattern } from './vpvr-renderer.ts';

function formatVolumeFallback(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function getRangeIndexBounds(candles: CandleData[], startTime: number, endTime: number): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  candles.forEach((candle, index) => {
    if (candle.time < startTime || candle.time > endTime) return;
    if (start < 0) start = index;
    end = index;
  });
  return start >= 0 && end >= start ? { start, end } : null;
}

export function renderFixedRangeVolumeProfile(params: {
  ctx: CanvasRenderingContext2D;
  enabled: boolean;
  config: any;
  allCandles: CandleData[];
  startIndex: number;
  minPrice: number;
  maxPrice: number;
  chartLeft: number;
  chartRight: number;
  chartWidth: number;
  plotTop: number;
  plotBottom: number;
  effectiveChartLeft: number;
  totalSpacing: number;
  candleWidth: number;
  fontStack: string;
  symbolPriceDigits: number;
  formatPrice: (value: number, digits: number) => string;
  formatVolume?: (value: number, digits: number) => string;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    enabled,
    config,
    allCandles,
    startIndex,
    minPrice,
    maxPrice,
    chartLeft,
    chartRight,
    chartWidth,
    plotTop,
    plotBottom,
    effectiveChartLeft,
    totalSpacing,
    candleWidth,
    fontStack,
    symbolPriceDigits,
    formatPrice,
    formatVolume = (value: number) => formatVolumeFallback(value),
    getY,
  } = params;
  if (!enabled || !allCandles.length) return;

  const selectedCandles = getFixedRangeCandles(allCandles, Number(config.rangeStartTime), Number(config.rangeEndTime));
  if (!selectedCandles.length) return;
  const startTime = selectedCandles[0].time;
  const endTime = selectedCandles[selectedCandles.length - 1].time;
  const indexBounds = getRangeIndexBounds(allCandles, startTime, endTime);
  if (!indexBounds) return;

  const rows = Math.max(4, Math.min(450, Math.floor(Number(config.rowSize ?? config.rows ?? 50) || 50)));
  const widthRatio = Math.max(0.05, Math.min(0.65, (Number(config.widthPct ?? 30) || 30) / 100));
  const valueAreaVolume = Math.max(1, Math.min(100, Number(config.valueAreaVolume ?? 70) || 70));
  const volumeMode = ((config.volumeMode === 'total' || config.volumeMode === 'delta') ? config.volumeMode : 'up_down') as FixedRangeVolumeMode;
  const profileMin = Math.max(minPrice, Math.min(...selectedCandles.map((candle) => Math.min(candle.low, candle.high))));
  const profileMax = Math.min(maxPrice, Math.max(...selectedCandles.map((candle) => Math.max(candle.low, candle.high))));
  if (!(profileMax > profileMin)) return;

  const profile = buildFixedRangeVolumeProfile({
    candles: selectedCandles,
    rows,
    minPrice: profileMin,
    maxPrice: profileMax,
  });
  if ((volumeMode !== 'delta' && profile.maxTotal <= 0) || (volumeMode === 'delta' && profile.maxAbsDelta <= 0)) return;

  const rangeX1 = effectiveChartLeft + (indexBounds.start - startIndex) * totalSpacing + candleWidth * 0.5;
  const rangeX2 = effectiveChartLeft + (indexBounds.end - startIndex) * totalSpacing + candleWidth * 0.5;
  const selectedLeft = Math.max(chartLeft, Math.min(rangeX1, rangeX2));
  const selectedRight = Math.min(chartRight, Math.max(rangeX1, rangeX2));
  if (selectedRight <= chartLeft || selectedLeft >= chartRight) return;
  const selectedWidth = Math.max(totalSpacing, selectedRight - selectedLeft + totalSpacing);
  const regionWidth = Math.max(12, Math.min(chartWidth * widthRatio, selectedWidth * widthRatio));
  const regionEnd = Math.min(chartRight, selectedRight);
  const regionStart = Math.max(chartLeft, regionEnd - regionWidth);
  const centerX = (regionStart + regionEnd) * 0.5;

  const upColor = toRgba(String(config.upColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(config.upOpacity ?? 45) || 0) / 100)));
  const downColor = toRgba(String(config.downColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(config.downOpacity ?? 45) || 0) / 100)));
  const totalColor = toRgba(String(config.totalColor ?? '#7f8aa3'), Math.max(0, Math.min(1, (Number(config.totalOpacity ?? 38) || 0) / 100)));
  const deltaPosColor = toRgba(String(config.deltaPosColor ?? '#26a69a'), Math.max(0, Math.min(1, (Number(config.deltaOpacity ?? 50) || 0) / 100)));
  const deltaNegColor = toRgba(String(config.deltaNegColor ?? '#ef5350'), Math.max(0, Math.min(1, (Number(config.deltaOpacity ?? 50) || 0) / 100)));
  const { pocIndex, vaLow, vaHigh } = calculateVpvrValueArea(profile.buckets, valueAreaVolume);

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, plotTop, chartWidth, Math.max(1, plotBottom - plotTop));
  ctx.clip();

  if (config.showRangeBox !== false) {
    ctx.fillStyle = toRgba(String(config.rangeBgColor ?? '#94a3b8'), Math.max(0, Math.min(1, (Number(config.rangeBgOpacity ?? 8) || 0) / 100)));
    ctx.fillRect(selectedLeft, plotTop, Math.max(1, selectedRight - selectedLeft), Math.max(1, plotBottom - plotTop));
  }

  if (config.showVaBackground !== false) {
    const yTop = getY(profileMin + (vaHigh + 1) * profile.bucketSpan);
    const yBottom = getY(profileMin + vaLow * profile.bucketSpan);
    ctx.fillStyle = toRgba(String(config.vaBgColor ?? '#3a5f94'), Math.max(0, Math.min(1, (Number(config.vaBgOpacity ?? 16) || 0) / 100)));
    ctx.fillRect(regionStart, Math.min(yTop, yBottom), Math.max(1, regionEnd - regionStart), Math.max(1, Math.abs(yBottom - yTop)));
  }

  profile.buckets.forEach((bucket, index) => {
    if (bucket.total <= 0) return;
    const low = profileMin + index * profile.bucketSpan;
    const high = low + profile.bucketSpan;
    const yTop = getY(high);
    const yBottom = getY(low);
    const y = Math.min(yTop, yBottom);
    const height = Math.max(1, Math.abs(yBottom - yTop) - 1);

    if (volumeMode === 'total') {
      const width = (bucket.total / profile.maxTotal) * regionWidth;
      ctx.fillStyle = totalColor;
      ctx.fillRect(regionEnd - width, y, width, height);
    } else if (volumeMode === 'delta') {
      const delta = bucket.delta;
      const width = (Math.abs(delta) / profile.maxAbsDelta) * (regionWidth * 0.5);
      ctx.fillStyle = delta >= 0 ? deltaPosColor : deltaNegColor;
      ctx.fillRect(delta >= 0 ? centerX : centerX - width, y, width, height);
    } else {
      const totalWidth = (bucket.total / profile.maxTotal) * regionWidth;
      const downWidth = totalWidth * (bucket.down / Math.max(bucket.total, 1e-12));
      const upWidth = Math.max(0, totalWidth - downWidth);
      let cursor = regionEnd - totalWidth;
      ctx.fillStyle = downColor;
      ctx.fillRect(cursor, y, downWidth, height);
      cursor += downWidth;
      ctx.fillStyle = upColor;
      ctx.fillRect(cursor, y, upWidth, height);
    }
  });

  if (config.showPoc !== false) {
    const pocPrice = profileMin + (pocIndex + 0.5) * profile.bucketSpan;
    const pocY = getY(pocPrice);
    ctx.strokeStyle = String(config.pocColor ?? '#ffc107');
    ctx.lineWidth = Math.max(0.5, Number(config.pocWidth ?? 1.2) || 1.2);
    ctx.setLineDash(getVpvrDashPattern(String(config.pocLineStyle ?? 'dashed')));
    ctx.beginPath();
    ctx.moveTo(regionStart, pocY);
    ctx.lineTo(regionEnd, pocY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (config.showVahVal !== false) {
    ctx.strokeStyle = String(config.vahValColor ?? '#8ab4ff');
    ctx.lineWidth = Math.max(0.5, Number(config.vahValWidth ?? 1) || 1);
    ctx.setLineDash(getVpvrDashPattern(String(config.vahValLineStyle ?? 'dashed')));
    ctx.beginPath();
    ctx.moveTo(regionStart, getY(profileMin + (vaHigh + 1) * profile.bucketSpan));
    ctx.lineTo(regionEnd, getY(profileMin + (vaHigh + 1) * profile.bucketSpan));
    ctx.moveTo(regionStart, getY(profileMin + vaLow * profile.bucketSpan));
    ctx.lineTo(regionEnd, getY(profileMin + vaLow * profile.bucketSpan));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (config.valuesVisible === true || config.showInfo !== false) {
    const total = profile.buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    const modeLabel = profile.footprintRatio > 0.01 ? `FP ${Math.round(profile.footprintRatio * 100)}%` : 'OHLCV';
    const label = `${selectedCandles.length} bars · ${formatVolume(total, 0)} · ${modeLabel}`;
    ctx.font = `600 10px ${fontStack}`;
    const width = Math.ceil(ctx.measureText(label).width) + 12;
    const x = Math.max(chartLeft + 4, Math.min(chartRight - width - 4, regionEnd - width));
    const y = Math.max(plotTop + 4, Math.min(plotBottom - 18, getY(profileMin) + 6));
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    ctx.fillRect(x, y, width, 16);
    ctx.fillStyle = String(config.valuesTextColor ?? '#dbe3f4');
    ctx.fillText(label, x + 6, y + 11);
  }

  if (config.showRangeHandles !== false) {
    ctx.strokeStyle = String(config.rangeLineColor ?? '#dbe3f4');
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(selectedLeft, plotTop);
    ctx.lineTo(selectedLeft, plotBottom);
    ctx.moveTo(selectedRight, plotTop);
    ctx.lineTo(selectedRight, plotBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
  void symbolPriceDigits;
  void formatPrice;
}

