import assert from 'node:assert/strict';
import test from 'node:test';

import { readRequiredJsonPayload } from '../app/signal/signal-admin-json.ts';

test('signal admin JSON reader reports empty server responses without JSON parser noise', async () => {
  await assert.rejects(
    readRequiredJsonPayload(new Response('', { status: 500 })),
    /HTTP 500: empty response/,
  );
});

test('signal admin JSON reader reports non-JSON server responses with status context', async () => {
  await assert.rejects(
    readRequiredJsonPayload(new Response('Internal Server Error', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })),
    /HTTP 500: Internal Server Error/,
  );
});

test('signal admin JSON reader returns parsed JSON payloads', async () => {
  const payload = await readRequiredJsonPayload(Response.json({ ok: true, selectedStrategyId: 'strategy_js_grid_martingale' }));

  assert.deepEqual(payload, { ok: true, selectedStrategyId: 'strategy_js_grid_martingale' });
});
