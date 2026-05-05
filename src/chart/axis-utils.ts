import {
  TIMEFRAME_SECONDS,
  formatDateWithTimezone,
  type TimeframeKey,
} from '../catalog/time';
import type { DisplayCurrency } from '../types/market';

export function pickAxisStepCandles(rawCandles: number, timeframe: TimeframeKey): number {
  const map: Record<TimeframeKey, number[]> = {
    '1s':  [1, 5, 15, 30, 60, 120, 300, 600, 1800],
    '5s':  [1, 3, 6, 12, 30, 60, 180, 360, 720],
    '10s': [1, 2, 5, 10, 20, 60, 120, 360],
    '15s': [1, 2, 4, 8, 20, 40, 80, 160, 320],
    '30s': [1, 2, 4, 8, 16, 32, 64, 128],
    '45s': [1, 2, 4, 8, 16, 32, 64],
    '1m':  [1, 5, 15, 30, 60, 180, 360, 720, 1440],
    '2m':  [1, 3, 6, 15, 30, 60, 180, 360, 720],
    '3m':  [1, 2, 5, 10, 20, 40, 80, 160, 320],
    '5m':  [1, 3, 6, 12, 24, 48, 96, 192],
    '10m': [1, 2, 5, 10, 20, 40, 80, 160],
    '15m': [1, 2, 4, 8, 16, 32, 64, 128],
    '30m': [1, 2, 4, 8, 16, 32, 64],
    '45m': [1, 2, 4, 8, 16, 32],
    '1h':  [1, 3, 6, 12, 24, 48, 72, 96, 168, 336, 720],
    '2h':  [1, 2, 3, 6, 12, 24, 36, 48, 84, 168, 360],
    '3h':  [1, 2, 4, 8, 16, 24, 48, 84, 168],
    '4h':  [1, 2, 3, 6, 12, 18, 24, 42, 84, 180],
    '1d':  [1, 2, 3, 5, 7, 14, 21, 30, 60, 90, 180, 365],
    '1w':  [1, 2, 3, 4, 8, 12, 26, 52],
    '1M':  [1, 2, 3, 6, 12, 24, 36, 60],
  };
  const steps = map[timeframe];
  for (const step of steps) {
    if (step >= rawCandles) return step;
  }
  return steps[steps.length - 1];
}

export function getBucketStartSec(epochSec: number, timeframe: TimeframeKey): number {
  if (timeframe === '1M') {
    const d = new Date(epochSec * 1000);
    return Math.floor(new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime() / 1000);
  }
  if (timeframe === '1w') {
    const d = new Date(epochSec * 1000);
    const day = d.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday, 0, 0, 0, 0));
    return Math.floor(monday.getTime() / 1000);
  }
  const sec = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(epochSec / sec) * sec;
}

export function shiftBucketSec(bucketStartSec: number, timeframe: TimeframeKey, dir: 1 | -1): number {
  if (timeframe === '1M') {
    const d = new Date(bucketStartSec * 1000);
    return Math.floor(new Date(d.getFullYear(), d.getMonth() + dir, 1, 0, 0, 0, 0).getTime() / 1000);
  }
  const sec = TIMEFRAME_SECONDS[timeframe];
  return bucketStartSec + sec * dir;
}

export function formatAxisTime(epochSec: number, tz: string, timeframe: TimeframeKey, stepCandles: number): string {
  const stepSec = TIMEFRAME_SECONDS[timeframe] * stepCandles;
  const d = new Date(epochSec * 1000);
  const dateFmt = (date: Date) => formatDateWithTimezone(date, tz, { month: '2-digit', day: '2-digit' });
  const timeFmt = (date: Date) => formatDateWithTimezone(date, tz, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (stepSec >= 86400) return dateFmt(d);
  if (stepSec >= 3600 * 6) return `${dateFmt(d)} ${timeFmt(d)}`;
  return timeFmt(d);
}

export function formatCrosshairTimelineLabel(epochSec: number, tz: string): string {
  const d = new Date(epochSec * 1000);
  const weekday = formatDateWithTimezone(d, tz, { weekday: 'short' });
  const dateTime = formatDateWithTimezone(d, tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${weekday} ${dateTime}`;
}

export function formatWithComma(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function chooseNiceAxisStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exp = Math.floor(Math.log10(rawStep));
  const base = 10 ** exp;
  const n = rawStep / base;
  if (n <= 1) return base;
  if (n <= 2) return 2 * base;
  if (n <= 5) return 5 * base;
  return 10 * base;
}

export function getMainAxisStepByRange(rawRange: number, plotHeightPx: number, quoteCurrency: DisplayCurrency): number {
  const minLabelGapPx = 26;
  const targetTicks = Math.max(2, Math.floor(plotHeightPx / minLabelGapPx));
  const rawStep = Math.max(rawRange / targetTicks, 1e-12);
  let step = chooseNiceAxisStep(rawStep);
  if ((quoteCurrency === 'KRW' || quoteCurrency === 'JPY') && step < 1) step = 1;
  return step;
}

export function getDynamicMainPricePaddingRatio(minPrice: number, maxPrice: number): number {
  const range = Math.max(0, maxPrice - minPrice);
  const mid = Math.max(Math.abs((maxPrice + minPrice) * 0.5), 1e-12);
  const rangeRatio = range / mid;
  if (rangeRatio <= 0.002) return 0.025;
  if (rangeRatio <= 0.005) return 0.035;
  if (rangeRatio <= 0.01) return 0.045;
  if (rangeRatio <= 0.02) return 0.055;
  if (rangeRatio <= 0.05) return 0.065;
  return 0.08;
}
