import type { PatternAnalysisScope } from '../patterns/pattern-detector';
import type { CandleData } from '../types';

export type GapMode = 'raw' | 'smooth';

const GAP_MODE_STORAGE_KEY = 'my-chart-lib.chart-gap-mode.v1';
const PATTERN_SCOPE_STORAGE_KEY = 'my-chart-lib.pattern-analysis-scope.v1';
const PATTERN_ALERT_ENABLED_STORAGE_KEY = 'my-chart-lib.pattern-alert-enabled.v1';
export const GAP_SMOOTH_THRESHOLD_PCT = 0.35;

export function loadGapMode(): GapMode {
  try {
    const raw = localStorage.getItem(GAP_MODE_STORAGE_KEY);
    return raw === 'smooth' ? 'smooth' : 'raw';
  } catch {
    return 'raw';
  }
}

export function loadPatternAnalysisScope(): PatternAnalysisScope {
  try {
    const raw = localStorage.getItem(PATTERN_SCOPE_STORAGE_KEY);
    return raw === 'visible-only' ? 'visible-only' : 'lookback';
  } catch {
    return 'lookback';
  }
}

export function loadPatternAlertEnabled(): boolean {
  try {
    const raw = localStorage.getItem(PATTERN_ALERT_ENABLED_STORAGE_KEY);
    if (raw == null) return false;
    return raw !== '0' && raw.toLowerCase() !== 'false';
  } catch {
    return false;
  }
}

export function applyGapSmoothing(candles: CandleData[], thresholdPct = GAP_SMOOTH_THRESHOLD_PCT): CandleData[] {
  if (candles.length < 2) return candles;
  const threshold = Math.max(0, Number(thresholdPct) || 0);
  const segmentStarts: number[] = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const prevClose = Number(candles[i - 1]?.close);
    const currOpen = Number(candles[i]?.open);
    if (!Number.isFinite(prevClose) || !Number.isFinite(currOpen) || prevClose === 0) continue;
    const gapPct = ((currOpen - prevClose) / prevClose) * 100;
    if (Math.abs(gapPct) >= threshold) {
      segmentStarts.push(i);
    }
  }

  if (segmentStarts.length <= 1) return candles;

  const shifts = new Array<number>(segmentStarts.length).fill(0);
  shifts[segmentStarts.length - 1] = 0; // latest segment stays raw to preserve current market price
  for (let seg = segmentStarts.length - 2; seg >= 0; seg -= 1) {
    const nextStart = segmentStarts[seg + 1];
    const prevEnd = nextStart - 1;
    const shiftNext = shifts[seg + 1];
    const nextOpen = Number(candles[nextStart]?.open);
    const prevClose = Number(candles[prevEnd]?.close);
    if (!Number.isFinite(nextOpen) || !Number.isFinite(prevClose)) {
      shifts[seg] = shiftNext;
      continue;
    }
    // Re-anchor only the older segment to the newer segment, without moving the latest prices.
    shifts[seg] = (nextOpen + shiftNext) - prevClose;
  }

  const out: CandleData[] = candles.map((candle) => ({ ...candle }));
  for (let seg = 0; seg < segmentStarts.length; seg += 1) {
    const start = segmentStarts[seg];
    const end = seg + 1 < segmentStarts.length ? segmentStarts[seg + 1] : candles.length;
    const shift = shifts[seg];
    if (!Number.isFinite(shift) || shift === 0) continue;
    for (let i = start; i < end; i += 1) {
      const src = candles[i];
      out[i] = {
        time: src.time,
        open: src.open + shift,
        high: src.high + shift,
        low: src.low + shift,
        close: src.close + shift,
        volume: src.volume,
      };
    }
  }
  return out;
}
