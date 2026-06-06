import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leftToolboxSource = fs.readFileSync(new URL('../src/ui/workspace/left-toolbox.ts', import.meta.url), 'utf8');

test('chevron hover only shows the title badge without opening the submenu popup', () => {
  const handlerStart = leftToolboxSource.indexOf("chevron.addEventListener('mouseenter'");
  assert.notEqual(handlerStart, -1);
  const handlerEnd = leftToolboxSource.indexOf("      });", handlerStart);
  assert.notEqual(handlerEnd, -1);
  const mouseEnterHandler = leftToolboxSource.slice(handlerStart, handlerEnd);
  assert.doesNotMatch(mouseEnterHandler, /openToolSubmenu\(tool, btn\);/);
});

test('menu-style drawing tools no longer trigger default selection on top-level icon click', () => {
  assert.doesNotMatch(
    leftToolboxSource,
    /if \(!clickedChevron && tool\.menu && \(tool\.id === 'trend' \|\| tool\.id === 'fibonacci' \|\| tool\.id === 'forecast' \|\| tool\.id === 'patterns' \|\| tool\.id === 'draw' \|\| tool\.id === 'pointer'\)\)/,
  );
});

test('top-level title badges align to the toolbox boundary with or without submenus', () => {
  assert.match(
    leftToolboxSource,
    /const getTooltipBoundaryOffset = \(rect: DOMRect\) => \([\s\S]*currentDockCollapsedWidth - rect\.right[\s\S]*\);/,
  );
  assert.match(
    leftToolboxSource,
    /bindTooltipBadge\(btn,[\s\S]*offset: getTooltipBoundaryOffset,/,
  );
  assert.match(
    leftToolboxSource,
    /bindTooltipBadge\(chevron,[\s\S]*offset: getTooltipBoundaryOffset,/,
  );
});

test('menu button clicks open the submenu through the shared helper', () => {
  assert.match(
    leftToolboxSource,
    /if \(tool\.menu\) \{[\s\S]*openToolSubmenu\(tool, btn\);[\s\S]*return;[\s\S]*\}/,
  );
});

test('pointer submenu selections update the top-level tooltip label state', () => {
  assert.match(
    leftToolboxSource,
    /tool\.id === 'trend' \|\| tool\.id === 'fibonacci' \|\| tool\.id === 'forecast' \|\| tool\.id === 'patterns' \|\| tool\.id === 'draw' \|\| tool\.id === 'pointer'/,
  );
});
