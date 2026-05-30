import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const publicDir = new URL('../public/', import.meta.url);

test('signal settings page is owned by the fullstack app route', () => {
  assert.equal(fs.existsSync(new URL('admin.html', publicDir)), false);
  assert.equal(fs.existsSync(new URL('signal.html', publicDir)), false);
  assert.equal(fs.existsSync(new URL('../app/signal/page.tsx', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url)), true);
});

test('fullstack signal admin routes save strategy settings as JSON', async () => {
  const previousRepository = process.env.CHART_SERVICE_REPOSITORY;
  process.env.CHART_SERVICE_REPOSITORY = 'memory';

  try {
    const {
      createSessionForUser,
      getChartServiceRepository,
      SESSION_COOKIE_NAME,
    } = await import('../src/server/chart-service/index.ts');
    const strategiesRoute = await import('../app/admin/strategies/route.ts');
    const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
    const { session } = createSessionForUser(repository, {
      userId: 'super_1',
      createdAt: '2026-05-31T00:00:00.000Z',
      ttlSeconds: 60 * 60,
    });

    const saveResponse = await strategiesRoute.POST(new Request('http://localhost/admin/strategies', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      },
      body: JSON.stringify({
        hidden: ['strategy_js_sma_9_21'],
        mgmtVisible: true,
        selectedStrategyId: 'strategy_js_grid_martingale',
      }),
    }));
    const savePayload = await saveResponse.json();

    const getResponse = await strategiesRoute.GET();
    const getPayload = await getResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savePayload.ok, true);
    assert.equal(getResponse.status, 200);
    assert.equal(getPayload.ok, true);
    assert.deepEqual(getPayload.hidden, ['strategy_js_sma_9_21']);
    assert.equal(getPayload.mgmtVisible, true);
    assert.equal(getPayload.selectedStrategyId, 'strategy_js_grid_martingale');
  } finally {
    if (previousRepository == null) delete process.env.CHART_SERVICE_REPOSITORY;
    else process.env.CHART_SERVICE_REPOSITORY = previousRepository;
  }
});

test('signal admin mutations reject non-super-admin sessions', async () => {
  const previousRepository = process.env.CHART_SERVICE_REPOSITORY;
  process.env.CHART_SERVICE_REPOSITORY = 'memory';

  try {
    const {
      createSessionForUser,
      getChartServiceRepository,
      SESSION_COOKIE_NAME,
    } = await import('../src/server/chart-service/index.ts');
    const symbolsRoute = await import('../app/admin/symbols/route.ts');
    const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
    const { session } = createSessionForUser(repository, {
      userId: 'admin_1',
      createdAt: '2026-05-31T00:00:00.000Z',
      ttlSeconds: 60 * 60,
    });

    const response = await symbolsRoute.POST(new Request('http://localhost/admin/symbols', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      },
      body: JSON.stringify({ hidden: ['NQ1!'], disabled: [] }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.match(payload.message, /Super admin role required/);
  } finally {
    if (previousRepository == null) delete process.env.CHART_SERVICE_REPOSITORY;
    else process.env.CHART_SERVICE_REPOSITORY = previousRepository;
  }
});

test('signal admin page no longer depends on passphrase entry', () => {
  const page = fs.readFileSync(new URL('../app/signal/signal-admin-panel.tsx', import.meta.url), 'utf8');
  const helper = fs.readFileSync(new URL('../app/admin/signal-admin-settings.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(page, /passphrase/i);
  assert.doesNotMatch(page, /newPassphrase/);
  assert.doesNotMatch(helper, /CHART_SERVICE_SIGNAL_ADMIN_PASSPHRASE/);
});

test('signal app page enforces super admin access before rendering panel', () => {
  const page = fs.readFileSync(new URL('../app/signal/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /getActorFromAsyncRequest/);
  assert.match(page, /assertSuperAdminActor/);
  assert.match(page, /redirect\('\/login\?redirect=\/signal'\)/);
  assert.match(page, /SignalAdminPanel/);
});

test('postgres schema includes global signal admin settings persistence', async () => {
  const { renderChartServicePostgresSchema } = await import('../src/server/chart-service/index.ts');
  const schema = renderChartServicePostgresSchema();

  assert.match(schema, /create table if not exists signal_admin_settings/);
  assert.match(schema, /hidden_strategy_ids_json jsonb/);
  assert.match(schema, /selected_strategy_id text/);
});
