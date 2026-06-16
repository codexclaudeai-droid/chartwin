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

test('wrangler config preserves the existing chartwin Worker routes and bindings', () => {
  assert.match(wranglerSource, /"compatibility_flags"\s*:\s*\[\s*"nodejs_compat"\s*\]/);
  assert.match(wranglerSource, /"workers_dev"\s*:\s*true/);
  assert.match(wranglerSource, /"pattern"\s*:\s*"www\.tradingcore\.co"/);
  assert.match(wranglerSource, /"pattern"\s*:\s*"dev\.tradingcore\.co"/);
  assert.match(wranglerSource, /"pattern"\s*:\s*"tradingcore\.co"/);
  assert.match(wranglerSource, /"binding"\s*:\s*"HYPERDRIVE"/);
  assert.match(wranglerSource, /"name"\s*:\s*"EMAIL"/);
  assert.match(wranglerSource, /"crons"\s*:\s*\[\s*"\* \* \* \* \*"\s*\]/);
  assert.match(wranglerSource, /"DATA_GATEWAY_URL"\s*:\s*"https:\/\/minority-iowa-retrieve-contest\.trycloudflare\.com"/);
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

test('Worker proxies candle reads to the configured data gateway', async () => {
  const worker = workerModule.default;
  const assetCalls = [];
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    fetchCalls.push({
      url: request.url,
      method: request.method,
    });
    return new Response(JSON.stringify({ ok: true, source: 'gateway', candles: [{ time: 1, close: 2 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = await worker.fetch(
      new Request('https://example.com/candles?market=index&symbol=NQ1!&timeframe=1m&limit=5'),
      {
        DATA_GATEWAY_URL: 'https://gateway.example',
        ASSETS: {
          async fetch(request) {
            assetCalls.push(new URL(request.url).pathname);
            return new Response(`asset:${new URL(request.url).pathname}`);
          },
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, source: 'gateway', candles: [{ time: 1, close: 2 }] });
    assert.deepEqual(fetchCalls, [{
      url: 'https://gateway.example/candles?market=index&symbol=NQ1!&timeframe=1m&limit=5',
      method: 'GET',
    }]);
    assert.deepEqual(assetCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Worker proxies MT45 ingest requests to the configured data gateway with method, headers, and body intact', async () => {
  const worker = workerModule.default;
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    fetchCalls.push({
      url: request.url,
      method: request.method,
      apiKey: request.headers.get('x-mt45-api-key'),
      body: await request.text(),
    });
    return new Response(JSON.stringify({ ok: true, accepted: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = await worker.fetch(
      new Request('https://example.com/ingest/mt45/tick', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mt45-api-key': 'mt45-secret',
        },
        body: JSON.stringify({ symbol: 'NQ1!', close: 30520.25 }),
      }),
      {
        DATA_GATEWAY_URL: 'https://gateway.example/base/',
        ASSETS: {
          async fetch() {
            return new Response('asset');
          },
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, accepted: 1 });
    assert.deepEqual(fetchCalls, [{
      url: 'https://gateway.example/base/ingest/mt45/tick',
      method: 'POST',
      apiKey: 'mt45-secret',
      body: '{"symbol":"NQ1!","close":30520.25}',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
