import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createMockChartServiceRepository,
  createSessionForUser,
  getChartServiceRepository,
  SESSION_COOKIE_NAME,
} from '../src/server/chart-service/index.ts';

test('chart settings API saves and restores authenticated user preferences', async () => {
  const repository = getChartServiceRepository({ CHART_SERVICE_REPOSITORY: 'memory' });
  const { session } = createSessionForUser(repository, {
    userId: 'user_subscriber',
    createdAt: '2026-05-30T09:00:00.000Z',
    ttlSeconds: 60 * 60 * 24 * 365,
  });
  const { GET, PATCH } = await import('../app/api/chart/settings/route.ts');
  const cookie = `${SESSION_COOKIE_NAME}=${session.id}`;

  const patchResponse = await PATCH(new Request('http://localhost/api/chart/settings', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      settings: {
        version: 1,
        localStorage: {
          'my-chart-lib.last-symbol.v1': 'ETHUSDT',
          'my-chart-lib.last-timeframe.v1': '4h',
        },
        chartConfig: {
          layout: { marketInfoSide: 'left', rightGapBars: 12 },
          candleStyle: { upColor: '#00ffaa', downColor: '#ff5577' },
        },
      },
    }),
  }));
  const patchPayload = await patchResponse.json();
  const getResponse = await GET(new Request('http://localhost/api/chart/settings', {
    headers: { cookie },
  }));
  const getPayload = await getResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.ok, true);
  assert.equal(patchPayload.settings.localStorage['my-chart-lib.last-symbol.v1'], 'ETHUSDT');
  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.settings.chartConfig.layout.marketInfoSide, 'left');
  assert.equal(getPayload.settings.chartConfig.candleStyle.downColor, '#ff5577');
});

test('chart settings repository contract persists JSON preferences', async () => {
  const repository = createMockChartServiceRepository();

  assert.equal(repository.getChartUserSettings('user_subscriber'), null);

  repository.saveChartUserSettings({
    userId: 'user_subscriber',
    settings: {
      version: 1,
      chartConfig: { layout: { rightGapBars: 16 } },
    },
    updatedAt: '2026-05-30T09:10:00.000Z',
  });

  const saved = repository.getChartUserSettings('user_subscriber');
  assert.equal(saved?.userId, 'user_subscriber');
  assert.equal(saved?.settings.chartConfig.layout.rightGapBars, 16);
  assert.equal(saved?.updatedAt, '2026-05-30T09:10:00.000Z');
});

test('postgres repository and schema include chart user settings persistence', async () => {
  const { createPostgresAsyncChartServiceRepository, renderChartServicePostgresSchema } = await import('../src/server/chart-service/index.ts');
  const calls = [];
  const executor = {
    async query(statement) {
      calls.push(statement);
      if (statement.sql === 'select * from chart_user_settings where user_id = $1') {
        return {
          rows: [{
            user_id: 'user_subscriber',
            settings_json: { version: 1, chartConfig: { layout: { rightGapBars: 20 } } },
            updated_at: '2026-05-30T09:20:00.000Z',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const repository = createPostgresAsyncChartServiceRepository(executor);
  const schema = renderChartServicePostgresSchema();

  const settings = await repository.getChartUserSettings('user_subscriber');
  await repository.saveChartUserSettings({
    userId: 'user_subscriber',
    settings: { version: 1, localStorage: { 'my-chart-lib.last-timeframe.v1': '1d' } },
    updatedAt: '2026-05-30T09:21:00.000Z',
  });

  assert.match(schema, /create table if not exists chart_user_settings/);
  assert.match(schema, /settings_json jsonb/);
  assert.equal(settings?.settings.chartConfig.layout.rightGapBars, 20);
  assert.equal(calls[0].sql, 'select * from chart_user_settings where user_id = $1');
  assert.deepEqual(calls[0].values, ['user_subscriber']);
  assert.match(calls[1].sql, /^insert into chart_user_settings /);
  assert.match(calls[1].sql, /on conflict \(user_id\) do update/);
});

test('chart runtime hydrates and syncs account chart settings', () => {
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../app/api/chart/settings/route.ts', import.meta.url), 'utf8');

  assert.match(initSource, /CHART_USER_SETTINGS_ENDPOINT = '\/api\/chart\/settings'/);
  assert.match(initSource, /await hydrateChartUserSettings\(\)/);
  assert.match(initSource, /scheduleChartUserSettingsSync/);
  assert.match(initSource, /applySavedChartConfig\(chart\)/);
  assert.match(initSource, /captureChartUserSettingsSnapshot/);
  assert.match(routeSource, /export async function GET/);
  assert.match(routeSource, /export async function PATCH/);
  assert.match(routeSource, /getActorFromAsyncRequest/);
});

test('chart runtime persists indicator configuration and visibility state', () => {
  const initSource = fs.readFileSync(new URL('../src/app/init.ts', import.meta.url), 'utf8');
  const chartUserSettingsSource = fs.readFileSync(new URL('../src/app/chart-user-settings.ts', import.meta.url), 'utf8');

  assert.match(chartUserSettingsSource, /indicatorsVisible\?: boolean/);
  assert.match(initSource, /indicators: cloneJsonRecord\(chart\.config\.indicators\)/);
  assert.match(initSource, /panelState: cloneJsonRecord\(chart\.config\.panelState\)/);
  assert.match(initSource, /indicatorsVisible: chart\.isIndicatorsVisible\(\)/);
  assert.match(initSource, /chart\.setIndicatorsVisible\(saved\.indicatorsVisible\)/);
  assert.match(initSource, /rawToolId === 'hide-indicators'[\s\S]*persistChartUserSettingsForChart\(pane\.chart\)/);
  assert.match(initSource, /rawToolId === 'hide-all'[\s\S]*persistChartUserSettingsForChart\(pane\.chart\)/);
});
