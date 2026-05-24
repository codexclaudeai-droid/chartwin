import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('vite multi-page inputs use file URL absolute paths for Windows-safe builds', () => {
  const source = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

  assert.match(source, /fileURLToPath/);
  assert.match(source, /new URL\('\.\/index\.html', import\.meta\.url\)/);
  assert.match(source, /new URL\('\.\/dev\.html', import\.meta\.url\)/);
  assert.doesNotMatch(source, /main:\s*'index\.html'/);
  assert.doesNotMatch(source, /dev:\s*'dev\.html'/);
});
