import { TIMEFRAME_SECONDS } from '../catalog/time.ts';

export const DEFAULT_SIGNAL_REALTIME_LAG_SECONDS = 90;
const SIGNAL_CLOCK_SKEW_SECONDS = 15;

export function isSignalWithinRealtimeWindow(args: {
  signalTimeSec: number;
  timeframe: string;
  nowSec?: number;
  maxLagSeconds?: number;
}): boolean {
  const signalTimeSec = Number(args.signalTimeSec);
  const nowSec = Number(args.nowSec ?? Date.now() / 1000);
  const timeframe = String(args.timeframe || '').trim();
  const timeframeSec = (TIMEFRAME_SECONDS as Record<string, number>)[timeframe];
  const maxLagSeconds = Number(args.maxLagSeconds ?? DEFAULT_SIGNAL_REALTIME_LAG_SECONDS);

  if (!Number.isFinite(signalTimeSec) || !Number.isFinite(nowSec)) return false;
  if (!Number.isFinite(timeframeSec) || timeframeSec <= 0) return false;
  if (!Number.isFinite(maxLagSeconds) || maxLagSeconds < 0) return false;

  const confirmedAtSec = signalTimeSec + timeframeSec;
  const lagSeconds = nowSec - confirmedAtSec;
  return lagSeconds >= -SIGNAL_CLOCK_SKEW_SECONDS && lagSeconds <= maxLagSeconds;
}

export function isSignalRealtimeEmissionWithinWindow(args: {
  emittedAtSec: number;
  nowSec?: number;
  maxLagSeconds?: number;
}): boolean {
  const emittedAtSec = Number(args.emittedAtSec);
  const nowSec = Number(args.nowSec ?? Date.now() / 1000);
  const maxLagSeconds = Number(args.maxLagSeconds ?? DEFAULT_SIGNAL_REALTIME_LAG_SECONDS);

  if (!Number.isFinite(emittedAtSec) || !Number.isFinite(nowSec)) return false;
  if (!Number.isFinite(maxLagSeconds) || maxLagSeconds < 0) return false;

  const lagSeconds = nowSec - emittedAtSec;
  return lagSeconds >= -SIGNAL_CLOCK_SKEW_SECONDS && lagSeconds <= maxLagSeconds;
}
