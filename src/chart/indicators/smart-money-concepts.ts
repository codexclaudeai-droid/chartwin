export type SmartMoneyConceptsBias = 'bullish' | 'bearish';
export type SmartMoneyConceptsStructureKind = 'BOS' | 'CHoCH';
export type SmartMoneyConceptsStructureScope = 'internal' | 'swing';
export type SmartMoneyConceptsPivotMode = 'lux' | 'strict';
export type SmartMoneyConceptsMode = 'Historical' | 'Present';
export type SmartMoneyConceptsStyle = 'Colored' | 'Monochrome';
export type SmartMoneyConceptsDisplayFilter = 'All' | 'BOS' | 'CHoCH';
export type SmartMoneyConceptsLabelSize = 'tiny' | 'small' | 'normal';
export type SmartMoneyConceptsOrderBlockFilter = 'Atr' | 'Cumulative Mean Range';
export type SmartMoneyConceptsOrderBlockMitigation = 'Close' | 'High/Low';

export interface SmartMoneyConceptsCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  time?: number;
}

export interface SmartMoneyConceptsOptions {
  swingLength?: number;
  swingsLength?: number;
  internalLength?: number;
  equalLength?: number;
  equalThreshold?: number;
  includeInternal?: boolean;
  includeOrderBlocks?: boolean;
  includeFairValueGaps?: boolean;
  pivotMode?: SmartMoneyConceptsPivotMode;
  maxOrderBlocks?: number;
  internalOrderBlocksSize?: number;
  swingOrderBlocksSize?: number;
}

export interface SmartMoneyConceptsSettings extends Required<SmartMoneyConceptsOptions> {
  show: boolean;
  mode: SmartMoneyConceptsMode;
  style: SmartMoneyConceptsStyle;
  showTrend: boolean;
  showInternal: boolean;
  internalBullishStructure: SmartMoneyConceptsDisplayFilter;
  internalBearishStructure: SmartMoneyConceptsDisplayFilter;
  internalFilterConfluence: boolean;
  internalLabelSize: SmartMoneyConceptsLabelSize;
  showStructure: boolean;
  swingBullishStructure: SmartMoneyConceptsDisplayFilter;
  swingBearishStructure: SmartMoneyConceptsDisplayFilter;
  swingLabelSize: SmartMoneyConceptsLabelSize;
  showSwingsPoints: boolean;
  swingsLength: number;
  showHighLowSwings: boolean;
  showInternalOrderBlocks: boolean;
  showSwingOrderBlocks: boolean;
  orderBlockFilter: SmartMoneyConceptsOrderBlockFilter;
  orderBlockMitigation: SmartMoneyConceptsOrderBlockMitigation;
  showEqualLevels: boolean;
  equalLabelSize: SmartMoneyConceptsLabelSize;
  showFairValueGaps: boolean;
  fairValueGapsAutoThreshold: boolean;
  fairValueGapsTimeframe: string;
  fairValueGapsExtend: number;
  showDailyLevels: boolean;
  showWeeklyLevels: boolean;
  showMonthlyLevels: boolean;
  showZones: boolean;
  internalBullColor: string;
  internalBearColor: string;
  swingBullColor: string;
  swingBearColor: string;
  internalBullishOrderBlockColor: string;
  internalBearishOrderBlockColor: string;
  swingBullishOrderBlockColor: string;
  swingBearishOrderBlockColor: string;
  fairValueGapsBullColor: string;
  fairValueGapsBearColor: string;
  premiumZoneColor: string;
  equilibriumZoneColor: string;
  discountZoneColor: string;
}

export interface SmartMoneyConceptsPivot {
  kind: 'high' | 'low';
  scope: SmartMoneyConceptsStructureScope;
  index: number;
  level: number;
  lastLevel: number | null;
  crossed: boolean;
}

export interface SmartMoneyConceptsStructureEvent {
  kind: SmartMoneyConceptsStructureKind;
  bias: SmartMoneyConceptsBias;
  scope: SmartMoneyConceptsStructureScope;
  level: number;
  pivotIndex: number;
  breakIndex: number;
}

export interface SmartMoneyConceptsEqualLevel {
  kind: 'EQH' | 'EQL';
  leftIndex: number;
  rightIndex: number;
  leftLevel: number;
  rightLevel: number;
  level: number;
}

export interface SmartMoneyConceptsOrderBlock {
  bias: SmartMoneyConceptsBias;
  scope: SmartMoneyConceptsStructureScope;
  leftIndex: number;
  rightIndex: number;
  high: number;
  low: number;
}

export interface SmartMoneyConceptsFairValueGap {
  bias: SmartMoneyConceptsBias;
  leftIndex: number;
  middleIndex: number;
  rightIndex: number;
  top: number;
  bottom: number;
}

export interface SmartMoneyConceptsZones {
  premium: { top: number; bottom: number } | null;
  equilibrium: { top: number; bottom: number } | null;
  discount: { top: number; bottom: number } | null;
}

export interface SmartMoneyConceptsResult {
  pivots: SmartMoneyConceptsPivot[];
  structures: SmartMoneyConceptsStructureEvent[];
  equalLevels: SmartMoneyConceptsEqualLevel[];
  orderBlocks: SmartMoneyConceptsOrderBlock[];
  fairValueGaps: SmartMoneyConceptsFairValueGap[];
  zones: SmartMoneyConceptsZones;
}

export const DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS: SmartMoneyConceptsSettings = {
  show: false,
  swingLength: 50,
  internalLength: 5,
  equalLength: 3,
  equalThreshold: 0.1,
  includeInternal: true,
  includeOrderBlocks: true,
  includeFairValueGaps: true,
  pivotMode: 'lux',
  internalOrderBlocksSize: 5,
  swingOrderBlocksSize: 5,
  maxOrderBlocks: 5,
  mode: 'Historical',
  style: 'Colored',
  showTrend: false,
  showInternal: true,
  internalBullishStructure: 'All',
  internalBearishStructure: 'All',
  internalFilterConfluence: false,
  internalLabelSize: 'tiny',
  showStructure: true,
  swingBullishStructure: 'All',
  swingBearishStructure: 'All',
  swingLabelSize: 'small',
  showSwingsPoints: false,
  swingsLength: 50,
  showHighLowSwings: true,
  showInternalOrderBlocks: true,
  showSwingOrderBlocks: false,
  orderBlockFilter: 'Atr',
  orderBlockMitigation: 'High/Low',
  showEqualLevels: true,
  equalLabelSize: 'tiny',
  showFairValueGaps: false,
  fairValueGapsAutoThreshold: true,
  fairValueGapsTimeframe: '',
  fairValueGapsExtend: 1,
  showDailyLevels: true,
  showWeeklyLevels: true,
  showMonthlyLevels: true,
  showZones: false,
  internalBullColor: '#089981',
  internalBearColor: '#f23645',
  swingBullColor: '#089981',
  swingBearColor: '#f23645',
  internalBullishOrderBlockColor: 'rgba(49,121,245,0.20)',
  internalBearishOrderBlockColor: 'rgba(247,124,128,0.20)',
  swingBullishOrderBlockColor: 'rgba(24,72,204,0.20)',
  swingBearishOrderBlockColor: 'rgba(178,40,51,0.20)',
  fairValueGapsBullColor: 'rgba(0,255,104,0.25)',
  fairValueGapsBearColor: 'rgba(255,0,8,0.25)',
  premiumZoneColor: '#f23645',
  equilibriumZoneColor: '#878b94',
  discountZoneColor: '#089981',
};

export const EMPTY_SMART_MONEY_CONCEPTS_RESULT: SmartMoneyConceptsResult = {
  pivots: [],
  structures: [],
  equalLevels: [],
  orderBlocks: [],
  fairValueGaps: [],
  zones: { premium: null, equilibrium: null, discount: null },
};

interface PivotCandidate {
  kind: 'high' | 'low';
  index: number;
  level: number;
}

interface RuntimePivot extends PivotCandidate {
  lastLevel: number | null;
  crossed: boolean;
}

function safeLength(value: unknown, fallback: number): number {
  const next = Math.floor(Number(value));
  return Number.isFinite(next) && next >= 1 ? next : fallback;
}

function safeLengthInRange(value: unknown, fallback: number, min: number, max: number): number {
  const next = Math.floor(Number(value));
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function safeDisplayFilter(value: unknown, fallback: SmartMoneyConceptsDisplayFilter): SmartMoneyConceptsDisplayFilter {
  return value === 'BOS' || value === 'CHoCH' || value === 'All' ? value : fallback;
}

function safeLabelSize(value: unknown, fallback: SmartMoneyConceptsLabelSize): SmartMoneyConceptsLabelSize {
  return value === 'small' || value === 'normal' || value === 'tiny' ? value : fallback;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeSmartMoneyConceptsSettings(
  settings: Partial<SmartMoneyConceptsSettings> | null | undefined,
): SmartMoneyConceptsSettings {
  const source = settings ?? {};
  const equalThreshold = Number(source.equalThreshold);
  return {
    ...DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS,
    ...source,
    show: safeBoolean(source.show, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.show),
    swingLength: safeLength(source.swingLength ?? source.swingsLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingLength),
    internalLength: safeLength(source.internalLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalLength),
    equalLength: safeLength(source.equalLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equalLength),
    equalThreshold: Number.isFinite(equalThreshold) && equalThreshold >= 0 && equalThreshold <= 0.5
      ? equalThreshold
      : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equalThreshold,
    includeInternal: safeBoolean(source.showInternal ?? source.includeInternal, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeInternal),
    includeOrderBlocks: safeBoolean(
      source.includeOrderBlocks ?? source.showInternalOrderBlocks ?? source.showSwingOrderBlocks,
      DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeOrderBlocks,
    ),
    includeFairValueGaps: safeBoolean(source.showFairValueGaps ?? source.includeFairValueGaps, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeFairValueGaps),
    pivotMode: source.pivotMode === 'strict' ? 'strict' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.pivotMode,
    internalOrderBlocksSize: safeLengthInRange(source.internalOrderBlocksSize, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalOrderBlocksSize, 1, 20),
    swingOrderBlocksSize: safeLengthInRange(source.swingOrderBlocksSize, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingOrderBlocksSize, 1, 20),
    maxOrderBlocks: safeLength(source.maxOrderBlocks, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.maxOrderBlocks),
    mode: source.mode === 'Present' ? 'Present' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.mode,
    style: source.style === 'Monochrome' ? 'Monochrome' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.style,
    showTrend: safeBoolean(source.showTrend, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showTrend),
    showInternal: safeBoolean(source.showInternal, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showInternal),
    internalBullishStructure: safeDisplayFilter(source.internalBullishStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBullishStructure),
    internalBearishStructure: safeDisplayFilter(source.internalBearishStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBearishStructure),
    internalFilterConfluence: safeBoolean(source.internalFilterConfluence, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalFilterConfluence),
    internalLabelSize: safeLabelSize(source.internalLabelSize, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalLabelSize),
    showStructure: safeBoolean(source.showStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showStructure),
    swingBullishStructure: safeDisplayFilter(source.swingBullishStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBullishStructure),
    swingBearishStructure: safeDisplayFilter(source.swingBearishStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBearishStructure),
    swingLabelSize: safeLabelSize(source.swingLabelSize, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingLabelSize),
    showSwingsPoints: safeBoolean(source.showSwingsPoints, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showSwingsPoints),
    swingsLength: safeLengthInRange(source.swingsLength ?? source.swingLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingsLength, 10, 500),
    showHighLowSwings: safeBoolean(source.showHighLowSwings, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showHighLowSwings),
    showInternalOrderBlocks: safeBoolean(source.showInternalOrderBlocks, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showInternalOrderBlocks),
    showSwingOrderBlocks: safeBoolean(source.showSwingOrderBlocks, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showSwingOrderBlocks),
    orderBlockFilter: source.orderBlockFilter === 'Cumulative Mean Range' ? 'Cumulative Mean Range' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.orderBlockFilter,
    orderBlockMitigation: source.orderBlockMitigation === 'Close' ? 'Close' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.orderBlockMitigation,
    showEqualLevels: safeBoolean(source.showEqualLevels, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showEqualLevels),
    equalLabelSize: safeLabelSize(source.equalLabelSize, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equalLabelSize),
    showFairValueGaps: safeBoolean(source.showFairValueGaps, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showFairValueGaps),
    fairValueGapsAutoThreshold: safeBoolean(source.fairValueGapsAutoThreshold, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.fairValueGapsAutoThreshold),
    fairValueGapsTimeframe: safeString(source.fairValueGapsTimeframe, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.fairValueGapsTimeframe),
    fairValueGapsExtend: safeLengthInRange(source.fairValueGapsExtend, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.fairValueGapsExtend, 0, 50),
    showDailyLevels: safeBoolean(source.showDailyLevels, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showDailyLevels),
    showWeeklyLevels: safeBoolean(source.showWeeklyLevels, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showWeeklyLevels),
    showMonthlyLevels: safeBoolean(source.showMonthlyLevels, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showMonthlyLevels),
    showZones: safeBoolean(source.showZones, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showZones),
    internalBullColor: safeString(source.internalBullColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBullColor),
    internalBearColor: safeString(source.internalBearColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBearColor),
    swingBullColor: safeString(source.swingBullColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBullColor),
    swingBearColor: safeString(source.swingBearColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBearColor),
    internalBullishOrderBlockColor: safeString(source.internalBullishOrderBlockColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBullishOrderBlockColor),
    internalBearishOrderBlockColor: safeString(source.internalBearishOrderBlockColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalBearishOrderBlockColor),
    swingBullishOrderBlockColor: safeString(source.swingBullishOrderBlockColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBullishOrderBlockColor),
    swingBearishOrderBlockColor: safeString(source.swingBearishOrderBlockColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingBearishOrderBlockColor),
    fairValueGapsBullColor: safeString(source.fairValueGapsBullColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.fairValueGapsBullColor),
    fairValueGapsBearColor: safeString(source.fairValueGapsBearColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.fairValueGapsBearColor),
    premiumZoneColor: safeString(source.premiumZoneColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.premiumZoneColor),
    equilibriumZoneColor: safeString(source.equilibriumZoneColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equilibriumZoneColor),
    discountZoneColor: safeString(source.discountZoneColor, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.discountZoneColor),
  };
}

function cacheCandlePart(candle: SmartMoneyConceptsCandle | undefined): string {
  if (!candle) return 'none';
  return [
    candle.time ?? '',
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume ?? '',
  ].join(':');
}

export function buildSmartMoneyConceptsCacheKey(
  candles: SmartMoneyConceptsCandle[],
  settings: SmartMoneyConceptsSettings,
): string {
  return [
    candles.length,
    cacheCandlePart(candles[0]),
    cacheCandlePart(candles[candles.length - 1]),
    settings.swingLength,
    settings.internalLength,
    settings.equalLength,
    settings.equalThreshold,
    Number(settings.includeInternal),
    Number(settings.includeOrderBlocks),
    Number(settings.includeFairValueGaps),
    settings.pivotMode,
    settings.mode,
    Number(settings.showInternalOrderBlocks),
    Number(settings.showSwingOrderBlocks),
    settings.internalOrderBlocksSize,
    settings.swingOrderBlocksSize,
    settings.orderBlockFilter,
    settings.orderBlockMitigation,
    Number(settings.fairValueGapsAutoThreshold),
    settings.fairValueGapsExtend,
  ].join('|');
}

function isStrictPivotHigh(candles: SmartMoneyConceptsCandle[], index: number, span: number): boolean {
  const current = candles[index];
  if (!current) return false;
  for (let offset = 1; offset <= span; offset += 1) {
    const left = candles[index - offset];
    const right = candles[index + offset];
    if (!left || !right || current.high <= left.high || current.high <= right.high) return false;
  }
  return true;
}

function isStrictPivotLow(candles: SmartMoneyConceptsCandle[], index: number, span: number): boolean {
  const current = candles[index];
  if (!current) return false;
  for (let offset = 1; offset <= span; offset += 1) {
    const left = candles[index - offset];
    const right = candles[index + offset];
    if (!left || !right || current.low >= left.low || current.low >= right.low) return false;
  }
  return true;
}

function calculateStrictPivotCandidates(candles: SmartMoneyConceptsCandle[], span: number): PivotCandidate[] {
  const candidates: PivotCandidate[] = [];
  for (let index = span; index < candles.length - span; index += 1) {
    if (isStrictPivotHigh(candles, index, span)) {
      candidates.push({ kind: 'high', index, level: candles[index].high });
    }
    if (isStrictPivotLow(candles, index, span)) {
      candidates.push({ kind: 'low', index, level: candles[index].low });
    }
  }
  candidates.sort((a, b) => a.index - b.index || (a.kind === 'high' ? -1 : 1));
  return candidates;
}

function highestRecentHigh(candles: SmartMoneyConceptsCandle[], endIndex: number, length: number): number {
  let highest = -Infinity;
  const start = Math.max(0, endIndex - length + 1);
  for (let index = start; index <= endIndex; index += 1) {
    highest = Math.max(highest, candles[index]?.high ?? -Infinity);
  }
  return highest;
}

function lowestRecentLow(candles: SmartMoneyConceptsCandle[], endIndex: number, length: number): number {
  let lowest = Infinity;
  const start = Math.max(0, endIndex - length + 1);
  for (let index = start; index <= endIndex; index += 1) {
    lowest = Math.min(lowest, candles[index]?.low ?? Infinity);
  }
  return lowest;
}

function calculateLuxPivotCandidates(candles: SmartMoneyConceptsCandle[], span: number): PivotCandidate[] {
  const candidates: PivotCandidate[] = [];
  let previousLeg = 0;

  for (let currentIndex = span; currentIndex < candles.length; currentIndex += 1) {
    const pivotIndex = currentIndex - span;
    const pivot = candles[pivotIndex];
    if (!pivot) continue;

    let currentLeg = previousLeg;
    if (pivot.high > highestRecentHigh(candles, currentIndex, span)) {
      currentLeg = 0;
    } else if (pivot.low < lowestRecentLow(candles, currentIndex, span)) {
      currentLeg = 1;
    }

    const legChange = currentLeg - previousLeg;
    if (legChange === -1) {
      candidates.push({ kind: 'high', index: pivotIndex, level: pivot.high });
    } else if (legChange === 1) {
      candidates.push({ kind: 'low', index: pivotIndex, level: pivot.low });
    }
    previousLeg = currentLeg;
  }

  return candidates;
}

function calculatePivotCandidates(
  candles: SmartMoneyConceptsCandle[],
  span: number,
  pivotMode: SmartMoneyConceptsPivotMode,
): PivotCandidate[] {
  return pivotMode === 'strict'
    ? calculateStrictPivotCandidates(candles, span)
    : calculateLuxPivotCandidates(candles, span);
}

function calculateTrueRange(candles: SmartMoneyConceptsCandle[], index: number): number {
  const current = candles[index];
  if (!current) return 0;
  const previous = candles[index - 1];
  if (!previous) return current.high - current.low;
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close),
  );
}

function calculateAtr(candles: SmartMoneyConceptsCandle[], index: number, length = 200): number {
  const end = Math.max(0, Math.min(index, candles.length - 1));
  const start = Math.max(0, end - length + 1);
  let atr = calculateTrueRange(candles, start);
  let count = 1;
  for (let i = start + 1; i <= end; i += 1) {
    const tr = calculateTrueRange(candles, i);
    count += 1;
    if (count <= length) {
      atr = atr + (tr - atr) / count;
    } else {
      atr = (atr * (length - 1) + tr) / length;
    }
  }
  return atr;
}

function calculateCumulativeMeanRange(candles: SmartMoneyConceptsCandle[], index: number): number {
  const end = Math.max(0, Math.min(index, candles.length - 1));
  let total = 0;
  let count = 0;
  for (let i = 0; i <= end; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    total += Math.max(0, candle.high - candle.low);
    count += 1;
  }
  return count > 0 ? total / count : 0;
}

function calculateMeanRange(candles: SmartMoneyConceptsCandle[]): number {
  if (!candles.length) return 0;
  const total = candles.reduce((sum, _candle, index) => sum + calculateTrueRange(candles, index), 0);
  return total / candles.length;
}

function calculateEqualLevels(
  candles: SmartMoneyConceptsCandle[],
  span: number,
  thresholdRatio: number,
  pivotMode: SmartMoneyConceptsPivotMode,
): SmartMoneyConceptsEqualLevel[] {
  const candidates = calculatePivotCandidates(candles, span, pivotMode);
  const meanRange = calculateMeanRange(candles);
  const threshold = Math.max(0, Number(thresholdRatio) || 0.1) * meanRange;
  const result: SmartMoneyConceptsEqualLevel[] = [];
  let lastHigh: PivotCandidate | null = null;
  let lastLow: PivotCandidate | null = null;

  candidates.forEach((candidate) => {
    if (candidate.kind === 'high') {
      if (lastHigh && Math.abs(lastHigh.level - candidate.level) <= threshold) {
        result.push({
          kind: 'EQH',
          leftIndex: lastHigh.index,
          rightIndex: candidate.index,
          leftLevel: lastHigh.level,
          rightLevel: candidate.level,
          level: (lastHigh.level + candidate.level) / 2,
        });
      }
      lastHigh = candidate;
    } else {
      if (lastLow && Math.abs(lastLow.level - candidate.level) <= threshold) {
        result.push({
          kind: 'EQL',
          leftIndex: lastLow.index,
          rightIndex: candidate.index,
          leftLevel: lastLow.level,
          rightLevel: candidate.level,
          level: (lastLow.level + candidate.level) / 2,
        });
      }
      lastLow = candidate;
    }
  });

  return result;
}

function createOrderBlock(
  candles: SmartMoneyConceptsCandle[],
  event: SmartMoneyConceptsStructureEvent,
  settings: Pick<SmartMoneyConceptsSettings, 'orderBlockFilter'>,
): SmartMoneyConceptsOrderBlock | null {
  const start = Math.max(0, event.pivotIndex);
  const end = Math.min(candles.length - 1, event.breakIndex - 1);
  if (end < start) return null;

  let selectedIndex = start;
  for (let index = start; index <= end; index += 1) {
    const candle = candles[index];
    const selected = candles[selectedIndex];
    if (!candle || !selected) continue;
    if (event.bias === 'bullish' && candle.low < selected.low) selectedIndex = index;
    if (event.bias === 'bearish' && candle.high > selected.high) selectedIndex = index;
  }
  const selected = candles[selectedIndex];
  if (!selected) return null;
  const selectedRange = selected.high - selected.low;
  const filterRange = settings.orderBlockFilter === 'Atr'
    ? calculateAtr(candles, selectedIndex)
    : calculateCumulativeMeanRange(candles, selectedIndex);
  if (filterRange > 0 && selectedRange > filterRange * 2) return null;
  return {
    bias: event.bias,
    scope: event.scope,
    leftIndex: selectedIndex,
    rightIndex: event.breakIndex,
    high: selected.high,
    low: selected.low,
  };
}

function isOrderBlockMitigated(
  candles: SmartMoneyConceptsCandle[],
  block: SmartMoneyConceptsOrderBlock,
  mitigation: SmartMoneyConceptsOrderBlockMitigation,
): boolean {
  for (let index = block.rightIndex + 1; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    if (mitigation === 'Close') {
      if (block.bias === 'bearish' && candle.close > block.high) return true;
      if (block.bias === 'bullish' && candle.close < block.low) return true;
    } else {
      if (block.bias === 'bearish' && candle.high > block.high) return true;
      if (block.bias === 'bullish' && candle.low < block.low) return true;
    }
  }
  return false;
}

function selectActiveOrderBlocks(
  candles: SmartMoneyConceptsCandle[],
  blocks: SmartMoneyConceptsOrderBlock[],
  settings: Pick<SmartMoneyConceptsSettings, 'showInternalOrderBlocks' | 'showSwingOrderBlocks' | 'internalOrderBlocksSize' | 'swingOrderBlocksSize' | 'orderBlockMitigation'>,
): SmartMoneyConceptsOrderBlock[] {
  const active = blocks
    .filter((block) => !isOrderBlockMitigated(candles, block, settings.orderBlockMitigation))
    .sort((a, b) => b.rightIndex - a.rightIndex);
  const internal = settings.showInternalOrderBlocks
    ? active.filter((block) => block.scope === 'internal').slice(0, settings.internalOrderBlocksSize)
    : [];
  const swing = settings.showSwingOrderBlocks
    ? active.filter((block) => block.scope === 'swing').slice(0, settings.swingOrderBlocksSize)
    : [];
  return [...internal, ...swing].sort((a, b) => b.rightIndex - a.rightIndex);
}

function calculateStructuresForScope(
  candles: SmartMoneyConceptsCandle[],
  span: number,
  scope: SmartMoneyConceptsStructureScope,
  pivotMode: SmartMoneyConceptsPivotMode,
): {
  pivots: SmartMoneyConceptsPivot[];
  structures: SmartMoneyConceptsStructureEvent[];
} {
  const candidates = calculatePivotCandidates(candles, span, pivotMode);
  const candidatesByConfirmation = new Map<number, PivotCandidate[]>();
  candidates.forEach((candidate) => {
    const confirmationIndex = candidate.index + span;
    const list = candidatesByConfirmation.get(confirmationIndex) ?? [];
    list.push(candidate);
    candidatesByConfirmation.set(confirmationIndex, list);
  });

  const pivots: SmartMoneyConceptsPivot[] = [];
  const structures: SmartMoneyConceptsStructureEvent[] = [];
  let highPivot: RuntimePivot | null = null;
  let lowPivot: RuntimePivot | null = null;
  let lastHighLevel: number | null = null;
  let lastLowLevel: number | null = null;
  let trendBias: 0 | 1 | -1 = 0;

  for (let index = 0; index < candles.length; index += 1) {
    const confirmed = candidatesByConfirmation.get(index) ?? [];
    confirmed.forEach((candidate) => {
      if (candidate.kind === 'high') {
        highPivot = { ...candidate, lastLevel: lastHighLevel, crossed: false };
        lastHighLevel = candidate.level;
        pivots.push({ ...highPivot, scope });
      } else {
        lowPivot = { ...candidate, lastLevel: lastLowLevel, crossed: false };
        lastLowLevel = candidate.level;
        pivots.push({ ...lowPivot, scope });
      }
    });

    const current = candles[index];
    const previous = candles[index - 1];
    if (!current || !previous) continue;

    if (highPivot && !highPivot.crossed && previous.close <= highPivot.level && current.close > highPivot.level) {
      const kind: SmartMoneyConceptsStructureKind = trendBias === -1 ? 'CHoCH' : 'BOS';
      structures.push({
        kind,
        bias: 'bullish',
        scope,
        level: highPivot.level,
        pivotIndex: highPivot.index,
        breakIndex: index,
      });
      highPivot.crossed = true;
      trendBias = 1;
    }

    if (lowPivot && !lowPivot.crossed && previous.close >= lowPivot.level && current.close < lowPivot.level) {
      const kind: SmartMoneyConceptsStructureKind = trendBias === 1 ? 'CHoCH' : 'BOS';
      structures.push({
        kind,
        bias: 'bearish',
        scope,
        level: lowPivot.level,
        pivotIndex: lowPivot.index,
        breakIndex: index,
      });
      lowPivot.crossed = true;
      trendBias = -1;
    }
  }

  return { pivots, structures };
}

function calculateFairValueGaps(
  candles: SmartMoneyConceptsCandle[],
  settings: Pick<SmartMoneyConceptsSettings, 'fairValueGapsAutoThreshold'>,
): SmartMoneyConceptsFairValueGap[] {
  const result: SmartMoneyConceptsFairValueGap[] = [];
  let cumulativeRelativeRange = 0;
  for (let index = 2; index < candles.length; index += 1) {
    const left = candles[index - 2];
    const middle = candles[index - 1];
    const right = candles[index];
    if (!left || !middle || !right) continue;
    cumulativeRelativeRange += left.low > 0 ? (left.high - left.low) / left.low : 0;
    const autoThreshold = settings.fairValueGapsAutoThreshold ? cumulativeRelativeRange / Math.max(1, index - 1) : 0;
    const bullishGapRatio = left.high > 0 ? (right.low - left.high) / left.high : 0;
    const bearishGapRatio = left.low > 0 ? (left.low - right.high) / left.low : 0;
    if (right.low > left.high && middle.close > left.high) {
      if (bullishGapRatio <= autoThreshold) continue;
      result.push({
        bias: 'bullish',
        leftIndex: index - 2,
        middleIndex: index - 1,
        rightIndex: index,
        top: right.low,
        bottom: left.high,
      });
    }
    if (right.high < left.low && middle.close < left.low) {
      if (bearishGapRatio <= autoThreshold) continue;
      result.push({
        bias: 'bearish',
        leftIndex: index - 2,
        middleIndex: index - 1,
        rightIndex: index,
        top: left.low,
        bottom: right.high,
      });
    }
  }
  return result;
}

function selectPresentStructures(structures: SmartMoneyConceptsStructureEvent[]): SmartMoneyConceptsStructureEvent[] {
  const latest = new Map<string, SmartMoneyConceptsStructureEvent>();
  structures.forEach((event) => {
    latest.set(`${event.scope}:${event.bias}`, event);
  });
  return [...latest.values()].sort((a, b) => a.breakIndex - b.breakIndex);
}

function selectPresentEqualLevels(levels: SmartMoneyConceptsEqualLevel[]): SmartMoneyConceptsEqualLevel[] {
  const latest = new Map<string, SmartMoneyConceptsEqualLevel>();
  levels.forEach((level) => latest.set(level.kind, level));
  return [...latest.values()].sort((a, b) => a.rightIndex - b.rightIndex);
}

function calculateZones(candles: SmartMoneyConceptsCandle[], pivots: SmartMoneyConceptsPivot[]): SmartMoneyConceptsZones {
  const lastHigh = [...pivots].reverse().find((pivot) => pivot.scope === 'swing' && pivot.kind === 'high');
  const lastLow = [...pivots].reverse().find((pivot) => pivot.scope === 'swing' && pivot.kind === 'low');
  if (!lastHigh || !lastLow || !candles.length) {
    return { premium: null, equilibrium: null, discount: null };
  }
  const top = Math.max(lastHigh.level, lastLow.level);
  const bottom = Math.min(lastHigh.level, lastLow.level);
  const range = top - bottom;
  if (!(range > 0)) return { premium: null, equilibrium: null, discount: null };
  return {
    premium: { top, bottom: bottom + range * 0.95 },
    equilibrium: { top: bottom + range * 0.525, bottom: bottom + range * 0.475 },
    discount: { top: bottom + range * 0.05, bottom },
  };
}

export function calculateSmartMoneyConcepts(
  candles: SmartMoneyConceptsCandle[],
  options: SmartMoneyConceptsOptions = {},
): SmartMoneyConceptsResult {
  const settings = normalizeSmartMoneyConceptsSettings(options as Partial<SmartMoneyConceptsSettings>);
  const swingLength = settings.swingLength;
  const internalLength = settings.internalLength;
  const equalLength = settings.equalLength;
  const pivotMode = settings.pivotMode;
  const includeInternal = settings.includeInternal;
  const includeOrderBlocks = settings.includeOrderBlocks;
  const includeFairValueGaps = settings.includeFairValueGaps;

  const swing = calculateStructuresForScope(candles, swingLength, 'swing', pivotMode);
  const internal = includeInternal
    ? calculateStructuresForScope(candles, internalLength, 'internal', pivotMode)
    : { pivots: [] as SmartMoneyConceptsPivot[], structures: [] as SmartMoneyConceptsStructureEvent[] };

  const pivots = [...swing.pivots, ...internal.pivots].sort((a, b) => a.index - b.index);
  const allStructures = [...swing.structures, ...internal.structures].sort((a, b) => a.breakIndex - b.breakIndex);
  const structures = settings.mode === 'Present' ? selectPresentStructures(allStructures) : allStructures;
  const orderBlocks = includeOrderBlocks
    ? allStructures.map((event) => createOrderBlock(candles, event, settings)).filter((block): block is SmartMoneyConceptsOrderBlock => Boolean(block))
    : [];
  const equalLevels = calculateEqualLevels(candles, equalLength, settings.equalThreshold, pivotMode);

  return {
    pivots,
    structures,
    equalLevels: settings.mode === 'Present' ? selectPresentEqualLevels(equalLevels) : equalLevels,
    orderBlocks: selectActiveOrderBlocks(candles, orderBlocks, settings),
    fairValueGaps: includeFairValueGaps ? calculateFairValueGaps(candles, settings) : [],
    zones: calculateZones(candles, pivots),
  };
}
