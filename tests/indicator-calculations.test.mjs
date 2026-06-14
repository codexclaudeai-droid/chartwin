import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBb,
  calculateCci,
  calculateCvd,
  calculateDonchianChannel,
  calculateDmi,
  calculateEma,
  calculateEnvelope,
  calculateAtr,
  calculateAtrTrailingEmaSignal,
  calculateAtrTrailingStopOrigin,
  calculateBbMtfKalmanSignal,
  calculateHma,
  calculateIchimoku,
  calculateMacd,
  calculateMa,
  calculateMfi,
  calculateMomentum,
  calculateObv,
  calculateRsi,
  calculateStochastic,
  calculateVwap,
  calculateVwapWithBands,
  calculateWilliamsAlligator,
} from '../src/chart/indicators/index.ts';
import { getExchangeSessionTimezoneForSymbol } from '../src/utils/market-session.ts';

const candle = (open, high, low, close, volume = 100) => ({ time: 0, open, high, low, close, volume });

test('indicator modules calculate RSI with null warmup values', () => {
  const candles = [
    candle(1, 2, 0, 1),
    candle(2, 3, 1, 2),
    candle(3, 4, 2, 3),
    candle(4, 5, 3, 4),
    candle(5, 6, 4, 5),
  ];

  const rsi = calculateRsi(candles, 3);

  assert.deepEqual(rsi.slice(0, 3), [null, null, null]);
  assert.equal(rsi[3], 100);
  assert.equal(rsi[4], 100);
});

test('indicator modules calculate MFI from typical price money flow', () => {
  const candles = [
    candle(9, 11, 9, 10, 100),
    candle(10, 12, 10, 11, 100),
    candle(11, 13, 11, 12, 100),
    candle(10, 12, 10, 11, 100),
    candle(9, 11, 9, 10, 100),
    candle(10, 12, 10, 11, 100),
  ];

  const mfi = calculateMfi(candles, 3);

  assert.deepEqual(mfi.slice(0, 3), [null, null, null]);
  assert.equal(Math.round((mfi[3] ?? 0) * 100) / 100, 67.65);
  assert.equal(Math.round((mfi[4] ?? 0) * 100) / 100, 36.36);
  assert.equal(Math.round((mfi[5] ?? 0) * 100) / 100, 34.38);
});

test('indicator modules calculate Momentum as close minus prior close by period', () => {
  const candles = [10, 12, 11, 15, 14, 18].map((close) => candle(close - 0.5, close + 1, close - 1, close));

  const momentum = calculateMomentum(candles, 3);

  assert.deepEqual(momentum, [null, null, null, 5, 2, 7]);
});

test('indicator modules calculate MA and EMA arrays aligned to source candles', () => {
  const candles = [1, 2, 3, 4, 5].map((close) => candle(close - 0.5, close + 1, close - 1, close));

  const ma = calculateMa(candles, 3);
  const ema = calculateEma(candles, 3);

  assert.deepEqual(ma, [null, null, 2, 3, 4]);
  assert.deepEqual(ema.slice(0, 2), [null, null]);
  assert.equal(ema[2], 2);
  assert.equal(ema[4], 4);
});

test('indicator modules calculate Williams Alligator from HL2 with SMMA warmup and offsets', () => {
  const candles = [1, 2, 3, 4, 5, 6].map((value) => candle(value, value + 1, value - 1, value + 0.25));

  const alligator = calculateWilliamsAlligator(candles, {
    jawLength: 3,
    teethLength: 2,
    lipsLength: 1,
    jawOffset: 2,
    teethOffset: 1,
    lipsOffset: 0,
  });

  assert.deepEqual(alligator.offsets, { jaw: 2, teeth: 1, lips: 0 });
  assert.deepEqual(alligator.lips, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(alligator.teeth.slice(0, 3), [null, 1.5, 2.25]);
  assert.equal(Math.round((alligator.jaw[2] ?? 0) * 100) / 100, 2);
  assert.equal(Math.round((alligator.jaw[3] ?? 0) * 100) / 100, 2.67);
  assert.equal(Math.round((alligator.jaw[5] ?? 0) * 100) / 100, 4.3);
});

test('indicator modules calculate HMA arrays aligned to source candles', () => {
  const candles = [1, 2, 3, 4, 5, 6].map((close) => candle(close - 0.5, close + 1, close - 1, close));

  const hma = calculateHma(candles, 4);

  assert.deepEqual(hma.slice(0, 4), [null, null, null, null]);
  assert.equal(Math.round((hma[4] ?? 0) * 100) / 100, 5);
  assert.equal(Math.round((hma[5] ?? 0) * 100) / 100, 6);
});

test('indicator modules calculate ATR using Wilder smoothing', () => {
  const candles = [
    candle(10, 12, 9, 11),
    candle(11, 14, 10, 13),
    candle(13, 15, 12, 14),
    candle(14, 18, 13, 17),
  ];

  const atr = calculateAtr(candles, 3);

  assert.deepEqual(atr.slice(0, 2), [null, null]);
  assert.equal(Math.round((atr[2] ?? 0) * 100) / 100, 3.33);
  assert.equal(Math.round((atr[3] ?? 0) * 100) / 100, 3.89);
});

test('indicator modules calculate ATR Trailing EMA Signal basic and filtered modes', () => {
  const candles = [
    candle(100, 101, 99, 100),
    candle(96, 97, 95, 96),
    candle(90, 91, 89, 90),
    candle(98, 99, 97, 98),
    candle(102, 103, 101, 102),
    candle(106, 107, 105, 106),
    candle(110, 111, 109, 110),
  ];

  const basic = calculateAtrTrailingEmaSignal(candles, {
    mode: 'basic',
    sensitivity: 1,
    atrPeriod: 2,
    signalEmaLength: 1,
    trendEmaLength: 5,
  });
  const filtered = calculateAtrTrailingEmaSignal(candles, {
    mode: 'filtered',
    sensitivity: 1,
    atrPeriod: 2,
    signalEmaLength: 1,
    trendEmaLength: 5,
  });

  assert.equal(basic.buySignal[3], true);
  assert.equal(filtered.buySignal[3], false);
  assert.equal(basic.sellSignal[2], true);
  assert.equal(basic.atrStop.length, candles.length);
  assert.equal(basic.trendEma.length, candles.length);
  assert.equal(Math.round((basic.trendEma[4] ?? 0) * 100) / 100, 97.2);
});

test('indicator modules calculate ATR Trailing Stop origin with canonical stop branch and close trend EMA', () => {
  const candles = [
    candle(100, 101, 99, 100),
    candle(96, 97, 95, 96),
    candle(90, 91, 89, 90),
    candle(98, 99, 97, 98),
    candle(102, 103, 101, 102),
    candle(106, 107, 105, 106),
    candle(110, 111, 109, 110),
  ];

  const origin = calculateAtrTrailingStopOrigin(candles, {
    sensitivity: 1,
    atrPeriod: 2,
    trendEmaLength: 5,
  });
  const improved = calculateAtrTrailingEmaSignal(candles, {
    mode: 'basic',
    sensitivity: 1,
    atrPeriod: 2,
    signalEmaLength: 1,
    trendEmaLength: 5,
  });

  assert.equal(origin.buySignal[3], true);
  assert.equal(origin.sellSignal[2], true);
  assert.equal(improved.buySignal[3], true);
  assert.equal(origin.atrStop[2], 95.25);
  assert.equal(improved.atrStop[2], 95.25);
  assert.equal(Math.round((origin.trendEma[4] ?? 0) * 100) / 100, 97.2);
});

test('indicator modules calculate BB MTF Kalman Signal with confirmed HTF mapping', () => {
  const candles = Array.from({ length: 24 }, (_, index) => {
    const close = 100 + index;
    return {
      ...candle(close - 0.5, close + 1, close - 1, close),
      time: index * 3600,
    };
  });

  const result = calculateBbMtfKalmanSignal(candles, {
    chartTimeframe: '1h',
    htfTimeframe: '4h',
    ltfLength: 3,
    ltfMult: 2,
    htfLength: 3,
    htfMult: 2,
  });

  assert.equal(result.warning, null);
  assert.deepEqual(result.htfCandleStartIndex.slice(0, 8), [0, 0, 0, 0, 4, 4, 4, 4]);
  assert.equal(result.htfRawBasis[10], null);
  assert.equal(Math.round((result.htfRawBasis[11] ?? 0) * 100) / 100, 107);
  assert.equal(Math.round((result.htfBasis[13] ?? 0) * 100) / 100, 107);
  assert.equal(result.ltfBasis.length, candles.length);
});

test('indicator modules calculate BB MTF Kalman reversal signals and invalid timeframe warning', () => {
  const closes = [
    100, 100, 100, 100,
    100, 100, 100, 100,
    100, 100, 100, 100,
    114, 116, 118, 120,
    119, 118, 117, 116,
    115, 114, 113, 112,
  ];
  const candles = closes.map((close, index) => ({
    ...candle(close - 0.4, close + 1, close - 1, close),
    time: index * 3600,
  }));

  const result = calculateBbMtfKalmanSignal(candles, {
    chartTimeframe: '1h',
    htfTimeframe: '4h',
    ltfLength: 3,
    ltfMult: 1,
    htfLength: 3,
    htfMult: 1,
  });
  const invalid = calculateBbMtfKalmanSignal(candles, {
    chartTimeframe: '1h',
    htfTimeframe: '30m',
  });

  assert.equal(result.sellSignal.some(Boolean), true);
  assert.equal(result.sellSignal.filter(Boolean).length, 1);
  assert.equal(result.buySignal.some(Boolean), false);
  assert.equal(invalid.warning, 'HTF timeframe must be higher than chart timeframe');
  assert.equal(invalid.htfUpper.every((value) => value == null), true);
});

test('indicator modules calculate Envelope bands from moving average and percentage', () => {
  const candles = [10, 20, 30, 40].map((close) => candle(close - 1, close + 2, close - 2, close));

  const envelope = calculateEnvelope(candles, 2, 10);

  assert.deepEqual(envelope.mid, [null, 15, 25, 35]);
  assert.deepEqual(envelope.upper, [null, 16.5, 27.500000000000004, 38.5]);
  assert.deepEqual(envelope.lower, [null, 13.5, 22.5, 31.5]);
});

test('indicator modules calculate Donchian Channel from rolling highs and lows', () => {
  const candles = [
    candle(10, 12, 9, 11),
    candle(11, 13, 10, 12),
    candle(12, 15, 11, 13),
    candle(13, 14, 8, 9),
    candle(9, 10, 7, 8),
  ];

  const donchian = calculateDonchianChannel(candles, 3);

  assert.deepEqual(donchian.upper, [null, null, 15, 15, 15]);
  assert.deepEqual(donchian.lower, [null, null, 9, 8, 7]);
  assert.deepEqual(donchian.middle, [null, null, 12, 11.5, 11]);
});

test('indicator modules calculate Ichimoku lines aligned to source candles', () => {
  const candles = [
    candle(1, 2, 0, 1),
    candle(2, 3, 1, 2),
    candle(3, 5, 2, 3),
    candle(4, 6, 3, 4),
  ];

  const ichimoku = calculateIchimoku(candles, 2, 3, 4);

  assert.deepEqual(ichimoku.tenkanLine, [null, 1.5, 3, 4]);
  assert.deepEqual(ichimoku.kijunLine, [null, null, 2.5, 3.5]);
  assert.deepEqual(ichimoku.senkouA, [null, null, 2.75, 3.75]);
  assert.deepEqual(ichimoku.senkouB, [null, null, null, 3]);
  assert.deepEqual(ichimoku.chikouSpan, [1, 2, 3, 4]);
});

test('indicator modules calculate Bollinger Bands aligned to source candles', () => {
  const candles = [1, 2, 3, 4, 5].map((close) => candle(close - 0.5, close + 1, close - 1, close));

  const bb = calculateBb(candles, 3, 2);

  assert.deepEqual(bb.middle, [null, null, 2, 3, 4]);
  assert.equal(bb.upper.length, candles.length);
  assert.equal(bb.lower.length, candles.length);
  assert.equal(typeof bb.upper[2], 'number');
  assert.equal(typeof bb.lower[4], 'number');
});

test('indicator modules calculate MACD arrays aligned to source candles', () => {
  const candles = Array.from({ length: 12 }, (_, index) => {
    const close = index + 1;
    return candle(close - 0.5, close + 1, close - 1, close);
  });

  const macd = calculateMacd(candles, 3, 6, 3);

  assert.equal(macd.macdLine.length, candles.length);
  assert.equal(macd.sigLine.length, candles.length);
  assert.equal(macd.hist.length, candles.length);
  assert.equal(macd.macdLine.slice(0, 5).every((value) => value == null), true);
  assert.equal(typeof macd.macdLine[5], 'number');
});

test('indicator modules calculate CCI and OBV from candle data', () => {
  const candles = [
    candle(10, 12, 8, 10, 100),
    candle(10, 13, 9, 12, 150),
    candle(12, 14, 10, 11, 80),
    candle(11, 15, 10, 14, 200),
  ];

  const cci = calculateCci(candles, 3);
  const obv = calculateObv(candles);

  assert.deepEqual(cci.slice(0, 2), [null, null]);
  assert.equal(Math.round((cci[2] ?? 0) * 100) / 100, 66.67);
  assert.deepEqual(obv, [0, 150, 70, 270]);
});

test('indicator modules calculate DMI and Stochastic arrays aligned to source candles', () => {
  const candles = [
    candle(10, 12, 8, 11, 100),
    candle(11, 14, 10, 13, 120),
    candle(13, 15, 11, 12, 80),
    candle(12, 16, 12, 15, 150),
    candle(15, 17, 13, 16, 130),
    candle(16, 18, 14, 17, 140),
    candle(17, 19, 15, 18, 160),
  ];

  const dmi = calculateDmi(candles, 3);
  const stoch = calculateStochastic(candles, 3, 2);

  assert.equal(dmi.plusDI.length, candles.length);
  assert.equal(dmi.minusDI.length, candles.length);
  assert.equal(dmi.adx.length, candles.length);
  assert.equal(typeof dmi.plusDI[3], 'number');
  assert.equal(stoch.k.length, candles.length);
  assert.equal(stoch.d.length, candles.length);
  assert.equal(Math.round((stoch.k[4] ?? 0) * 100) / 100, 74.6);
});

test('indicator modules calculate CVD and VWAP from candle data', () => {
  const candles = [
    candle(10, 12, 8, 11, 100),
    candle(11, 13, 10, 10, 50),
    candle(10, 12, 9, 10, 80),
    candle(10, 15, 10, 14, 120),
  ];

  const cvd = calculateCvd(candles);
  const vwap = calculateVwap(candles);

  assert.deepEqual(cvd, [0, -50, -50, 70]);
  assert.equal(Math.round((vwap[0] ?? 0) * 100) / 100, 10.33);
  assert.equal(Math.round((vwap[3] ?? 0) * 100) / 100, 11.34);
});

test('CVD prefers trade-derived candle delta when it is available', () => {
  const candles = [
    { ...candle(10, 12, 8, 11, 100), volumeDelta: -20 },
    { ...candle(11, 13, 10, 12, 50), volumeDelta: 35 },
    { ...candle(12, 13, 9, 10, 80), volumeDelta: -15 },
    candle(10, 15, 10, 14, 120),
  ];

  const cvd = calculateCvd(candles);

  assert.deepEqual(cvd, [-20, 15, 0, 120]);
});

test('VWAP can reset by session and quarter anchors', () => {
  const candles = [
    { ...candle(10, 12, 8, 11, 100), time: Date.UTC(2026, 0, 1, 23, 58) / 1000 },
    { ...candle(12, 14, 10, 13, 100), time: Date.UTC(2026, 0, 1, 23, 59) / 1000 },
    { ...candle(20, 22, 18, 21, 100), time: Date.UTC(2026, 0, 2, 0, 0) / 1000 },
    { ...candle(22, 24, 20, 23, 100), time: Date.UTC(2026, 0, 2, 0, 1) / 1000 },
  ];

  const session = calculateVwap(candles, { anchorPeriod: 'session' });
  const sessionWithAnchors = calculateVwapWithBands(candles, { anchorPeriod: 'session' });
  const quarter = calculateVwap([
    { ...candle(10, 12, 8, 11, 100), time: Date.UTC(2026, 2, 31, 23, 59) / 1000 },
    { ...candle(20, 22, 18, 21, 100), time: Date.UTC(2026, 3, 1, 0, 0) / 1000 },
  ], { anchorPeriod: 'quarter' });

  assert.equal(Math.round((session[1] ?? 0) * 100) / 100, 11.33);
  assert.equal(Math.round((session[2] ?? 0) * 100) / 100, 20.33);
  assert.deepEqual(sessionWithAnchors.anchorStarts, [0, 0, 2, 2]);
  assert.equal(Math.round((quarter[0] ?? 0) * 100) / 100, 10.33);
  assert.equal(Math.round((quarter[1] ?? 0) * 100) / 100, 20.33);
});

test('VWAP day anchor follows the configured exchange session timezone', () => {
  const candles = [
    { ...candle(10, 12, 8, 11, 100), time: Date.UTC(2026, 0, 2, 5, 58) / 1000 },
    { ...candle(12, 14, 10, 13, 100), time: Date.UTC(2026, 0, 2, 5, 59) / 1000 },
    { ...candle(20, 22, 18, 21, 100), time: Date.UTC(2026, 0, 2, 6, 0) / 1000 },
  ];

  const utc = calculateVwap(candles, { anchorPeriod: 'session', sessionTimezone: 'UTC' });
  const chicago = calculateVwap(candles, { anchorPeriod: 'session', sessionTimezone: 'America/Chicago' });

  assert.equal(Math.round((utc[2] ?? 0) * 100) / 100, 14.33);
  assert.equal(Math.round((chicago[1] ?? 0) * 100) / 100, 11.33);
  assert.equal(Math.round((chicago[2] ?? 0) * 100) / 100, 20.33);
});

test('VWAP supports TradingView-style source and offset inputs', () => {
  const candles = [
    candle(10, 14, 8, 12, 100),
    candle(20, 24, 18, 22, 100),
  ];

  const closeSource = calculateVwap(candles, { source: 'close' });
  const shifted = calculateVwap(candles, { source: 'close', offset: 1 });
  const shiftedWithAnchors = calculateVwapWithBands(candles, { source: 'close', offset: 1 });

  assert.deepEqual(closeSource, [12, 17]);
  assert.deepEqual(shifted, [null, 12]);
  assert.deepEqual(shiftedWithAnchors.anchorStarts, [0, 1]);
});

test('VWAP bands support standard deviation and percentage modes', () => {
  const candles = [
    candle(10, 12, 8, 12, 100),
    candle(20, 22, 18, 22, 100),
  ];

  const standardDeviation = calculateVwapWithBands(candles, {
    source: 'close',
    bandMode: 'standard-deviation',
    bandMultipliers: [1, 2, 3],
  });
  const percentage = calculateVwapWithBands(candles, {
    source: 'close',
    bandMode: 'percentage',
    bandMultipliers: [10, 20, 30],
  });

  assert.equal(standardDeviation.vwap[1], 17);
  assert.equal(standardDeviation.bands.upper[0][1], 22);
  assert.equal(standardDeviation.bands.lower[0][1], 12);
  assert.equal(Math.round((percentage.bands.upper[0][1] ?? 0) * 100) / 100, 18.7);
  assert.equal(Math.round((percentage.bands.lower[0][1] ?? 0) * 100) / 100, 15.3);
});

test('VWAP exchange session timezone is inferred from chart symbols', () => {
  assert.equal(getExchangeSessionTimezoneForSymbol('BTCUSDT.P'), 'UTC');
  assert.equal(getExchangeSessionTimezoneForSymbol('NAS100'), 'America/Chicago');
  assert.equal(getExchangeSessionTimezoneForSymbol('KOSPI'), 'Asia/Seoul');
});
