const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const KV_HIDDEN   = 'admin:hidden-symbols';
const KV_DISABLED = 'admin:disabled-symbols';
const KV_PASS_KEY = 'admin:passphrase';

async function resolveAdminPass(env) {
  try {
    const kv = await env.CANDLES_KV.get(KV_PASS_KEY);
    return kv || env.WEBHOOK_PASSPHRASE || '';
  } catch {
    return env.WEBHOOK_PASSPHRASE || '';
  }
}

function toUpperList(raw) {
  return Array.isArray(raw) ? raw.filter(s => typeof s === 'string').map(s => s.trim().toUpperCase()) : [];
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  let hidden = [], disabled = [];
  try {
    const [h, d] = await Promise.all([
      env.CANDLES_KV.get(KV_HIDDEN,   { type: 'json' }),
      env.CANDLES_KV.get(KV_DISABLED, { type: 'json' }),
    ]);
    if (Array.isArray(h)) hidden   = h;
    if (Array.isArray(d)) disabled = d;
  } catch {}
  return Response.json({ ok: true, hidden, disabled }, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, message: 'invalid json' }, { status: 400, headers: CORS }); }

  const expected = await resolveAdminPass(env);
  if (!expected || String(body.passphrase || '') !== expected) {
    return Response.json({ ok: false, message: 'unauthorized' }, { status: 401, headers: CORS });
  }

  const hidden   = toUpperList(body.hidden);
  const disabled = toUpperList(body.disabled);

  try {
    const nextHiddenRaw = JSON.stringify(hidden);
    const nextDisabledRaw = JSON.stringify(disabled);
    const [currentHiddenRaw, currentDisabledRaw] = await Promise.all([
      env.CANDLES_KV.get(KV_HIDDEN),
      env.CANDLES_KV.get(KV_DISABLED),
    ]);

    const writes = [];
    if (currentHiddenRaw !== nextHiddenRaw) {
      writes.push(env.CANDLES_KV.put(KV_HIDDEN, nextHiddenRaw));
    }
    if (currentDisabledRaw !== nextDisabledRaw) {
      writes.push(env.CANDLES_KV.put(KV_DISABLED, nextDisabledRaw));
    }
    if (writes.length) await Promise.all(writes);
    return Response.json({ ok: true, hidden, disabled, skippedWrite: writes.length === 0 }, { headers: CORS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save failed';
    return Response.json({
      ok: false,
      message: message.includes('limit exceeded for the day')
        ? 'Cloudflare KV daily write limit exceeded. Please wait until the quota resets or upgrade the KV plan.'
        : message,
    }, { status: 500, headers: CORS });
  }
}
