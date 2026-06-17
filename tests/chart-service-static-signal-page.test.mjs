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
      createdAt: new Date().toISOString(),
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

test('fullstack signal policy route saves global and symbol override policies', async () => {
  const previousRepository = process.env.CHART_SERVICE_REPOSITORY;
  process.env.CHART_SERVICE_REPOSITORY = 'memory';

  try {
    const {
      createSessionForUser,
      getChartServiceRepository,
      SESSION_COOKIE_NAME,
    } = await import('../src/server/chart-service/index.ts');
    const signalPolicyRoute = await import('../app/admin/signal-policy/route.ts');
    const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
    const { session } = createSessionForUser(repository, {
      userId: 'super_1',
      createdAt: new Date().toISOString(),
      ttlSeconds: 60 * 60,
    });

    const saveResponse = await signalPolicyRoute.POST(new Request('http://localhost/admin/signal-policy', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      },
      body: JSON.stringify({
        signalPolicy: {
          globalPolicy: {
            source: 'chart_strategy',
            strategyId: 'strategy_js_double_break',
            executionMode: 'advanced_order_plan',
            fillModel: 'ohlc_candle_path',
            enabled: true,
          },
          symbolPolicies: [
            {
              symbolId: 'NQ1!',
              source: 'ea_strategy',
              strategyId: 'mt5-nq-breakout',
              executionMode: 'ea_signal',
              fillModel: 'actual_fill',
              enabled: true,
            },
          ],
        },
      }),
    }));
    const savePayload = await saveResponse.json();

    const getResponse = await signalPolicyRoute.GET();
    const getPayload = await getResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savePayload.ok, true);
    assert.equal(getResponse.status, 200);
    assert.equal(getPayload.ok, true);
    assert.equal(getPayload.signalPolicy.globalPolicy.strategyId, 'strategy_js_double_break');
    assert.equal(getPayload.signalPolicy.globalPolicy.executionMode, 'advanced_order_plan');
    assert.equal(getPayload.signalPolicy.symbolPolicies[0].symbolId, 'NQ1!');
    assert.equal(getPayload.signalPolicy.symbolPolicies[0].source, 'ea_strategy');
  } finally {
    if (previousRepository == null) delete process.env.CHART_SERVICE_REPOSITORY;
    else process.env.CHART_SERVICE_REPOSITORY = previousRepository;
  }
});

test('fullstack strategy parameter route saves global and symbol parameter profiles', async () => {
  const previousRepository = process.env.CHART_SERVICE_REPOSITORY;
  process.env.CHART_SERVICE_REPOSITORY = 'memory';

  try {
    const {
      createSessionForUser,
      getChartServiceRepository,
      SESSION_COOKIE_NAME,
    } = await import('../src/server/chart-service/index.ts');
    const strategyParamsRoute = await import('../app/admin/strategy-params/route.ts');
    const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
    const { session } = createSessionForUser(repository, {
      userId: 'admin_1',
      createdAt: new Date().toISOString(),
      ttlSeconds: 60 * 60,
    });

    const saveResponse = await strategyParamsRoute.POST(new Request('http://localhost/admin/strategy-params', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
      },
      body: JSON.stringify({
        strategyParams: {
          profiles: [
            {
              strategyId: 'strategy_js_grid_martingale',
              params: { gridStep: 120, takeProfitSteps: 2.2 },
            },
            {
              strategyId: 'strategy_js_grid_martingale',
              symbolId: 'nq1!',
              params: { gridStep: 40 },
            },
          ],
        },
      }),
    }));
    const savePayload = await saveResponse.json();

    const getResponse = await strategyParamsRoute.GET();
    const getPayload = await getResponse.json();

    assert.equal(saveResponse.status, 200);
    assert.equal(savePayload.ok, true);
    assert.equal(getResponse.status, 200);
    assert.equal(getPayload.ok, true);
    assert.equal(getPayload.strategyParams.profiles.length, 2);
    assert.equal(getPayload.strategyParams.profiles[1].symbolId, 'NQ1!');
    assert.equal(getPayload.strategyParams.profiles[1].params.gridStep, 40);
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
      createdAt: new Date().toISOString(),
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

test('dev strategy modal exposes server parameter profile sync controls', () => {
  const source = fs.readFileSync(new URL('../src/ui/modal-handlers.ts', import.meta.url), 'utf8');

  assert.match(source, /\/admin\/strategy-params/);
  assert.match(source, /saveActiveStrategyParamsToServer/);
  assert.match(source, /loadActiveStrategyParamsFromServer/);
  assert.match(source, /saveSymbolParamBtn/);
});

test('dev page exposes visible strategy parameter server panel', () => {
  const page = fs.readFileSync(new URL('../app/dev/page.tsx', import.meta.url), 'utf8');
  const panel = fs.readFileSync(new URL('../app/dev/strategy-params-panel.tsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(page, /DevStrategyParamsPanel/);
  assert.match(panel, /STRATEGY DEV/);
  assert.match(panel, /\/admin\/strategy-params/);
  assert.match(panel, /server-strategy-params-updated/);
  assert.match(panel, /strategy-param-scope/);
  assert.match(css, /\.dev-strategy-params-panel/);
});

test('chart runtime auto-applies server strategy parameter profiles', () => {
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  const chartSource = fs.readFileSync(new URL('../src/chart/SimpleChart.ts', import.meta.url), 'utf8');

  assert.match(initSource, /\/admin\/strategy-params/);
  assert.match(initSource, /signalPolicy/);
  assert.match(initSource, /resolveAdminSignalPolicyForSymbol/);
  assert.match(initSource, /signalPolicy\.source === 'chart_strategy'/);
  assert.match(initSource, /resolveServerStrategyParams/);
  assert.match(initSource, /applyServerStrategyParamsToChart/);
  assert.match(initSource, /server-strategy-params-updated/);
  assert.match(chartSource, /setStrategyParamOverrides/);
  assert.match(chartSource, /strategyParamOverrides/);
  assert.match(chartSource, /strategyParams: this\.getStrategyParams\(strategy\.id\)/);
  assert.match(chartSource, /__strategyParams: this\.getStrategyParams\(strategy\.id\)/);
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
  assert.match(schema, /jsonb_typeof\(hidden_symbols_json\) <> 'array'/);
  assert.match(schema, /jsonb_typeof\(disabled_symbols_json\) <> 'array'/);
  assert.match(schema, /jsonb_typeof\(hidden_strategy_ids_json\) <> 'array'/);
  assert.match(schema, /selected_strategy_id text/);
  assert.match(schema, /global_signal_policy_json jsonb/);
  assert.match(schema, /symbol_signal_policies_json jsonb/);
  assert.match(schema, /strategy_param_profiles_json jsonb/);
});

test('signal admin postgres mapper tolerates legacy empty json objects for array fields', async () => {
  const { mapSignalAdminSettingsFromPostgresRow } = await import('../src/server/chart-service/postgres-mappers.ts');

  const record = mapSignalAdminSettingsFromPostgresRow({
    id: 'default',
    hidden_symbols_json: {},
    disabled_symbols_json: {},
    hidden_strategy_ids_json: {},
    global_signal_policy_json: {},
    symbol_signal_policies_json: {},
    strategy_param_profiles_json: {},
    strategy_mgmt_visible: false,
    selected_strategy_id: 'strategy_js_grid_martingale',
    updated_at: '2026-06-15T00:00:00.000Z',
  });

  assert.deepEqual(record.hiddenSymbols, []);
  assert.deepEqual(record.disabledSymbols, []);
  assert.deepEqual(record.hiddenStrategyIds, []);
  assert.equal(record.signalPolicy.globalPolicy.source, 'chart_strategy');
  assert.deepEqual(record.signalPolicy.symbolPolicies, []);
  assert.deepEqual(record.strategyParams.profiles, []);
});
