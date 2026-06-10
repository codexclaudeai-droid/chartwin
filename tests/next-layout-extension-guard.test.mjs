import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Next layout guard records and suppresses opaque wallet extension rejections', () => {
  const source = readFileSync('app/layout.tsx', 'utf8');

  assert.match(source, /__tcIgnoredExternalErrors/);
  assert.match(source, /Object\.getOwnPropertyNames/);
  assert.match(source, /isOpaqueWalletObjectRejection/);
  assert.match(source, /__tcWalletExtensionSeen/);
  assert.match(source, /dismissExternalObjectDevOverlay/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /Cannot redefine property: ethereum/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
});

test('Next layout installs the external-error guard with beforeInteractive strategy', () => {
  const source = readFileSync('app/layout.tsx', 'utf8');

  assert.match(source, /import Script from 'next\/script';/);
  assert.match(source, /id="tc-extension-error-guard"/);
  assert.match(source, /strategy="beforeInteractive"/);
  assert.doesNotMatch(
    source,
    /<script dangerouslySetInnerHTML=\{\{ __html: ethereumExtensionErrorGuardScript \}\} \/>/,
  );
});
