import { toRgba } from '../color-utils.ts';
import type { SubPanelRenderContext } from './subpanel-render-context.ts';

export interface VolumeCandleLike {
  open: number;
  close: number;
  volume?: number;
}

export function renderVolumeBarsOverlay(params: {
  ctx: CanvasRenderingContext2D;
  enabled: boolean;
  visData: VolumeCandleLike[];
  visRawData: Array<{ volume?: number } | undefined>;
  chartLeft: number;
  chartWidth: number;
  effectiveChartLeft: number;
  top: number;
  height: number;
  totalSp: number;
  candleW: number;
  lo: number;
  hi: number;
  upColor: string;
  downColor: string;
}): void {
  const {
    ctx,
    enabled,
    visData,
    visRawData,
    chartLeft,
    chartWidth,
    effectiveChartLeft,
    top,
    height,
    totalSp,
    candleW,
    lo,
    hi,
    upColor,
    downColor,
  } = params;
  if (!enabled || height <= 0) return;

  const range = Math.max(1, hi - lo);
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, chartWidth, height);
  ctx.clip();
  visData.forEach((candle, index) => {
    const rawVolume = Number(visRawData[index]?.volume ?? candle.volume ?? 0);
    if (rawVolume <= 0) return;
    const barHeight = Math.max(0, (rawVolume - lo) / range) * (height - 20);
    const x = effectiveChartLeft + index * totalSp;
    const isUp = candle.close >= candle.open;
    ctx.fillStyle = isUp ? toRgba(upColor, 0.35) : toRgba(downColor, 0.35);
    ctx.fillRect(
      Math.round(x),
      Math.round(top + height - barHeight - 20),
      Math.max(1, Math.round(candleW)),
      Math.max(1, Math.round(barHeight)),
    );
  });
  ctx.restore();
}

export function renderVolumePanel(params: SubPanelRenderContext & {
  scaleMax: number;
  label: (text: string, top: number) => void;
  formatVolume: (value: number) => string;
}): void {
  const { top, panelHeight, scaleMax, label, formatVolume } = params;
  label('Volume', top);
  const { lo, hi } = params.scaleRange(0, scaleMax);
  params.subGrid([hi * 0.8, hi * 0.5, hi * 0.2].filter(value => value > lo), top, panelHeight, lo, hi, formatVolume);
  params.drawSubAlertLines('volume', top, panelHeight, lo, hi);
}

function lastFinite(series: Array<number | null> | number[]): number {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const value = series[index];
    if (value != null && Number.isFinite(value)) return value;
  }
  return 0;
}

function getPaddedRange(values: number[], fallbackHi = 1): { lo: number; hi: number } {
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : fallbackHi;
  if (lo === hi) hi = lo + 1;
  const pad = Math.max((hi - lo) * 0.18, 1);
  return { lo: lo - pad, hi: hi + pad };
}

export function renderObvPanel(params: SubPanelRenderContext & {
  data: number[];
  signal9: Array<number | null>;
}): void {
  const { top, panelHeight: pH, startIndex, endIndex, data, signal9 } = params;
  const rangeValues = [
    ...data.slice(startIndex, endIndex).filter((value): value is number => value != null),
    ...signal9.slice(startIndex, endIndex).filter((value): value is number => value != null),
  ];
  let { lo, hi } = getPaddedRange(rangeValues);
  ({ lo, hi } = params.scaleRange(lo, hi));
  const obvStyle = params.resolveStyle('obv', '#22ab94');
  const signalStyle = params.resolveStyle('obvSignal9', '#ffc107', 1.5, [4, 2]);
  params.drawPanelLegend('OBV', top, [
    { text: 'OBV', color: obvStyle.color, enabled: params.showLine('obv') },
    { text: 'Signal 9', color: signalStyle.color, enabled: params.showLine('obvSignal9') },
  ]);
  if (params.showLine('obv')) params.subLine(data, obvStyle.color, obvStyle.width, top, pH, lo, hi, obvStyle.dash);
  if (params.showLine('obvSignal9')) params.subLine(signal9, signalStyle.color, signalStyle.width, top, pH, lo, hi, signalStyle.dash);
  if (params.showLine('obvBaseline') && lo <= 0 && hi >= 0) {
    const baseline = params.resolveStyle('obvBaseline', '#999999', 1, [4, 4]);
    params.subHorizontalLine(0, baseline.color, baseline.width, top, pH, lo, hi, baseline.dash);
  }
  params.drawSubAlertLines('obv', top, pH, lo, hi);
  const lastObv = lastFinite(data);
  if (params.showLine('obv')) params.drawSubAxisValue(lastObv, top, pH, lo, hi, obvStyle.color, lastObv.toFixed(2));
}

export function renderCvdPanel(params: SubPanelRenderContext & {
  data: number[];
  signal9: Array<number | null>;
  barMode: boolean;
  upColor: string;
  downColor: string;
}): void {
  const {
    ctx,
    top,
    panelHeight: pH,
    chartLeft,
    subChartWidth,
    effectiveChartLeft,
    totalSp,
    candleW,
    startIndex,
    endIndex,
    visLength,
    data,
    signal9,
    barMode,
    upColor,
    downColor,
  } = params;
  const visibleCvd = data.slice(startIndex, endIndex).filter((value): value is number => value != null);
  const visibleSignal = signal9.slice(startIndex, endIndex).filter((value): value is number => value != null);
  let range = barMode
    ? getPaddedRange(visibleCvd.length ? visibleCvd : [0])
    : getPaddedRange([...visibleCvd, ...visibleSignal, 0]);
  range = params.scaleRange(range.lo, range.hi);
  const { lo, hi } = range;
  const cvdStyle = params.resolveStyle('cvd', '#7b68ee');
  const signalStyle = params.resolveStyle('cvdSignal9', '#ffa726', 1.5, [4, 2]);
  params.drawPanelLegend(barMode ? 'CVD (Candle)' : 'CVD', top, [
    { text: 'CVD', color: cvdStyle.color, enabled: params.showLine('cvd') },
    { text: 'Signal 9', color: signalStyle.color, enabled: params.showLine('cvdSignal9') },
  ]);
  const sy = (value: number) => top + (hi - value) / (hi - lo) * pH;
  if (barMode && params.showLine('cvd')) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartLeft, top, subChartWidth, pH);
    ctx.clip();
    for (let i = 0; i < visLength; i += 1) {
      const idx = startIndex + i;
      const curr = data[idx];
      const prev = data[idx - 1] ?? 0;
      if (curr == null) continue;
      const openY = sy(prev);
      const closeY = sy(curr);
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(Math.abs(openY - closeY), 1);
      const isUp = curr >= prev;
      ctx.fillStyle = isUp ? toRgba(upColor, 0.85) : toRgba(downColor, 0.85);
      ctx.fillRect(Math.round(effectiveChartLeft + i * totalSp), Math.round(bodyTop), Math.max(1, Math.round(candleW)), Math.round(bodyH));
      ctx.strokeStyle = isUp ? upColor : downColor;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(Math.round(effectiveChartLeft + i * totalSp), Math.round(bodyTop), Math.max(1, Math.round(candleW)), Math.round(bodyH));
    }
    ctx.restore();
  } else if (params.showLine('cvd')) {
    params.subLine(data, cvdStyle.color, cvdStyle.width, top, pH, lo, hi, cvdStyle.dash);
  }
  if (params.showLine('cvdSignal9')) params.subLine(signal9, signalStyle.color, signalStyle.width, top, pH, lo, hi, signalStyle.dash);
  if (params.showLine('cvdBaseline') && lo <= 0 && hi >= 0) {
    const baseline = params.resolveStyle('cvdBaseline', '#999999', 1, [4, 4]);
    params.subHorizontalLine(0, baseline.color, baseline.width, top, pH, lo, hi, baseline.dash);
  }
  params.drawSubAlertLines('cvd', top, pH, lo, hi);
  const lastCvd = lastFinite(data);
  const lastColor = barMode ? (lastCvd >= (data[data.length - 2] ?? 0) ? upColor : downColor) : cvdStyle.color;
  params.drawSubAxisValue(lastCvd, top, pH, lo, hi, lastColor, lastCvd.toFixed(2));
}
