import { TIMEFRAME_SECONDS, type TimeframeKey } from '../catalog/time';
import type { CandleData } from '../types';

export type PatternAlertLevel = 'watch' | 'warn' | 'confirmed';
export type ChartPatternType =
  | 'double-bottom'
  | 'double-top'
  | 'head-and-shoulders'
  | 'inverse-head-and-shoulders'
  | 'bullish-engulfing'
  | 'bearish-engulfing'
  | 'bearish-harami'
  | 'bullish-harami'
  | 'harami'
  | 'dark-cloud-cover'
  | 'piercing-line'
  | 'three-white-soldiers'
  | 'three-black-crows'
  | 'morning-star'
  | 'evening-star'
  | 'morning-doji-star'
  | 'evening-doji-star'
  | 'shooting-star'
  | 'inverted-hammer';
export type PatternAnalysisScope = 'lookback' | 'visible-only';

export interface PatternSignal {
  key: string;
  type: ChartPatternType;
  level: PatternAlertLevel;
  confidence: number;
  message: string;
  checklist: string[];
  barIndex: number;
}

export interface PatternDetectionPreset {
  minBars: number;
  lookbackBars: number;
  pivotSpan: number;
  cooldownBars: number;
  nearPivotBars: number;
  doubleMinGap: number;
  doubleMaxGap: number;
  doubleTolerance: number;
  hsMinGap: number;
  hsShoulderTolerance: number;
  hsHeadHeightRatio: number;
}

export interface PatternDetectionContext {
  data: CandleData[];
  timeframe: TimeframeKey;
  scope: PatternAnalysisScope;
  visibleStartIndex: number;
  endIndex: number;
}

export interface PatternDetectionResult {
  preset: PatternDetectionPreset;
  start: number;
  lastBar: number;
  candidates: PatternSignal[];
}

type CandleShape = {
  open: number;
  high: number;
  low: number;
  close: number;
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bullish: boolean;
  bearish: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getCandleShape(candle: CandleData | undefined): CandleShape | null {
  if (!candle) return null;
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  if (![open, high, low, close].every(Number.isFinite)) return null;
  if (high < low) return null;
  const body = Math.abs(close - open);
  const range = Math.max(1e-9, high - low);
  const upperWick = Math.max(0, high - Math.max(open, close));
  const lowerWick = Math.max(0, Math.min(open, close) - low);
  const bullish = close > open;
  const bearish = close < open;
  return { open, high, low, close, body, range, upperWick, lowerWick, bullish, bearish };
}

function getAverageBody(data: CandleData[], start: number, end: number): number {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, start); i <= Math.min(data.length - 1, end); i += 1) {
    const c = getCandleShape(data[i]);
    if (!c) continue;
    sum += c.body;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function getAverageRange(data: CandleData[], start: number, end: number): number {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, start); i <= Math.min(data.length - 1, end); i += 1) {
    const c = getCandleShape(data[i]);
    if (!c) continue;
    sum += c.range;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function getTrendInfo(data: CandleData[], lastBar: number, lookback = 8): { up: boolean; down: boolean; change: number } {
  const from = Math.max(0, lastBar - lookback);
  const a = Number(data[from]?.close);
  const b = Number(data[lastBar]?.close);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return { up: false, down: false, change: 0 };
  const change = (b - a) / a;
  return {
    up: change >= 0.008,
    down: change <= -0.008,
    change,
  };
}

function findPivotLowIndices(data: CandleData[], start: number, end: number, leftRight = 2): number[] {
  const points: number[] = [];
  if (end - start <= leftRight * 2) return points;
  const lo = Math.max(0, start);
  const hi = Math.min(data.length - 1, end);
  for (let i = lo + leftRight; i <= hi - leftRight; i += 1) {
    const curr = data[i]?.low;
    if (!Number.isFinite(curr)) continue;
    let isPivot = true;
    for (let j = i - leftRight; j <= i + leftRight; j += 1) {
      if (j === i) continue;
      const other = data[j]?.low;
      if (!Number.isFinite(other)) continue;
      if ((other as number) <= (curr as number)) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) points.push(i);
  }
  return points;
}

function findPivotHighIndices(data: CandleData[], start: number, end: number, leftRight = 2): number[] {
  const points: number[] = [];
  if (end - start <= leftRight * 2) return points;
  const lo = Math.max(0, start);
  const hi = Math.min(data.length - 1, end);
  for (let i = lo + leftRight; i <= hi - leftRight; i += 1) {
    const curr = data[i]?.high;
    if (!Number.isFinite(curr)) continue;
    let isPivot = true;
    for (let j = i - leftRight; j <= i + leftRight; j += 1) {
      if (j === i) continue;
      const other = data[j]?.high;
      if (!Number.isFinite(other)) continue;
      if ((other as number) >= (curr as number)) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) points.push(i);
  }
  return points;
}

function getRangeHigh(data: CandleData[], start: number, end: number): number | null {
  let max = Number.NEGATIVE_INFINITY;
  for (let i = Math.max(0, start); i <= Math.min(data.length - 1, end); i += 1) {
    const value = data[i]?.high;
    if (Number.isFinite(value) && (value as number) > max) max = value as number;
  }
  return Number.isFinite(max) ? max : null;
}

function getRangeLow(data: CandleData[], start: number, end: number): number | null {
  let min = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, start); i <= Math.min(data.length - 1, end); i += 1) {
    const value = data[i]?.low;
    if (Number.isFinite(value) && (value as number) < min) min = value as number;
  }
  return Number.isFinite(min) ? min : null;
}

function detectDoubleBottom(data: CandleData[], lastBar: number, pivotLows: number[], preset: PatternDetectionPreset): PatternSignal | null {
  if (pivotLows.length < 2) return null;
  const b2 = pivotLows[pivotLows.length - 1];
  const b1 = pivotLows[pivotLows.length - 2];
  if (b2 - b1 < preset.doubleMinGap || b2 - b1 > preset.doubleMaxGap) return null;
  if (lastBar - b2 > preset.lookbackBars) return null;
  const low1 = data[b1]?.low;
  const low2 = data[b2]?.low;
  if (!Number.isFinite(low1) || !Number.isFinite(low2) || (low1 as number) <= 0 || (low2 as number) <= 0) return null;
  const diffRatio = Math.abs((low1 as number) - (low2 as number)) / Math.max(low1 as number, low2 as number);
  if (diffRatio > preset.doubleTolerance) return null;
  const neckline = getRangeHigh(data, b1 + 1, b2 - 1);
  const close = data[lastBar]?.close;
  if (!Number.isFinite(neckline) || !Number.isFinite(close)) return null;
  const breakout = (close as number) > (neckline as number);
  if (!breakout && lastBar - b2 > preset.nearPivotBars) return null;
  const confidence = clamp(0.72 + (breakout ? 0.14 : 0) - diffRatio * 8, 0.45, 0.94);
  return {
    key: `double-bottom-${b1}-${b2}`,
    type: 'double-bottom',
    level: breakout ? 'confirmed' : 'watch',
    confidence,
    message: breakout ? '쌍바닥 neckline 상향 돌파가 확인되었습니다.' : '쌍바닥 2차 저점 형성 후 돌파 대기 구간입니다.',
    checklist: [
      `저점 간 오차 ${(diffRatio * 100).toFixed(2)}%`,
      breakout ? 'neckline 돌파 확인' : 'neckline 돌파 대기',
      `저점 간격 ${b2 - b1}봉`,
    ],
    barIndex: lastBar,
  };
}

function detectDoubleTop(data: CandleData[], lastBar: number, pivotHighs: number[], preset: PatternDetectionPreset): PatternSignal | null {
  if (pivotHighs.length < 2) return null;
  const t2 = pivotHighs[pivotHighs.length - 1];
  const t1 = pivotHighs[pivotHighs.length - 2];
  if (t2 - t1 < preset.doubleMinGap || t2 - t1 > preset.doubleMaxGap) return null;
  if (lastBar - t2 > preset.lookbackBars) return null;
  const high1 = data[t1]?.high;
  const high2 = data[t2]?.high;
  if (!Number.isFinite(high1) || !Number.isFinite(high2) || (high1 as number) <= 0 || (high2 as number) <= 0) return null;
  const diffRatio = Math.abs((high1 as number) - (high2 as number)) / Math.max(high1 as number, high2 as number);
  if (diffRatio > preset.doubleTolerance) return null;
  const neckline = getRangeLow(data, t1 + 1, t2 - 1);
  const close = data[lastBar]?.close;
  if (!Number.isFinite(neckline) || !Number.isFinite(close)) return null;
  const breakdown = (close as number) < (neckline as number);
  if (!breakdown && lastBar - t2 > preset.nearPivotBars) return null;
  const confidence = clamp(0.72 + (breakdown ? 0.14 : 0) - diffRatio * 8, 0.45, 0.94);
  return {
    key: `double-top-${t1}-${t2}`,
    type: 'double-top',
    level: breakdown ? 'confirmed' : 'warn',
    confidence,
    message: breakdown ? '쌍봉 neckline 하향 이탈이 확인되었습니다.' : '쌍봉 2차 고점 형성 후 하향 이탈 대기 구간입니다.',
    checklist: [
      `고점 간 오차 ${(diffRatio * 100).toFixed(2)}%`,
      breakdown ? 'neckline 이탈 확인' : 'neckline 이탈 대기',
      `고점 간격 ${t2 - t1}봉`,
    ],
    barIndex: lastBar,
  };
}

function detectHeadAndShoulders(data: CandleData[], lastBar: number, pivotHighs: number[], preset: PatternDetectionPreset): PatternSignal | null {
  if (pivotHighs.length < 3) return null;
  const right = pivotHighs[pivotHighs.length - 1];
  const head = pivotHighs[pivotHighs.length - 2];
  const left = pivotHighs[pivotHighs.length - 3];
  if (head - left < preset.hsMinGap || right - head < preset.hsMinGap) return null;
  const lh = data[left]?.high;
  const hh = data[head]?.high;
  const rh = data[right]?.high;
  if (!Number.isFinite(lh) || !Number.isFinite(hh) || !Number.isFinite(rh)) return null;
  if ((hh as number) <= (lh as number) * (1 + preset.hsHeadHeightRatio) || (hh as number) <= (rh as number) * (1 + preset.hsHeadHeightRatio)) return null;
  const shoulderDiff = Math.abs((lh as number) - (rh as number)) / Math.max(lh as number, rh as number);
  if (shoulderDiff > preset.hsShoulderTolerance) return null;
  const leftValley = getRangeLow(data, left + 1, head - 1);
  const rightValley = getRangeLow(data, head + 1, right - 1);
  const close = data[lastBar]?.close;
  if (!Number.isFinite(leftValley) || !Number.isFinite(rightValley) || !Number.isFinite(close)) return null;
  const neckline = ((leftValley as number) + (rightValley as number)) / 2;
  const breakdown = (close as number) < neckline;
  if (!breakdown && lastBar - right > preset.nearPivotBars) return null;
  const confidence = clamp(0.74 + (breakdown ? 0.15 : 0) - shoulderDiff * 3.5, 0.5, 0.95);
  return {
    key: `hs-${left}-${head}-${right}`,
    type: 'head-and-shoulders',
    level: breakdown ? 'confirmed' : 'warn',
    confidence,
    message: breakdown ? '헤드앤숄더 neckline 하향 이탈이 확인되었습니다.' : '헤드앤숄더 우측 숄더 구간입니다.',
    checklist: [
      `좌우 어깨 오차 ${(shoulderDiff * 100).toFixed(2)}%`,
      breakdown ? 'neckline 이탈 확인' : 'neckline 이탈 대기',
      `머리 고점 ${(hh as number).toFixed(2)}`,
    ],
    barIndex: lastBar,
  };
}

function detectInverseHeadAndShoulders(data: CandleData[], lastBar: number, pivotLows: number[], preset: PatternDetectionPreset): PatternSignal | null {
  if (pivotLows.length < 3) return null;
  const right = pivotLows[pivotLows.length - 1];
  const head = pivotLows[pivotLows.length - 2];
  const left = pivotLows[pivotLows.length - 3];
  if (head - left < preset.hsMinGap || right - head < preset.hsMinGap) return null;
  const ll = data[left]?.low;
  const hl = data[head]?.low;
  const rl = data[right]?.low;
  if (!Number.isFinite(ll) || !Number.isFinite(hl) || !Number.isFinite(rl)) return null;
  if ((hl as number) >= (ll as number) * (1 - preset.hsHeadHeightRatio) || (hl as number) >= (rl as number) * (1 - preset.hsHeadHeightRatio)) return null;
  const shoulderDiff = Math.abs((ll as number) - (rl as number)) / Math.max(ll as number, rl as number);
  if (shoulderDiff > preset.hsShoulderTolerance) return null;
  const leftPeak = getRangeHigh(data, left + 1, head - 1);
  const rightPeak = getRangeHigh(data, head + 1, right - 1);
  const close = data[lastBar]?.close;
  if (!Number.isFinite(leftPeak) || !Number.isFinite(rightPeak) || !Number.isFinite(close)) return null;
  const neckline = ((leftPeak as number) + (rightPeak as number)) / 2;
  const breakout = (close as number) > neckline;
  if (!breakout && lastBar - right > preset.nearPivotBars) return null;
  const confidence = clamp(0.74 + (breakout ? 0.15 : 0) - shoulderDiff * 3.5, 0.5, 0.95);
  return {
    key: `ihs-${left}-${head}-${right}`,
    type: 'inverse-head-and-shoulders',
    level: breakout ? 'confirmed' : 'watch',
    confidence,
    message: breakout ? '역헤드앤숄더 neckline 상향 돌파가 확인되었습니다.' : '역헤드앤숄더 우측 숄더 구간입니다.',
    checklist: [
      `좌우 어깨 오차 ${(shoulderDiff * 100).toFixed(2)}%`,
      breakout ? 'neckline 돌파 확인' : 'neckline 돌파 대기',
      `머리 저점 ${(hl as number).toFixed(2)}`,
    ],
    barIndex: lastBar,
  };
}

function detectBullishBearishEngulfing(data: CandleData[], lastBar: number, avgBody: number, avgRange: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar < 1) return out;
  const p = getCandleShape(data[lastBar - 1]);
  const c = getCandleShape(data[lastBar]);
  if (!p || !c) return out;
  const trend = getTrendInfo(data, lastBar - 1, 10);
  const tol = Math.max(avgRange * 0.06, 1e-9);
  const prevLongEnough = p.body >= avgBody * 0.7;

  const bullishEngulfing =
    prevLongEnough
    && p.bearish
    && c.bullish
    && c.open <= p.close + tol
    && c.close >= p.open - tol
    && c.body >= p.body * 0.95
    && trend.down;
  if (bullishEngulfing) {
    const engulfRatio = clamp(c.body / Math.max(1e-9, p.body), 0, 2.4);
    out.push({
      key: `bullish-engulfing-${lastBar - 1}-${lastBar}`,
      type: 'bullish-engulfing',
      level: c.close > p.open ? 'confirmed' : 'watch',
      confidence: clamp(0.62 + (engulfRatio - 1) * 0.22 + (trend.down ? 0.08 : 0), 0.45, 0.95),
      message: '상승장악형이 형성되었습니다.',
      checklist: [
        '직전 음봉 몸통을 현재 양봉 몸통이 장악',
        `장악 강도 ${(engulfRatio * 100).toFixed(0)}%`,
        trend.down ? '직전 하락 추세 확인' : '추세 중립',
      ],
      barIndex: lastBar,
    });
  }

  const bearishEngulfing =
    prevLongEnough
    && p.bullish
    && c.bearish
    && c.open >= p.close - tol
    && c.close <= p.open + tol
    && c.body >= p.body * 0.95
    && trend.up;
  if (bearishEngulfing) {
    const engulfRatio = clamp(c.body / Math.max(1e-9, p.body), 0, 2.4);
    out.push({
      key: `bearish-engulfing-${lastBar - 1}-${lastBar}`,
      type: 'bearish-engulfing',
      level: c.close < p.open ? 'confirmed' : 'warn',
      confidence: clamp(0.62 + (engulfRatio - 1) * 0.22 + (trend.up ? 0.08 : 0), 0.45, 0.95),
      message: '하락장악형이 형성되었습니다.',
      checklist: [
        '직전 양봉 몸통을 현재 음봉 몸통이 장악',
        `장악 강도 ${(engulfRatio * 100).toFixed(0)}%`,
        trend.up ? '직전 상승 추세 확인' : '추세 중립',
      ],
      barIndex: lastBar,
    });
  }
  return out;
}

function detectHaramiSet(data: CandleData[], lastBar: number, avgBody: number, avgRange: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar < 1) return out;
  const p = getCandleShape(data[lastBar - 1]);
  const c = getCandleShape(data[lastBar]);
  if (!p || !c) return out;
  const bodyTopPrev = Math.max(p.open, p.close);
  const bodyBotPrev = Math.min(p.open, p.close);
  const bodyTopCur = Math.max(c.open, c.close);
  const bodyBotCur = Math.min(c.open, c.close);
  const insideBody = bodyTopCur <= bodyTopPrev + avgRange * 0.04 && bodyBotCur >= bodyBotPrev - avgRange * 0.04;
  if (!insideBody) return out;
  const prevLong = p.body >= avgBody * 1.05;
  const curSmall = c.body <= avgBody * 0.62;
  if (!prevLong || !curSmall) return out;
  const doji = c.body <= Math.max(avgBody * 0.18, c.range * 0.12);
  const trend = getTrendInfo(data, lastBar - 1, 10);

  if (p.bearish && c.bullish && trend.down) {
    out.push({
      key: `bullish-harami-${lastBar - 1}-${lastBar}`,
      type: 'bullish-harami',
      level: doji ? 'confirmed' : 'watch',
      confidence: clamp(0.58 + (doji ? 0.14 : 0) + (trend.down ? 0.08 : 0), 0.42, 0.92),
      message: '상승 잉태형(불리시 하라미)이 형성되었습니다.',
      checklist: [
        '긴 음봉 다음 작은 양봉 몸통 내포',
        doji ? '중앙 캔들 도지 성격' : '중앙 캔들 소형',
        '하락 추세 말단 반전 시그널',
      ],
      barIndex: lastBar,
    });
  } else if (p.bullish && c.bearish && trend.up) {
    out.push({
      key: `bearish-harami-${lastBar - 1}-${lastBar}`,
      type: 'bearish-harami',
      level: doji ? 'confirmed' : 'warn',
      confidence: clamp(0.58 + (doji ? 0.14 : 0) + (trend.up ? 0.08 : 0), 0.42, 0.92),
      message: '하락 잉태형(베어리시 하라미)이 형성되었습니다.',
      checklist: [
        '긴 양봉 다음 작은 음봉 몸통 내포',
        doji ? '중앙 캔들 도지 성격' : '중앙 캔들 소형',
        '상승 추세 말단 반전 시그널',
      ],
      barIndex: lastBar,
    });
  } else {
    out.push({
      key: `harami-${lastBar - 1}-${lastBar}`,
      type: 'harami',
      level: doji ? 'warn' : 'watch',
      confidence: clamp(0.5 + (doji ? 0.14 : 0), 0.36, 0.86),
      message: '하라미 패턴이 형성되었습니다.',
      checklist: [
        '이전 긴 몸통 내부에 현재 소형 몸통 위치',
        doji ? '도지 하라미 성격' : '일반 하라미',
      ],
      barIndex: lastBar,
    });
  }
  return out;
}

function detectDarkCloudAndPiercing(data: CandleData[], lastBar: number, avgBody: number, avgRange: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar < 1) return out;
  const p = getCandleShape(data[lastBar - 1]);
  const c = getCandleShape(data[lastBar]);
  if (!p || !c) return out;
  const trend = getTrendInfo(data, lastBar - 1, 10);
  const midpoint = (p.open + p.close) / 2;
  const tol = avgRange * 0.04;
  const prevLong = p.body >= avgBody * 1.0;
  const currLong = c.body >= avgBody * 0.9;

  const darkCloud =
    prevLong
    && currLong
    && p.bullish
    && c.bearish
    && c.open >= p.close - tol
    && c.close <= midpoint
    && c.close > p.open
    && trend.up;
  if (darkCloud) {
    out.push({
      key: `dark-cloud-cover-${lastBar - 1}-${lastBar}`,
      type: 'dark-cloud-cover',
      level: c.close < midpoint ? 'confirmed' : 'warn',
      confidence: clamp(0.62 + (trend.up ? 0.08 : 0), 0.45, 0.9),
      message: '흑운형 패턴이 형성되었습니다.',
      checklist: [
        '강한 양봉 이후 음봉 전환',
        '음봉 종가가 이전 양봉 몸통의 절반 아래',
      ],
      barIndex: lastBar,
    });
  }

  const piercing =
    prevLong
    && currLong
    && p.bearish
    && c.bullish
    && c.open <= p.close + tol
    && c.close >= midpoint
    && c.close < p.open
    && trend.down;
  if (piercing) {
    out.push({
      key: `piercing-line-${lastBar - 1}-${lastBar}`,
      type: 'piercing-line',
      level: c.close > midpoint ? 'confirmed' : 'watch',
      confidence: clamp(0.62 + (trend.down ? 0.08 : 0), 0.45, 0.9),
      message: '관통형 패턴이 형성되었습니다.',
      checklist: [
        '강한 음봉 이후 양봉 반전',
        '양봉 종가가 이전 음봉 몸통 절반 이상 복구',
      ],
      barIndex: lastBar,
    });
  }

  return out;
}

function detectThreeSoldiersAndCrows(data: CandleData[], lastBar: number, avgBody: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar < 2) return out;
  const a = getCandleShape(data[lastBar - 2]);
  const b = getCandleShape(data[lastBar - 1]);
  const c = getCandleShape(data[lastBar]);
  if (!a || !b || !c) return out;
  const trend = getTrendInfo(data, lastBar - 2, 12);
  const longEnough = [a, b, c].every((x) => x.body >= avgBody * 0.75);

  const soldiers =
    longEnough
    && a.bullish && b.bullish && c.bullish
    && b.close > a.close && c.close > b.close
    && b.open > Math.min(a.open, a.close) && b.open < Math.max(a.open, a.close)
    && c.open > Math.min(b.open, b.close) && c.open < Math.max(b.open, b.close)
    && trend.down;
  if (soldiers) {
    out.push({
      key: `three-white-soldiers-${lastBar - 2}-${lastBar}`,
      type: 'three-white-soldiers',
      level: 'confirmed',
      confidence: clamp(0.68 + (trend.down ? 0.1 : 0), 0.52, 0.95),
      message: '적삼병 패턴이 형성되었습니다.',
      checklist: [
        '연속 3개 양봉, 고점/종가 순차 상승',
        '각 캔들 시가가 직전 몸통 내부에서 시작',
      ],
      barIndex: lastBar,
    });
  }

  const crows =
    longEnough
    && a.bearish && b.bearish && c.bearish
    && b.close < a.close && c.close < b.close
    && b.open > Math.min(a.open, a.close) && b.open < Math.max(a.open, a.close)
    && c.open > Math.min(b.open, b.close) && c.open < Math.max(b.open, b.close)
    && trend.up;
  if (crows) {
    out.push({
      key: `three-black-crows-${lastBar - 2}-${lastBar}`,
      type: 'three-black-crows',
      level: 'confirmed',
      confidence: clamp(0.68 + (trend.up ? 0.1 : 0), 0.52, 0.95),
      message: '흑삼병 패턴이 형성되었습니다.',
      checklist: [
        '연속 3개 음봉, 저점/종가 순차 하락',
        '각 캔들 시가가 직전 몸통 내부에서 시작',
      ],
      barIndex: lastBar,
    });
  }
  return out;
}

function detectMorningEveningFamily(data: CandleData[], lastBar: number, avgBody: number, avgRange: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar < 2) return out;
  const a = getCandleShape(data[lastBar - 2]);
  const b = getCandleShape(data[lastBar - 1]);
  const c = getCandleShape(data[lastBar]);
  if (!a || !b || !c) return out;
  const trendBefore = getTrendInfo(data, lastBar - 2, 10);
  const firstLong = a.body >= avgBody * 1.0;
  const midSmall = b.body <= avgBody * 0.55;
  const midDoji = b.body <= Math.max(avgBody * 0.2, b.range * 0.12);
  const firstMid = (a.open + a.close) / 2;
  const tol = avgRange * 0.04;

  const morningStar =
    firstLong
    && midSmall
    && a.bearish
    && c.bullish
    && c.close >= firstMid + tol
    && trendBefore.down;
  if (morningStar) {
    out.push({
      key: `morning-star-${lastBar - 2}-${lastBar}`,
      type: 'morning-star',
      level: c.close > a.open - tol ? 'confirmed' : 'watch',
      confidence: clamp(0.64 + (midDoji ? 0.08 : 0) + (trendBefore.down ? 0.08 : 0), 0.45, 0.94),
      message: '샛별형(모닝스타) 패턴이 형성되었습니다.',
      checklist: [
        '긴 음봉 - 소형 중심봉 - 강한 양봉 구조',
        '3번째 양봉이 1번째 몸통 중간 이상 회복',
      ],
      barIndex: lastBar,
    });
    if (midDoji) {
      out.push({
        key: `morning-doji-star-${lastBar - 2}-${lastBar}`,
        type: 'morning-doji-star',
        level: 'confirmed',
        confidence: clamp(0.72 + (trendBefore.down ? 0.08 : 0), 0.52, 0.96),
        message: '새벽십자별형(모닝 도지 스타) 패턴이 형성되었습니다.',
        checklist: [
          '중앙 캔들이 도지에 가까움',
          '반전 강도 강화',
        ],
        barIndex: lastBar,
      });
    }
  }

  const eveningStar =
    firstLong
    && midSmall
    && a.bullish
    && c.bearish
    && c.close <= firstMid - tol
    && trendBefore.up;
  if (eveningStar) {
    out.push({
      key: `evening-star-${lastBar - 2}-${lastBar}`,
      type: 'evening-star',
      level: c.close < a.open + tol ? 'confirmed' : 'warn',
      confidence: clamp(0.64 + (midDoji ? 0.08 : 0) + (trendBefore.up ? 0.08 : 0), 0.45, 0.94),
      message: '저녁별형(이브닝스타) 패턴이 형성되었습니다.',
      checklist: [
        '긴 양봉 - 소형 중심봉 - 강한 음봉 구조',
        '3번째 음봉이 1번째 몸통 중간 이하로 하락',
      ],
      barIndex: lastBar,
    });
    if (midDoji) {
      out.push({
        key: `evening-doji-star-${lastBar - 2}-${lastBar}`,
        type: 'evening-doji-star',
        level: 'confirmed',
        confidence: clamp(0.72 + (trendBefore.up ? 0.08 : 0), 0.52, 0.96),
        message: '저녁십자별형(이브닝 도지 스타) 패턴이 형성되었습니다.',
        checklist: [
          '중앙 캔들이 도지에 가까움',
          '반전 강도 강화',
        ],
        barIndex: lastBar,
      });
    }
  }
  return out;
}

function detectShootingAndInvertedHammer(data: CandleData[], lastBar: number, avgBody: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  const c = getCandleShape(data[lastBar]);
  if (!c) return out;
  const upperLong = c.upperWick >= Math.max(c.body * 2.2, avgBody * 0.8);
  const lowerTiny = c.lowerWick <= c.body * 0.45;
  const smallBody = c.body <= avgBody * 0.85;
  if (!upperLong || !lowerTiny || !smallBody) return out;
  const trend = getTrendInfo(data, lastBar, 10);

  if (trend.up) {
    out.push({
      key: `shooting-star-${lastBar}`,
      type: 'shooting-star',
      level: c.bearish ? 'confirmed' : 'warn',
      confidence: clamp(0.6 + (c.bearish ? 0.12 : 0) + (trend.up ? 0.08 : 0), 0.44, 0.92),
      message: '유성형 패턴이 형성되었습니다.',
      checklist: [
        '짧은 몸통 + 긴 윗꼬리',
        '상승 추세 끝단에서 매도 압력 증가',
      ],
      barIndex: lastBar,
    });
  } else if (trend.down) {
    out.push({
      key: `inverted-hammer-${lastBar}`,
      type: 'inverted-hammer',
      level: c.bullish ? 'confirmed' : 'watch',
      confidence: clamp(0.6 + (c.bullish ? 0.12 : 0) + (trend.down ? 0.08 : 0), 0.44, 0.92),
      message: '역망치형 패턴이 형성되었습니다.',
      checklist: [
        '짧은 몸통 + 긴 윗꼬리',
        '하락 추세 끝단에서 반등 시도',
      ],
      barIndex: lastBar,
    });
  }
  return out;
}

function detectCandlestickPatterns(ctx: PatternDetectionContext, start: number, lastBar: number): PatternSignal[] {
  const out: PatternSignal[] = [];
  if (lastBar - start < 3) return out;
  const avgBody = Math.max(1e-9, getAverageBody(ctx.data, Math.max(start, lastBar - 20), lastBar - 1));
  const avgRange = Math.max(1e-9, getAverageRange(ctx.data, Math.max(start, lastBar - 20), lastBar - 1));
  out.push(...detectBullishBearishEngulfing(ctx.data, lastBar, avgBody, avgRange));
  out.push(...detectHaramiSet(ctx.data, lastBar, avgBody, avgRange));
  out.push(...detectDarkCloudAndPiercing(ctx.data, lastBar, avgBody, avgRange));
  out.push(...detectThreeSoldiersAndCrows(ctx.data, lastBar, avgBody));
  out.push(...detectMorningEveningFamily(ctx.data, lastBar, avgBody, avgRange));
  out.push(...detectShootingAndInvertedHammer(ctx.data, lastBar, avgBody));
  return out;
}

export function getPatternDetectionPreset(timeframe: TimeframeKey): PatternDetectionPreset {
  const second = TIMEFRAME_SECONDS[timeframe];
  if (second <= 60) {
    return {
      minBars: 70,
      lookbackBars: 320,
      pivotSpan: 3,
      cooldownBars: 40,
      nearPivotBars: 6,
      doubleMinGap: 10,
      doubleMaxGap: 120,
      doubleTolerance: 0.022,
      hsMinGap: 6,
      hsShoulderTolerance: 0.04,
      hsHeadHeightRatio: 0.01,
    };
  }
  if (second <= 900) {
    return {
      minBars: 60,
      lookbackBars: 300,
      pivotSpan: 2,
      cooldownBars: 30,
      nearPivotBars: 5,
      doubleMinGap: 8,
      doubleMaxGap: 100,
      doubleTolerance: 0.02,
      hsMinGap: 5,
      hsShoulderTolerance: 0.035,
      hsHeadHeightRatio: 0.011,
    };
  }
  if (second <= 14_400) {
    return {
      minBars: 50,
      lookbackBars: 260,
      pivotSpan: 2,
      cooldownBars: 24,
      nearPivotBars: 4,
      doubleMinGap: 6,
      doubleMaxGap: 90,
      doubleTolerance: 0.018,
      hsMinGap: 4,
      hsShoulderTolerance: 0.03,
      hsHeadHeightRatio: 0.012,
    };
  }
  return {
    minBars: 44,
    lookbackBars: 220,
    pivotSpan: 2,
    cooldownBars: 18,
    nearPivotBars: 3,
    doubleMinGap: 5,
    doubleMaxGap: 72,
    doubleTolerance: 0.016,
    hsMinGap: 4,
    hsShoulderTolerance: 0.028,
    hsHeadHeightRatio: 0.013,
  };
}

export function detectPatternCandidates(ctx: PatternDetectionContext): PatternDetectionResult | null {
  const preset = getPatternDetectionPreset(ctx.timeframe);
  if (ctx.endIndex <= 0 || ctx.data.length < preset.minBars) return null;
  const lastBar = ctx.endIndex - 1;
  if (lastBar <= 0) return null;
  const start = ctx.scope === 'visible-only'
    ? Math.max(0, ctx.visibleStartIndex)
    : Math.max(0, lastBar - preset.lookbackBars);
  if (lastBar - start + 1 < preset.minBars) return null;

  const lows = findPivotLowIndices(ctx.data, start, lastBar, preset.pivotSpan);
  const highs = findPivotHighIndices(ctx.data, start, lastBar, preset.pivotSpan);
  const candidates: PatternSignal[] = [];
  const addSignal = (signal: PatternSignal | null) => {
    if (signal) candidates.push(signal);
  };

  addSignal(detectDoubleBottom(ctx.data, lastBar, lows, preset));
  addSignal(detectInverseHeadAndShoulders(ctx.data, lastBar, lows, preset));
  addSignal(detectDoubleTop(ctx.data, lastBar, highs, preset));
  addSignal(detectHeadAndShoulders(ctx.data, lastBar, highs, preset));
  candidates.push(...detectCandlestickPatterns(ctx, start, lastBar));

  return { preset, start, lastBar, candidates };
}

export function pickTopPatternSignal(candidates: PatternSignal[]): PatternSignal | null {
  if (!candidates.length) return null;
  const rank: Record<PatternAlertLevel, number> = { watch: 1, warn: 2, confirmed: 3 };
  const sorted = [...candidates].sort((a, b) => {
    const levelGap = rank[b.level] - rank[a.level];
    if (levelGap !== 0) return levelGap;
    return b.confidence - a.confidence;
  });
  return sorted[0] ?? null;
}
