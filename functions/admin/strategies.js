const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const KV_HIDDEN = 'admin:hidden-strategy-ids';
const KV_PASS_KEY = 'admin:passphrase';
const DEFAULT_SELECTED_STRATEGY_ID = 'strategy_js_grid_martingale';

async function resolveAdminPass(env) {
  try {
    const kv = await env.CANDLES_KV.get(KV_PASS_KEY);
    return kv || env.WEBHOOK_PASSPHRASE || '';
  } catch {
    return env.WEBHOOK_PASSPHRASE || '';
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  let hidden = [];
  let mgmtVisible = true;
  let selectedStrategyId = DEFAULT_SELECTED_STRATEGY_ID;
  try {
    const stored = await env.CANDLES_KV.get(KV_HIDDEN, { type: 'json' });
    if (Array.isArray(stored)) {
      hidden = stored;
    } else if (stored && typeof stored === 'object') {
      if (Array.isArray(stored.hidden)) hidden = stored.hidden.filter((s) => typeof s === 'string');
      if (typeof stored.mgmtVisible === 'boolean') mgmtVisible = stored.mgmtVisible;
      if (typeof stored.selectedStrategyId === 'string' && stored.selectedStrategyId.trim()) {
        selectedStrategyId = stored.selectedStrategyId.trim();
      }
    }
  } catch {}
  return Response.json({ ok: true, hidden, mgmtVisible, selectedStrategyId }, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, message: 'invalid json' }, { status: 400, headers: CORS }); }

  const expected = await resolveAdminPass(env);
  if (!expected || String(body.passphrase || '') !== expected) {
    return Response.json({ ok: false, message: 'unauthorized' }, { status: 401, headers: CORS });
  }

  const hidden = Array.isArray(body.hidden)
    ? body.hidden.filter(s => typeof s === 'string' && s.length > 0)
    : [];
  const mgmtVisible = typeof body.mgmtVisible === 'boolean' ? body.mgmtVisible : true;
  const selectedStrategyId = typeof body.selectedStrategyId === 'string' && body.selectedStrategyId.trim()
    ? body.selectedStrategyId.trim()
    : DEFAULT_SELECTED_STRATEGY_ID;
  try {
    await env.CANDLES_KV.put(KV_HIDDEN, JSON.stringify({
      hidden,
      mgmtVisible,
      selectedStrategyId,
    }));
    return Response.json({ ok: true, hidden, mgmtVisible, selectedStrategyId }, { headers: CORS });
  } catch (error) {
    return Response.json({
      ok: false,
      message: error instanceof Error ? error.message : 'save failed',
    }, { status: 500, headers: CORS });
  }
}
