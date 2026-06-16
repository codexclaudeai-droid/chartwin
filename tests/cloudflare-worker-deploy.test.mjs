import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const wranglerSource = fs.readFileSync(path.resolve('wrangler.jsonc'), 'utf8');
const deploymentDoc = fs.readFileSync(path.resolve('docs/cloudflare-deployment.md'), 'utf8');
const workerModule = await import(`../worker/index.js?cacheBust=${Date.now()}`);

test('Cloudflare deploy scripts target Workers instead of Pages', () => {
  assert.match(packageJson.scripts['preview:cloudflare'], /wrangler dev/);
  assert.match(packageJson.scripts['deploy:cloudflare'], /wrangler deploy/);
  assert.match(packageJson.scripts['deploy:cloudflare:prod'], /wrangler deploy/);
  assert.doesNotMatch(packageJson.scripts['preview:cloudflare'], /pages dev/);
  assert.doesNotMatch(packageJson.scripts['deploy:cloudflare'], /pages deploy/);
  assert.doesNotMatch(packageJson.scripts['deploy:cloudflare:prod'], /pages deploy/);
});

test('wrangler config defines a Worker entrypoint and static asset binding', () => {
  assert.match(wranglerSource, /"main"\s*:\s*"\.\/worker\/index\.js"/);
  assert.match(wranglerSource, /"assets"\s*:\s*\{/);
  assert.match(wranglerSource, /"binding"\s*:\s*"ASSETS"/);
  assert.doesNotMatch(wranglerSource, /pages_build_output_dir/);
});

test('deployment doc describes Workers as the primary target', () => {
  assert.match(deploymentDoc, /Cloudflare Workers as the primary deployment target/i);
  assert.match(deploymentDoc, /wrangler deploy/);
  assert.doesNotMatch(deploymentDoc, /Settings > Functions/);
});

test('Worker handles API routes without asset fallback', async () => {
  const worker = workerModule.default;
  const assetCalls = [];
  const env = {
    WEBHOOK_PASSPHRASE: 'correct-passphrase',
    CANDLES_KV: {
      async get() {
        return null;
      },
      async put() {},
    },
    ASSETS: {
      async fetch(request) {
        assetCalls.push(new URL(request.url).pathname);
        return new Response(`asset:${new URL(request.url).pathname}`);
      },
    },
  };

  const response = await worker.fetch(new Request('https://example.com/admin/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passphrase: 'wrong-passphrase' }),
  }), env);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, message: 'unauthorized' });
  assert.deepEqual(assetCalls, []);
});

test('Worker falls back to static assets for client-side routes', async () => {
  const worker = workerModule.default;
  const env = {
    ASSETS: {
      async fetch(request) {
        return new Response(`asset:${new URL(request.url).pathname}`);
      },
    },
  };

  const response = await worker.fetch(new Request('https://example.com/app/chart'), env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset:/app/chart');
});
