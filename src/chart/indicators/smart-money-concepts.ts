export type SmartMoneyConceptsBias = 'bullish' | 'bearish';
export type SmartMoneyConceptsStructureKind = 'BOS' | 'CHoCH';
export type SmartMoneyConceptsStructureScope = 'internal' | 'swing';
export type SmartMoneyConceptsPivotMode = 'lux' | 'strict';

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
  internalLength?: number;
  equalLength?: number;
  equalThreshold?: number;
  includeInternal?: boolean;
  includeOrderBlocks?: boolean;
  includeFairValueGaps?: boolean;
  pivotMode?: SmartMoneyConceptsPivotMode;
}

export interface SmartMoneyConceptsSettings extends Required<SmartMoneyConceptsOptions> {
  show: boolean;
  showInternal: boolean;
  showStructure: boolean;
  showEqualLevels: boolean;
  showOrderBlocks: boolean;
  showFairValueGaps: boolean;
  showZones: boolean;
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
  showInternal: true,
  showStructure: true,
  showEqualLevels: true,
  showOrderBlocks: true,
  showFairValueGaps: true,
  showZones: false,
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

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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
    swingLength: safeLength(source.swingLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.swingLength),
    internalLength: safeLength(source.internalLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.internalLength),
    equalLength: safeLength(source.equalLength, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equalLength),
    equalThreshold: Number.isFinite(equalThreshold) && equalThreshold >= 0 && equalThreshold <= 0.5
      ? equalThreshold
      : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.equalThreshold,
    includeInternal: safeBoolean(source.showInternal ?? source.includeInternal, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeInternal),
    includeOrderBlocks: safeBoolean(source.showOrderBlocks ?? source.includeOrderBlocks, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeOrderBlocks),
    includeFairValueGaps: safeBoolean(source.showFairValueGaps ?? source.includeFairValueGaps, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.includeFairValueGaps),
    pivotMode: source.pivotMode === 'strict' ? 'strict' : DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.pivotMode,
    showInternal: safeBoolean(source.showInternal, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showInternal),
    showStructure: safeBoolean(source.showStructure, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showStructure),
    showEqualLevels: safeBoolean(source.showEqualLevels, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showEqualLevels),
    showOrderBlocks: safeBoolean(source.showOrderBlocks, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showOrderBlocks),
    showFairValueGaps: safeBoolean(source.showFairValueGaps, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showFairValueGaps),
    showZones: safeBoolean(source.showZones, DEFAULT_SMART_MONEY_CONCEPTS_SETTINGS.showZones),
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
  return {
    bias: event.bias,
    scope: event.scope,
    leftIndex: selectedIndex,
    rightIndex: event.breakIndex,
    high: selected.high,
    low: selected.low,
  };
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

function calculateFairValueGaps(candles: SmartMoneyConceptsCandle[]): SmartMoneyConceptsFairValueGap[] {
  const result: SmartMoneyConceptsFairValueGap[] = [];
  for (let index = 2; index < candles.length; index += 1) {
    const left = candles[index - 2];
    const middle = candles[index - 1];
    const right = candles[index];
    if (!left || !middle || !right) continue;
    if (right.low > left.high && middle.close > left.high) {
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
  const swingLength = safeLength(options.swingLength, 50);
  const internalLength = safeLength(options.internalLength, 5);
  const equalLength = safeLength(options.equalLength, 3);
  const pivotMode = options.pivotMode === 'strict' ? 'strict' : 'lux';
  const includeInternal = options.includeInternal !== false;
  const includeOrderBlocks = options.includeOrderBlocks !== false;
  const includeFairValueGaps = options.includeFairValueGaps !== false;

  const swing = calculateStructuresForScope(candles, swingLength, 'swing', pivotMode);
  const internal = includeInternal
    ? calculateStructuresForScope(candles, internalLength, 'internal', pivotMode)
    : { pivots: [] as SmartMoneyConceptsPivot[], structures: [] as SmartMoneyConceptsStructureEvent[] };

  const pivots = [...swing.pivots, ...internal.pivots].sort((a, b) => a.index - b.index);
  const structures = [...swing.structures, ...internal.structures].sort((a, b) => a.breakIndex - b.breakIndex);
  const orderBlocks = includeOrderBlocks
    ? structures.map((event) => createOrderBlock(candles, event)).filter((block): block is SmartMoneyConceptsOrderBlock => Boolean(block))
    : [];

  return {
    pivots,
    structures,
    equalLevels: calculateEqualLevels(candles, equalLength, Number(options.equalThreshold ?? 0.1), pivotMode),
    orderBlocks,
    fairValueGaps: includeFairValueGaps ? calculateFairValueGaps(candles) : [],
    zones: calculateZones(candles, pivots),
  };
}
