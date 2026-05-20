import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leftToolboxSource = fs.readFileSync(new URL('../src/ui/workspace/left-toolbox.ts', import.meta.url), 'utf8');
const mobileToolboxSource = fs.readFileSync(new URL('../src/ui/workspace/mobile-toolbox.ts', import.meta.url), 'utf8');

test('fib retracement icons keep the diagonal stroke outside both anchor loops', () => {
  assert.match(leftToolboxSource, /x1="6\.8" y1="18\.4" x2="17\.2" y2="14\.6" stroke-dasharray="4 3"/);
  assert.match(mobileToolboxSource, /x1="6\.8" y1="18\.4" x2="17\.2" y2="14\.6" stroke-dasharray="4 3"/);
  assert.doesNotMatch(leftToolboxSource, /x1="5" y1="19" x2="19" y2="14" stroke-dasharray="4 3"/);
  assert.doesNotMatch(mobileToolboxSource, /x1="5" y1="19" x2="19" y2="14" stroke-dasharray="4 3"/);
});
