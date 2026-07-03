import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const wrangler = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

test('cloudflare worker publishes the data gateway url for browser live feeds', () => {
  assert.match(wrangler, /"DATA_GATEWAY_PUBLIC_URL"\s*:/);
  assert.match(wrangler, /https:\/\/gateway\.tradingcore\.co/);
  assert.doesNotMatch(wrangler, /trycloudflare\.com/);
});
