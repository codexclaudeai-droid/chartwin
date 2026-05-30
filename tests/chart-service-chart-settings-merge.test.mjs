import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeJsonRecords, mergeStoredChartConfig, normalizeStoredChartConfig } from '../src/app/chart-user-settings.ts';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

test('chart setting merge preserves nested indicator values and future numeric fields', () => {
  const base = {
    version: 1,
    indicators: {
      rsi: {
        show: false,
        period: 14,
        thresholds: { top: 70, bottom: 30 },
      },
      customFutureIndicator: {
        show: false,
        params: { alpha: 1, nested: { keep: 11 } },
      },
    },
    panelState: {
      lineStyles: {
        rsi: { color: '#ffeb3b', width: 1.5, dash: [] },
      },
      lineVisibility: { rsi: true },
    },
  };
  const saved = normalizeStoredChartConfig({
    indicators: {
      rsi: {
        show: true,
        period: 21,
        thresholds: { middle: 50 },
      },
      customFutureIndicator: {
        params: { nested: { saved: 22 } },
      },
    },
    panelState: {
      lineStyles: {
        rsi: { width: 2.5 },
      },
    },
  });

  const merged = mergeStoredChartConfig(base, saved);

  assert.deepEqual(merged.indicators?.rsi, {
    show: true,
    period: 21,
    thresholds: { top: 70, bottom: 30, middle: 50 },
  });
  assert.deepEqual(merged.indicators?.customFutureIndicator, {
    show: false,
    params: { alpha: 1, nested: { keep: 11, saved: 22 } },
  });
  assert.deepEqual(merged.panelState?.lineStyles, {
    rsi: { color: '#ffeb3b', width: 2.5, dash: [] },
  });
  assert.deepEqual(merged.panelState?.lineVisibility, { rsi: true });
});

test('json record merge replaces arrays such as MA line lists instead of merging by index', () => {
  const merged = mergeJsonRecords(
    { ma: { show: true, nextId: 5, lines: [{ id: 'ma1', period: 5 }, { id: 'ma2', period: 20 }] } },
    { ma: { lines: [{ id: 'ma7', period: 77 }] } },
  );

  assert.deepEqual(merged.ma, {
    show: true,
    nextId: 5,
    lines: [{ id: 'ma7', period: 77 }],
  });
});

test('overlay indicator edits trigger account chart setting persistence', () => {
  assert.match(
    initSource,
    /createIndicatorOverlay\(chartArea, chart, \(\) => \{\s*refreshChartUi\(\);\s*persistChartUserSettingsForChart\(chart\);\s*\}\)/,
  );
});
