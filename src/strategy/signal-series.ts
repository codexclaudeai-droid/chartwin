import { TIMEFRAME_SECONDS, type TimeframeKey } from '../catalog/time.ts';

export type SignalCandleTimeLike = {
  time?: unknown;
};

export function normalizeSignalSeriesLength(signals: readonly unknown[], candleCount: number): number[] {
  const normalizedCount = Math.max(0, Math.floor(Number(candleCount) || 0));
  const normalized = new Array<number>(normalizedCount).fill(0);
  if (!Array.isArray(signals) || normalizedCount === 0) return normalized;

  const limit = Math.min(normalizedCount, signals.length);
  for (let i = 0; i < limit; i += 1) {
    const value = Number(signals[i] ?? 0);
    normalized[i] = Number.isFinite(value) ? (value > 0 ? 1 : value < 0 ? -1 : 0) : 0;
  }
  return normalized;
}

export function isLatestCandleStillOpen(
  candles: readonly SignalCandleTimeLike[],
  timeframe: TimeframeKey | string,
  nowSec = Date.now() / 1000,
): boolean {
  if (!candles.length) return false;
  const lastTime = Number(candles[candles.length - 1]?.time);
  const timeframeSec = TIMEFRAME_SECONDS[String(timeframe) as TimeframeKey] ?? 0;
  return Number.isFinite(lastTime)
    && Number.isFinite(nowSec)
    && timeframeSec > 0
    && nowSec < lastTime + timeframeSec;
}

export function normalizeConfirmedSignalSeriesLength(
  signals: readonly unknown[],
  candles: readonly SignalCandleTimeLike[],
  timeframe: TimeframeKey | string,
  nowSec = Date.now() / 1000,
): number[] {
  const normalized = normalizeSignalSeriesLength(signals, candles.length);
  if (normalized.length && isLatestCandleStillOpen(candles, timeframe, nowSec)) {
    normalized[normalized.length - 1] = 0;
  }
  return normalized;
}
