import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { INDICATOR_CATALOG } from '../src/catalog/indicators.ts';
import { INDICATOR_STYLE_TARGETS } from '../src/indicator-panel-module.ts';
import {
  applyKalmanAdjustedAtrTrendConfirmation,
  calculateAtr,
  calculateKalmanAdjustedAtr,
} from '../src/chart/indicators/index.ts';

const simpleChartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');
const mainIndicatorSource = fs.readFileSync(new URL('../src/chart/renderers/main-indicator-orchestrator.ts', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');
const overlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');
const paneUtilsSource = fs.readFileSync(new URL('../src/ui/workspace/pane-utils.ts', import.meta.url), 'utf8');

function candle(close, index) {
  return {
    time: index * 60,
    open: close - 0.25,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  };
}

function referencePineKalmanAtr(candles, options) {
  const processNoise = options.processNoise;
  const measurementNoise = options.measurementNoise;
  const filterOrder = options.filterOrder;
  const factor = options.factor;
  const atr = calculateAtr(candles, options.atrPeriod);
  const states = new Array(filterOrder).fill(candles[0].close);
  const errors = new Array(filterOrder).fill(1);
  const baseline = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i += 1) {
    const price = candles[i].close;
    for (let depth = 0; depth < filterOrder; depth += 1) {
      const predictedError = errors[depth] + processNoise;
      const gain = predictedError / (predictedError + measurementNoise);
      states[depth] = states[depth] + gain * (price - states[depth]);
      errors[depth] = (1 - gain) * predictedError;
    }
    const estimate = states[0];
    if (i === 0 || baseline[i - 1] == null || atr[i] == null) {
      baseline[i] = estimate;
    } else {
      const range = atr[i] * factor;
      const previous = baseline[i - 1];
      const lower = estimate - range;
      const upper = estimate + range;
      baseline[i] = lower > previous ? lower : upper < previous ? upper : previous;
    }
  }

  return baseline;
}

test('Kalman Adjusted ATR calculates a volatility-clamped baseline with trend flips', () => {
  const closes = [
    100, 101, 102, 103, 104, 105, 106, 107,
    106, 105, 104, 103, 102, 101, 100, 99,
    100, 101, 102, 103, 104, 105, 106, 107,
  ];
  const candles = closes.map(candle);

  const result = calculateKalmanAdjustedAtr(candles, {
    atrPeriod: 3,
    factor: 0.6,
    processNoise: 0.08,
    measurementNoise: 2,
    filterOrder: 3,
    maType: 'ema',
    maPeriod: 4,
  });

  assert.equal(result.baseline.length, candles.length);
  assert.equal(result.trend.length, candles.length);
  assert.equal(result.ma.length, candles.length);
  assert(result.trendUp.some(Boolean));
  assert(result.trendDown.some(Boolean));
  assert(result.ma.some((value) => value != null));

  const expected = referencePineKalmanAtr(candles, {
    atrPeriod: 3,
    factor: 0.6,
    processNoise: 0.08,
    measurementNoise: 2,
    filterOrder: 3,
  });
  for (let i = 0; i < result.baseline.length; i += 1) {
    assert.equal(result.baseline[i] == null, expected[i] == null);
    if (result.baseline[i] != null && expected[i] != null) {
      assert(Math.abs(result.baseline[i] - expected[i]) < 1e-9);
    }
  }
});

test('Kalman Adjusted ATR confirm bars filters one-bar trend noise', () => {
  const result = applyKalmanAdjustedAtrTrendConfirmation(
    [null, 10, 11, 12, 11, 12, 13, 14, 13, 12],
    2,
  );

  assert.deepEqual(result.trend, [0, 0, 0, 1, 1, 1, 1, 1, 1, -1]);
  assert.deepEqual(result.trendUp.map(Boolean), [false, false, false, true, false, false, false, false, false, false]);
  assert.deepEqual(result.trendDown.map(Boolean), [false, false, false, false, false, false, false, false, false, true]);
});

test('Kalman Adjusted ATR indicator is registered with settings and render wiring', () => {
  assert.deepEqual(
    INDICATOR_CATALOG.find((item) => item.id === 'kalmanAdjustedAtr'),
    {
      id: 'kalmanAdjustedAtr',
      label: 'Kalman Adjusted ATR',
      desc: 'Kalman price baseline clamped by ATR rails',
      panel: 'main',
    },
  );
  assert.deepEqual(
    INDICATOR_STYLE_TARGETS.kalmanAdjustedAtr.map((target) => target.key),
    ['kalmanAdjustedAtrLine', 'kalmanAdjustedAtrMa', 'kalmanAdjustedAtrTrendUp', 'kalmanAdjustedAtrTrendDown'],
  );
  assert.match(simpleChartSource, /kalmanAdjustedAtr:\s*\{\s*show:\s*false,\s*atrPeriod:\s*5,\s*factor:\s*0\.5,\s*processNoise:\s*0\.01,/);
  assert.match(simpleChartSource, /calculateKalmanAdjustedAtr/);
  assert.match(mainIndicatorSource, /renderKalmanAdjustedAtr/);
  assert.match(modalSource, /kalmanAdjustedAtr: \['atrPeriod', 'factor', 'processNoise', 'measurementNoise', 'filterOrder', 'confirmBars', 'maPeriod', 'almaSigma'\]/);
  assert.match(modalSource, /appendSelectRow\('maType'/);
  assert.match(overlaySource, /kalmanAdjustedAtr: \(\) => `KATR/);
  assert.match(paneUtilsSource, /names\.push\('KATR'\)/);
});
