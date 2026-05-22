import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBb,
  calculateCci,
  calculateCvd,
  calculateDmi,
  calculateEma,
  calculateEnvelope,
  calculateAtr,
  calculateHma,
  calculateIchimoku,
  calculateMacd,
  calculateMa,
  calculateObv,
  calculateRsi,
  calculateStochastic,
  calculateVwap,
} from '../src/chart/indicators/index.ts';

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

test('indicator modules calculate MA and EMA arrays aligned to source candles', () => {
  const candles = [1, 2, 3, 4, 5].map((close) => candle(close - 0.5, close + 1, close - 1, close));

  const ma = calculateMa(candles, 3);
  const ema = calculateEma(candles, 3);

  assert.deepEqual(ma, [null, null, 2, 3, 4]);
  assert.deepEqual(ema.slice(0, 2), [null, null]);
  assert.equal(ema[2], 2);
  assert.equal(ema[4], 4);
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

test('indicator modules calculate Envelope bands from moving average and percentage', () => {
  const candles = [10, 20, 30, 40].map((close) => candle(close - 1, close + 2, close - 2, close));

  const envelope = calculateEnvelope(candles, 2, 10);

  assert.deepEqual(envelope.mid, [null, 15, 25, 35]);
  assert.deepEqual(envelope.upper, [null, 16.5, 27.500000000000004, 38.5]);
  assert.deepEqual(envelope.lower, [null, 13.5, 22.5, 31.5]);
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
