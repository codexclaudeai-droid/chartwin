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
    showSwingOrderBlocks: true,
    includeFairValueGaps: true,
    fairValueGapsAutoThreshold: false,
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
  assert.equal(smc.orderBlocks.some((block) => block.bias === 'bearish' && block.leftIndex === 5 && block.high === 13.4 && block.low === 12.2), true);
  assert.equal(smc.orderBlocks.some((block) => block.bias === 'bullish'), false);
});

test('applies LuxAlgo-style FVG auto threshold filtering', () => {
  const candles = [
    candle(100, 101, 99, 100, 1),
    candle(100, 101, 99, 100.6, 2),
    candle(100.6, 101.4, 100.8, 101.2, 3),
    candle(101.2, 102, 101.2, 101.5, 4),
    candle(100.8, 115, 100.7, 114, 5),
    candle(114, 120, 116, 119, 6),
  ];

  const filtered = calculateSmartMoneyConcepts(candles, {
    includeInternal: false,
    includeOrderBlocks: false,
    includeFairValueGaps: true,
    fairValueGapsAutoThreshold: true,
  });
  const unfiltered = calculateSmartMoneyConcepts(candles, {
    includeInternal: false,
    includeOrderBlocks: false,
    includeFairValueGaps: true,
    fairValueGapsAutoThreshold: false,
  });

  assert.equal(unfiltered.fairValueGaps.some((gap) => gap.leftIndex === 1 && gap.rightIndex === 3), true);
  assert.equal(filtered.fairValueGaps.some((gap) => gap.leftIndex === 1 && gap.rightIndex === 3), false);
  assert.equal(filtered.fairValueGaps.some((gap) => gap.leftIndex === 3 && gap.rightIndex === 5), true);
});

test('normalizes SMC settings without allocating empty disabled results', () => {
  const settings = normalizeSmartMoneyConceptsSettings({
    show: true,
    swingLength: -1,
    internalLength: 0,
    equalLength: Number.NaN,
    equalThreshold: 9,
  });

  assert.deepEqual({
    show: settings.show,
    swingLength: settings.swingLength,
    internalLength: settings.internalLength,
    equalLength: settings.equalLength,
    equalThreshold: settings.equalThreshold,
    includeInternal: settings.includeInternal,
    includeOrderBlocks: settings.includeOrderBlocks,
    includeFairValueGaps: settings.includeFairValueGaps,
    pivotMode: settings.pivotMode,
    internalOrderBlocksSize: settings.internalOrderBlocksSize,
    swingOrderBlocksSize: settings.swingOrderBlocksSize,
    maxOrderBlocks: settings.maxOrderBlocks,
    mode: settings.mode,
    style: settings.style,
    showTrend: settings.showTrend,
    showInternal: settings.showInternal,
    showInternalOrderBlocks: settings.showInternalOrderBlocks,
    showSwingOrderBlocks: settings.showSwingOrderBlocks,
    showStructure: settings.showStructure,
    showEqualLevels: settings.showEqualLevels,
    showFairValueGaps: settings.showFairValueGaps,
    showDailyLevels: settings.showDailyLevels,
    showWeeklyLevels: settings.showWeeklyLevels,
    showMonthlyLevels: settings.showMonthlyLevels,
    showZones: settings.showZones,
  }, {
    show: true,
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
    showInternalOrderBlocks: true,
    showSwingOrderBlocks: false,
    showStructure: true,
    showEqualLevels: true,
    showFairValueGaps: false,
    showDailyLevels: true,
    showWeeklyLevels: true,
    showMonthlyLevels: true,
    showZones: false,
  });
  assert.equal(settings.internalBullishStructure, 'All');
  assert.equal(settings.internalLabelSize, 'tiny');
  assert.equal(settings.swingLabelSize, 'small');
  assert.equal(settings.orderBlockMitigation, 'High/Low');
  assert.equal(settings.fairValueGapsExtend, 1);
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

test('removes mitigated order blocks when support or resistance is broken', () => {
  const candles = [
    candle(10, 12, 9, 11, 1),
    candle(11, 11.5, 8, 8.5, 2),
    candle(8.5, 10, 8.2, 9.5, 3),
    candle(9.5, 10.2, 7.5, 7.8, 4),
    candle(7.8, 9, 7.6, 8.5, 5),
    candle(8.5, 9.2, 7, 7.2, 6),
    candle(7.2, 8, 7.1, 7.5, 7),
    candle(7.5, 8.2, 6.5, 6.8, 8),
  ];

  const smc = calculateSmartMoneyConcepts(candles, {
    swingLength: 1,
    internalLength: 1,
    includeInternal: false,
    includeFairValueGaps: false,
    includeOrderBlocks: true,
    showSwingOrderBlocks: true,
    pivotMode: 'strict',
  });

  assert.equal(smc.orderBlocks.length, 3);
  assert.deepEqual(
    smc.orderBlocks.map((block) => ({ bias: block.bias, leftIndex: block.leftIndex, rightIndex: block.rightIndex })),
    [
      { bias: 'bearish', leftIndex: 5, rightIndex: 7 },
      { bias: 'bearish', leftIndex: 3, rightIndex: 5 },
      { bias: 'bearish', leftIndex: 1, rightIndex: 3 },
    ],
  );

  const mitigated = calculateSmartMoneyConcepts([
    ...candles,
    candle(6.8, 12, 6.7, 11.8, 9),
  ], {
    swingLength: 1,
    internalLength: 1,
    includeInternal: false,
    includeFairValueGaps: false,
    includeOrderBlocks: true,
    showSwingOrderBlocks: true,
    pivotMode: 'strict',
  });

  assert.equal(mitigated.orderBlocks.some((block) => block.bias === 'bearish'), false);
  assert.deepEqual(
    mitigated.orderBlocks.map((block) => ({ bias: block.bias, leftIndex: block.leftIndex, rightIndex: block.rightIndex })),
    [
      { bias: 'bullish', leftIndex: 7, rightIndex: 8 },
    ],
  );

  const wickOnlyBreak = [
    ...candles,
    candle(6.8, 12, 6.7, 7, 9),
  ];
  const highLowMitigation = calculateSmartMoneyConcepts(wickOnlyBreak, {
    swingLength: 1,
    internalLength: 1,
    includeInternal: false,
    includeFairValueGaps: false,
    includeOrderBlocks: true,
    showSwingOrderBlocks: true,
    orderBlockMitigation: 'High/Low',
    pivotMode: 'strict',
  });
  const closeMitigation = calculateSmartMoneyConcepts(wickOnlyBreak, {
    swingLength: 1,
    internalLength: 1,
    includeInternal: false,
    includeFairValueGaps: false,
    includeOrderBlocks: true,
    showSwingOrderBlocks: true,
    orderBlockMitigation: 'Close',
    pivotMode: 'strict',
  });

  assert.equal(highLowMitigation.orderBlocks.some((block) => block.bias === 'bearish'), false);
  assert.equal(closeMitigation.orderBlocks.some((block) => block.bias === 'bearish'), true);
});
