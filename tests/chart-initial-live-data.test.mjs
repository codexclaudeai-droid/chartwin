import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

test('chart panes start empty instead of rendering dummy candles before live data arrives', () => {
  assert.match(source, /let rawCandles: CandleData\[\] = \[\];/);
  assert.doesNotMatch(source, /let rawCandles = generateDummyData\(300, chart\.config\.timeframe\);/);

  const initialSetup = source.slice(
    source.indexOf('chart.setPatternAlertEnabled(patternAlertEnabled);'),
    source.indexOf("window.addEventListener('chart-drawings-changed'"),
  );
  assert.doesNotMatch(initialSetup, /applyDisplayCurrencyToChart\(\);/);
  assert.doesNotMatch(initialSetup, /restoreCurrentChartDrawings\(\);/);
  assert.match(source, /restoreInitialDrawingsAfterLiveData/);
});
