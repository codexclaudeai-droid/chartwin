import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
const paneChromeSource = fs.readFileSync(new URL('../src/ui/workspace/pane-chrome.ts', import.meta.url), 'utf8');

test('mobile chart header keeps market price directly beside the symbol', () => {
  assert.match(
    initSource,
    /if \(isMobile\) \{[\s\S]*?paneHeader\.insertBefore\(marketPriceWrap, symBtn\.nextSibling\);[\s\S]*?return;[\s\S]*?\}/,
  );
});

test('mobile chart header keeps price visible above main indicator labels', () => {
  assert.match(
    initSource,
    /const hideMarketPriceOnDenseMobileSplit = false;/,
  );
});

test('mobile chart market price uses compact inline sizing', () => {
  assert.match(
    paneChromeSource,
    /if \(isMobilePhone\) \{[\s\S]*?marketPriceWrap\.style\.width = 'auto';[\s\S]*?marketPriceWrap\.style\.maxWidth = '132px';[\s\S]*?symChangeMetaLabel\.style\.display = 'none';/,
  );
});
