import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indicatorOverlaySource = fs.readFileSync(new URL('../src/ui/indicator-overlay.ts', import.meta.url), 'utf8');

test('indicator overlay shows only the existing hide action beside hidden indicator values', () => {
  assert.match(indicatorOverlaySource, /const isIndicatorGloballyHidden = \(\): boolean => chart\.isIndicatorsVisible\?\.\(\) === false/);
  assert.doesNotMatch(indicatorOverlaySource, /appendHiddenIndicatorIcon/);
  assert.doesNotMatch(indicatorOverlaySource, /indicator-overlay-hidden-icon/);
  assert.doesNotMatch(indicatorOverlaySource, /indicator-overlay-hidden-marker/);
  assert.match(indicatorOverlaySource, /const eyeIconSvg = \(visible: boolean\): string => \(\s*visible \? eyeOnSvg\(actionIconSz\) : eyeOffSvg\(actionIconSz\)\s*\)/);
  assert.match(indicatorOverlaySource, /const currentlyHidden = isIndicatorGloballyHidden\(\) \|\| !isIndicatorLineVisible\(key\)/);
  assert.match(indicatorOverlaySource, /const setTagActionsExpanded = \(expanded: boolean\) => \{/);
  assert.match(indicatorOverlaySource, /actions\.style\.display = expanded \|\| currentlyHidden \? 'inline-flex' : 'none'/);
  assert.match(indicatorOverlaySource, /settingsBtn\.style\.display = expanded \? 'inline-flex' : 'none'/);
  assert.match(indicatorOverlaySource, /trashBtn\.style\.display = expanded \? 'inline-flex' : 'none'/);
  assert.match(indicatorOverlaySource, /const panelHidden = isIndicatorGloballyHidden\(\) \|\| !panelVisible/);
  assert.match(indicatorOverlaySource, /const setHeaderActionsExpanded = \(expanded: boolean\) => \{/);
  assert.match(indicatorOverlaySource, /actionWrap\.style\.display = expanded \|\| panelHidden \? 'flex' : 'none'/);
  assert.match(indicatorOverlaySource, /settingBtn\.style\.display = expanded \? 'flex' : 'none'/);
  assert.match(indicatorOverlaySource, /trashBtn\.style\.display = expanded \? 'flex' : 'none'/);
  assert.match(indicatorOverlaySource, /const hideBtn = makeTagActionButton\(/);
  assert.match(indicatorOverlaySource, /kind: 'eye' \| 'eyeOff'/);
  assert.match(indicatorOverlaySource, /eyeOff: `<svg width="20" height="20"[\s\S]*?<line x1="4" y1="20" x2="20" y2="4"><\/line><\/svg>`/);
  assert.match(indicatorOverlaySource, /const eyeBtn = iconBtn\(iconSvg\(panelVisible \? 'eye' : 'eyeOff'\)/);
  assert.match(indicatorOverlaySource, /const valueEls = Array\.from\(tag\.querySelectorAll<HTMLElement>\('\.indicator-overlay-tag-value'\)\)/);
});
