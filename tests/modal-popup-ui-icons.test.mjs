import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');

test('symbol and indicator popups use svg icons and minimal scrollbars', () => {
  assert.match(source, /const modalCloseSvgIcon = `/);
  assert.match(source, /const checkSvgIcon = `/);
  assert.match(source, /const chevronUpSvgIcon = `/);
  assert.match(source, /const chevronDownSvgIcon = `/);

  assert.match(source, /xBtn\.innerHTML = modalCloseSvgIcon/);
  assert.match(source, /xb\.innerHTML = modalCloseSvgIcon/);
  assert.match(source, /check\.innerHTML = checkSvgIcon/);
  assert.doesNotMatch(source, /check\.textContent = '\?'/);

  assert.match(source, /up\.innerHTML = chevronUpSvgIcon/);
  assert.match(source, /down\.innerHTML = chevronDownSvgIcon/);
  assert.doesNotMatch(source, /up\.textContent = '↑'/);
  assert.doesNotMatch(source, /down\.textContent = '↓'/);

  assert.match(source, /symbol-list-scroll::-webkit-scrollbar,[\s\S]*indicator-list-scroll::-webkit-scrollbar \{ width: 3px; height: 3px; \}/);
  assert.match(source, /\.ind-popup::-webkit-scrollbar \{ width: 2px; height: 2px; \}/);
});
