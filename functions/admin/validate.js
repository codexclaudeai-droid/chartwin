const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const KV_PASS_KEY = 'admin:passphrase';

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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: 'invalid json' }, { status: 400, headers: CORS });
  }

  const current = await resolveAdminPass(env);
  if (!current || String(body.passphrase || '') !== current) {
    return Response.json({ ok: false, message: 'unauthorized' }, { status: 401, headers: CORS });
  }

  return Response.json({ ok: true }, { headers: CORS });
}
