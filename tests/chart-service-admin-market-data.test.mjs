import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ADMIN_DASHBOARD_SECTIONS,
  getAdminDashboardSectionFromLocation,
} from '../app/admin/admin-dashboard-sections.ts';

test('admin dashboard includes market data section for MT45 collector controls', () => {
  const section = ADMIN_DASHBOARD_SECTIONS.find((item) => item.key === 'marketData');
  assert.ok(section);
  assert.equal(section.href, '#admin-market-data');
  assert.match(section.description, /MT4\/5|tick|OHLCV/i);

  assert.equal(getAdminDashboardSectionFromLocation('#admin-market-data'), 'marketData');
});

test('admin market data route proxies settings without exposing gateway admin token to client source', async () => {
  const routeSource = await readFile(new URL('../app/api/admin/market-data/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /DATA_GATEWAY_URL/);
  assert.match(routeSource, /DATA_GATEWAY_PUBLIC_URL/);
  assert.match(routeSource, /DATA_GATEWAY_ADMIN_TOKEN/);
  assert.match(routeSource, /x-admin-token/);
  assert.match(routeSource, /data gateway unauthorized: check DATA_GATEWAY_ADMIN_TOKEN/);
  assert.match(routeSource, /assertSuperAdminActor/);
  assert.doesNotMatch(routeSource, /assertAdminActor/);

  const panelSource = await readFile(new URL('../app/admin/admin-market-data-panel.tsx', import.meta.url), 'utf8');
  assert.match(panelSource, /Tick DB 저장/);
  assert.match(panelSource, /type Mt45Platform = 'mt4' \| 'mt5'/);
  assert.match(panelSource, /type Mt45SymbolRule/);
  assert.match(panelSource, /DEFAULT_SYMBOLS/);
  assert.match(panelSource, /activePlatform: 'mt5'/);
  assert.match(panelSource, /type Mt45ProfileSettings/);
  assert.match(panelSource, /role="radiogroup"/);
  assert.match(panelSource, /role="radio"/);
  assert.match(panelSource, /MT4/);
  assert.match(panelSource, /MT5/);
  assert.match(panelSource, /\/images\/metatrader-4-logo\.png/);
  assert.match(panelSource, /\/images\/metatrader-5-logo\.png/);
  assert.match(panelSource, /className="admin-market-data-platform-logo"/);
  assert.match(panelSource, /alt="MetaTrader 4"/);
  assert.match(panelSource, /alt="MetaTrader 5"/);
  assert.match(panelSource, /activeProfile/);
  assert.match(panelSource, /updateActiveProfile/);
  assert.match(panelSource, /activePlatform: mt45\.activePlatform/);
  assert.match(panelSource, /profiles: mt45\.profiles/);
  assert.match(panelSource, /admin-market-data-symbols/);
  assert.match(panelSource, /admin-market-data-mini-toggle/);
  assert.match(panelSource, /Tick DB 마스터가 ON이어도 여기서 ON으로 선택한 종목만 raw tick을 저장합니다/);
  assert.match(panelSource, /Price step은 시간 tick이 아니라 가격 최소 단위/);
  assert.match(panelSource, /sourceUtcOffsetHours/);
  assert.match(panelSource, /Source UTC offset/);
  assert.match(panelSource, /window\.confirm/);
  assert.match(panelSource, /슈퍼관리자 권한/);
  assert.match(panelSource, /DB 용량과 비용/);
  assert.match(panelSource, /role="switch"/);
  assert.match(panelSource, /aria-checked=\{Boolean\(activeProfile\.tickStorage\.enabled\)\}/);
  assert.match(panelSource, /className="admin-market-data-toggle"/);
  assert.doesNotMatch(panelSource, /className="admin-telegram-alerts-switch"/);
  assert.doesNotMatch(panelSource, /DATA_GATEWAY_ADMIN_TOKEN/);
  assert.doesNotMatch(panelSource, /x-admin-token/);
});

test('admin market data tick DB control is styled as a switch toggle', async () => {
  const cssSource = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  const platformRule = cssSource.match(/\.admin-market-data-platform\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const platformButtonRule = cssSource.match(/\.admin-market-data-platform button\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const platformButtonActiveRule = cssSource.match(/\.admin-market-data-platform button\.active\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const platformLogoActiveRule = cssSource.match(/\.admin-market-data-platform button\.active \.admin-market-data-platform-logo\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const tickDbToggleRule = cssSource.match(/\.admin-market-data-toggle\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  assert.match(cssSource, /\.admin-market-data-toggle\s*\{/);
  assert.match(cssSource, /\.admin-market-data-platform\s*\{/);
  assert.match(cssSource, /\.admin-market-data-platform button\.active/);
  assert.match(cssSource, /\.admin-market-data-platform-logo\s*\{/);
  assert.match(platformRule, /border:\s*0/);
  assert.match(platformButtonRule, /background:\s*#fff/);
  assert.match(platformButtonRule, /border:\s*0/);
  assert.match(platformButtonActiveRule, /background:\s*linear-gradient/);
  assert.match(platformButtonActiveRule, /box-shadow:/);
  assert.match(platformLogoActiveRule, /filter:\s*drop-shadow/);
  assert.match(platformLogoActiveRule, /transform:\s*scale/);
  assert.match(tickDbToggleRule, /border:\s*0/);
  assert.match(cssSource, /\.admin-market-data-symbols\s*\{/);
  assert.match(cssSource, /\.admin-market-data-symbol-table input/);
  assert.match(cssSource, /\.admin-market-data-mini-toggle\.active/);
  assert.match(cssSource, /\.admin-market-data-toggle-track\s*\{/);
  assert.match(cssSource, /\.admin-market-data-toggle-thumb\s*\{/);
  assert.match(cssSource, /\.admin-market-data-toggle\[data-state="on"\] \.admin-market-data-toggle-thumb/);
});

test('metatrader platform logos are available as public assets', async () => {
  await access(new URL('../public/images/metatrader-4-logo.png', import.meta.url));
  await access(new URL('../public/images/metatrader-5-logo.png', import.meta.url));
});

test('data gateway stores independent MT4 and MT5 profile settings', async () => {
  const gatewaySource = await readFile(new URL('../server/data-gateway.mjs', import.meta.url), 'utf8');
  assert.match(gatewaySource, /activePlatform: 'mt5'/);
  assert.match(gatewaySource, /profiles: \{/);
  assert.match(gatewaySource, /mt4:/);
  assert.match(gatewaySource, /mt5:/);
  assert.match(gatewaySource, /symbols: \[\]/);
  assert.match(gatewaySource, /normalizeMt45SymbolRules/);
  assert.match(gatewaySource, /normalizeMt45Profile/);
  assert.match(gatewaySource, /getMt45Profile/);
  assert.match(gatewaySource, /getMt45SymbolConfig/);
  assert.match(gatewaySource, /normalizeMt45Platform/);
  assert.match(gatewaySource, /const activePlatform = normalizeMt45Platform/);
  assert.match(gatewaySource, /const profiles = mergeMt45Profiles/);
  assert.match(gatewaySource, /symbols: normalizeMt45SymbolRules\(profileRaw\?\.symbols/);
  assert.match(gatewaySource, /tickStorageEnabled: Boolean\(rule\?\.tickStorageEnabled\)/);
  assert.match(gatewaySource, /sourceUtcOffsetHours/);
  assert.match(gatewaySource, /getSourceUtcOffsetHours/);
  assert.match(gatewaySource, /const platform = getMt45RequestPlatform\(body\)/);
  assert.match(gatewaySource, /isMt45ApiKeyConfigured\(platform\)/);
  assert.match(gatewaySource, /getMt45SymbolConfig\(tick\.market, tick\.symbol, tick\.source\)/);
  assert.match(gatewaySource, /source: getMt45RequestPlatform\(body\)/);
  assert.match(gatewaySource, /upper === 'NQ1!'/);
  assert.match(gatewaySource, /return 'futures'/);
});
