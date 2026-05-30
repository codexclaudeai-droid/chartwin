import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');

test('indicator overlay keeps title, values, and hidden marker when indicators are hidden', () => {
  assert.match(indicatorOverlaySource, /const isIndicatorGloballyHidden = \(\): boolean => chart\.isIndicatorsVisible\?\.\(\) === false/);
  assert.match(indicatorOverlaySource, /const appendHiddenIndicatorMarker = \(target: HTMLElement, hidden: boolean\)/);
  assert.match(indicatorOverlaySource, /marker\.className = 'indicator-overlay-hidden-marker'/);
  assert.match(indicatorOverlaySource, /const currentlyHidden = isIndicatorGloballyHidden\(\) \|\| !isIndicatorLineVisible\(key\)/);
  assert.match(indicatorOverlaySource, /appendHiddenIndicatorMarker\(tag, currentlyHidden\)/);
  assert.match(indicatorOverlaySource, /const panelHidden = isIndicatorGloballyHidden\(\) \|\| !panelVisible/);
  assert.match(indicatorOverlaySource, /appendHiddenIndicatorMarker\(infoWrap, panelHidden\)/);
  assert.match(indicatorOverlaySource, /const valueEls = Array\.from\(tag\.querySelectorAll<HTMLElement>\('\.indicator-overlay-tag-value'\)\)/);
});
