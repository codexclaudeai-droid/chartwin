import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSrouterBreakoutLevels } from '../src/strategy/strategies/grid-atr-bnf-srouter-levels.js';

const strategySource = fs.readFileSync(new URL('../src/strategy/strategies/grid-atr-bnf-srouter-v1.ts', import.meta.url), 'utf8');

test('AUTO mode ignores stale static breakout levels and keeps rolling bounds', () => {
  const resolved = resolveSrouterBreakoutLevels({
    presetMode: 'AUTO',
    dynamicBreakoutLevel: 27450,
    dynamicBreakdownLevel: 27180,
    staticBreakoutLevel: 15000,
    staticBreakdownLevel: 14000,
  });

  assert.deepEqual(resolved, {
    breakoutLevel: 27450,
    breakdownLevel: 27180,
  });
});

test('named preset mode also ignores stale static breakout levels', () => {
  const resolved = resolveSrouterBreakoutLevels({
    presetMode: 'NASDAQ',
    dynamicBreakoutLevel: 27450,
    dynamicBreakdownLevel: 27180,
    staticBreakoutLevel: 15000,
    staticBreakdownLevel: 14000,
  });

  assert.deepEqual(resolved, {
    breakoutLevel: 27450,
    breakdownLevel: 27180,
  });
});

test('CUSTOM mode still applies user supplied static breakout levels', () => {
  const resolved = resolveSrouterBreakoutLevels({
    presetMode: 'CUSTOM',
    dynamicBreakoutLevel: 27450,
    dynamicBreakdownLevel: 27180,
    staticBreakoutLevel: 27500,
    staticBreakdownLevel: 27050,
  });

  assert.deepEqual(resolved, {
    breakoutLevel: 27500,
    breakdownLevel: 27050,
  });
});

test('grid strategy source routes breakout resolution through the shared helper', () => {
  assert.match(strategySource, /resolveSrouterBreakoutLevels/);
});
