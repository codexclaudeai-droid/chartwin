import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const wrangler = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const deployWorkflow = fs.readFileSync(
  new URL('../.github/workflows/cloudflare-deploy.yml', import.meta.url),
  'utf8',
);

test('cloudflare worker publishes the data gateway url for browser live feeds', () => {
  assert.match(wrangler, /"DATA_GATEWAY_PUBLIC_URL"\s*:/);
  assert.match(wrangler, /https:\/\/gateway\.tradingcore\.co/);
  assert.doesNotMatch(wrangler, /trycloudflare\.com/);
});

test('cloudflare deployment keeps the gateway tunnel DNS record configured', () => {
  assert.match(deployWorkflow, /gateway\.tradingcore\.co/);
  assert.match(
    deployWorkflow,
    /000f9e3d-3533-4e9f-8687-7c79a26ce52a\.cfargotunnel\.com/,
  );
});
