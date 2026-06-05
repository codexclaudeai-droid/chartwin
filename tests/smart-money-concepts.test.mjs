import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_SMART_MONEY_CONCEPTS_RESULT,
  buildSmartMoneyConceptsCacheKey,
  calculateSmartMoneyConcepts,
  normalizeSmartMoneyConceptsSettings,
} from '../src/chart/indicators/index.ts';

const candle = (open, high, low, close, time = 0, volume = 1) => ({
  open,
  high,
  low,
  close,
  time,
  volume,
});

test('detects swing BOS and CHoCH events from confirmed OHLC pivots', () => {
  const candles = [
    candle(10, 11, 9, 10, 1),
    candle(10, 15, 10, 14, 2),
    candle(14, 13, 8, 9, 3),
    candle(9, 12, 7, 8, 4),
    candle(8, 16, 8, 16, 5),
    candle(16, 14, 6, 6.5, 6),
  ];

  const smc = calculateSmartMoneyConcepts(candles, {
    swingLength: 1,
    internalLength: 1,
    equalLength: 1,
    includeInternal: false,
    pivotMode: 'strict',
  });

  assert.deepEqual(
    smc.structures.map((event) => ({
      kind: event.kind,
      bias: event.bias,
      level: event.level,
      pivotIndex: event.pivotIndex,
      breakIndex: event.breakIndex,
    })),
    [
      { kind: 'BOS', bias: 'bullish', level: 15, pivotIndex: 1, breakIndex: 4 },
      { kind: 'CHoCH', bias: 'bearish', level: 7, pivotIndex: 3, breakIndex: 5 },
    ],
  );
});

test('detects equal highs, equal lows, fair value gaps, and order blocks', () => {
  const candles = [
    candle(10, 10.5, 9.5, 10, 1),
    candle(10, 12, 9.7, 11.6, 2),
    candle(11.6, 11.8, 9.6, 10, 3),
    candle(10, 12.05, 9.65, 12, 4),
    candle(12, 12, 11.9, 11.95, 5),
    candle(13.1, 13.4, 12.2, 12.5, 6),
    candle(12.5, 12.7, 8.8, 9, 7),
    candle(9, 9.2, 8.7, 8.9, 8),
  ];

  const smc = calculateSmartMoneyConcepts(candles, {
    swingLength: 1,
    internalLength: 1,
    equalLength: 1,
    equalThreshold: 0.2,
    includeInternal: false,
    includeOrderBlocks: true,
    includeFairValueGaps: true,
    pivotMode: 'strict',
  });

  const equalLowSmc = calculateSmartMoneyConcepts([
    candle(10, 10.5, 9.5, 10, 1),
    candle(10, 11, 8, 10.5, 2),
    candle(10.5, 10.8, 9.4, 10, 3),
    candle(10, 11.2, 8.05, 10.2, 4),
    candle(10.2, 10.9, 9.2, 10.3, 5),
  ], {
    swingLength: 1,
    equalLength: 1,
    equalThreshold: 0.2,
    includeInternal: false,
    pivotMode: 'strict',
  });

  assert.equal(smc.equalLevels.some((level) => level.kind === 'EQH' && level.leftIndex === 1 && level.rightIndex === 3), true);
  assert.equal(equalLowSmc.equalLevels.some((level) => level.kind === 'EQL' && level.leftIndex === 1 && level.rightIndex === 3), true);
  assert.equal(smc.fairValueGaps.some((gap) => gap.bias === 'bullish' && gap.leftIndex === 2 && gap.rightIndex === 4), true);
  assert.equal(smc.fairValueGaps.some((gap) => gap.bias === 'bearish' && gap.leftIndex === 5 && gap.rightIndex === 7), true);
  assert.equal(smc.orderBlocks.some((block) => block.bias === 'bullish' && block.leftIndex === 3 && block.high === 12.05 && block.low === 9.65), true);
  assert.equal(smc.orderBlocks.some((block) => block.bias === 'bearish' && block.leftIndex === 5 && block.high === 13.4 && block.low === 12.2), true);
});

test('normalizes SMC settings without allocating empty disabled results', () => {
  const settings = normalizeSmartMoneyConceptsSettings({
    show: true,
    swingLength: -1,
    internalLength: 0,
    equalLength: Number.NaN,
    equalThreshold: 9,
  });

  assert.deepEqual(settings, {
    show: true,
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
  });
  assert.equal(EMPTY_SMART_MONEY_CONCEPTS_RESULT.structures.length, 0);
  assert.equal(EMPTY_SMART_MONEY_CONCEPTS_RESULT.zones.premium, null);
});

test('builds stable SMC cache keys from settings and candle endpoints', () => {
  const candles = [
    candle(10, 12, 9, 11, 100),
    candle(11, 13, 10, 12, 200),
  ];
  const settings = normalizeSmartMoneyConceptsSettings({
    show: true,
    swingLength: 20,
    internalLength: 4,
  });

  const key = buildSmartMoneyConceptsCacheKey(candles, settings);

  assert.equal(key, buildSmartMoneyConceptsCacheKey([...candles], { ...settings }));
  assert.notEqual(key, buildSmartMoneyConceptsCacheKey([...candles, candle(12, 14, 11, 13, 300)], settings));
  assert.notEqual(key, buildSmartMoneyConceptsCacheKey([
    candles[0],
    candle(11, 13, 10, 12.5, 200),
  ], settings));
  assert.notEqual(key, buildSmartMoneyConceptsCacheKey(candles, { ...settings, swingLength: 21 }));
  assert.notEqual(key, buildSmartMoneyConceptsCacheKey(candles, { ...settings, pivotMode: 'strict' }));
});

test('uses LuxAlgo-style right-confirmed leg pivots by default', () => {
  const candles = [
    candle(10, 10, 8, 9.5, 1),
    candle(9.5, 11, 9.2, 10.8, 2),
    candle(10.8, 10.5, 9, 9.8, 3),
    candle(9.8, 10, 9.1, 9.6, 4),
    candle(9.6, 9.5, 8.9, 9.1, 5),
    candle(9.1, 11.4, 9, 11.2, 6),
  ];

  const smc = calculateSmartMoneyConcepts(candles, {
    swingLength: 2,
    internalLength: 2,
    includeInternal: false,
    includeOrderBlocks: false,
    includeFairValueGaps: false,
  });

  assert.deepEqual(
    smc.pivots.map((pivot) => ({ kind: pivot.kind, index: pivot.index, level: pivot.level })),
    [
      { kind: 'low', index: 0, level: 8 },
      { kind: 'high', index: 1, level: 11 },
    ],
  );
  assert.deepEqual(
    smc.structures.map((event) => ({ kind: event.kind, bias: event.bias, level: event.level, pivotIndex: event.pivotIndex, breakIndex: event.breakIndex })),
    [
      { kind: 'BOS', bias: 'bullish', level: 11, pivotIndex: 1, breakIndex: 5 },
    ],
  );
});
