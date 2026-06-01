import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('fullstack dev chart route is admin gated and boots the chart runtime', () => {
  const pageSource = readFileSync(new URL('../app/dev/page.tsx', import.meta.url), 'utf8');

  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
  assert.match(pageSource, /headers\(\)/);
  assert.match(pageSource, /getActorFromAsyncRequest/);
  assert.match(pageSource, /assertAdminActor\(actor\)/);
  assert.match(pageSource, /redirect\('\/login\?redirect=\/dev'\)/);
  assert.match(pageSource, /<ChartRuntime accessVerified \/>/);
});

test('chart runtime variant detection treats the fullstack /dev route as dev mode', () => {
  const runtimeSource = readFileSync(new URL('../src/app/runtime.ts', import.meta.url), 'utf8');

  assert.match(runtimeSource, /DEV_PATH_SUFFIXES = \['\/dev', '\/dev\.html'\]/);
  assert.match(runtimeSource, /pathname === suffix \|\| pathname\.endsWith\(suffix\)/);
});
