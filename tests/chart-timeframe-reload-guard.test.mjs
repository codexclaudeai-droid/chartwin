import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');

test('chart live reload ignores stale timeframe reload completions', () => {
  assert.match(source, /let liveReloadGeneration = 0;/);
  assert.match(source, /const reloadGeneration = \+\+liveReloadGeneration;/);
  assert.match(source, /const reloadSymbol = chart\.config\.symbol;/);
  assert.match(source, /const reloadTimeframe = chart\.config\.timeframe;/);
  assert.match(source, /if \(reloadGeneration !== liveReloadGeneration\) return false;/);
  assert.match(source, /if \(reloadSymbol !== chart\.config\.symbol \|\| reloadTimeframe !== chart\.config\.timeframe\) return false;/);
});
