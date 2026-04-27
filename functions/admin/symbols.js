const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const KV_KEY = 'admin:hidden-symbols';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  let hidden = [];
  try {
    const raw = await env.CANDLES_KV.get(KV_KEY, { type: 'json' });
    if (Array.isArray(raw)) hidden = raw;
  } catch {}
  return Response.json({ ok: true, hidden }, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, message: 'invalid json' }, { status: 400, headers: CORS }); }

  const expected = env.WEBHOOK_PASSPHRASE || '';
  if (!expected || String(body.passphrase || '') !== expected) {
    return Response.json({ ok: false, message: 'unauthorized' }, { status: 401, headers: CORS });
  }

  const hidden = Array.isArray(body.hidden)
    ? body.hidden.filter(s => typeof s === 'string').map(s => String(s).trim().toUpperCase())
    : [];
  await env.CANDLES_KV.put(KV_KEY, JSON.stringify(hidden));
  return Response.json({ ok: true, hidden }, { headers: CORS });
}
