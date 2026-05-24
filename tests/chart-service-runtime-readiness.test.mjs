import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('runtime readiness flags production memory persistence as unsafe', async () => {
  const { getChartServiceRuntimeReadiness } = await import('../src/server/chart-service/index.ts');

  const readiness = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'memory',
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.mode, 'production');
  assert.equal(readiness.repository.kind, 'memory');
  assert.equal(readiness.repository.isPersistent, false);
  assert.equal(readiness.checks.some((check) => check.key === 'persistent_repository' && check.status === 'fail'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'session_secret' && check.status === 'fail'), true);
});

test('runtime readiness accepts configured postgres persistence with pg runtime binding', async () => {
  const { getChartServiceRuntimeReadiness } = await import('../src/server/chart-service/index.ts');

  const readiness = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: 'postgres://chart-service.local/app',
    CHART_SERVICE_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  });

  assert.equal(readiness.repository.kind, 'postgres');
  assert.equal(readiness.repository.isPersistent, true);
  assert.equal(readiness.checks.some((check) => check.key === 'database_url' && check.status === 'pass'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'database_ssl' && check.status === 'pass'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'postgres_mapping_contract' && check.status === 'pass'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'postgres_schema_migration_harness' && check.status === 'pass'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'postgres_bootstrap_harness' && check.status === 'pass'), true);
  assert.equal(readiness.checks.some((check) => check.key === 'repository_adapter_implementation' && check.status === 'pass'), true);
  assert.equal(readiness.ok, true);
});

test('runtime readiness redacts postgres credentials while reporting connection safety', async () => {
  const { getChartServiceRuntimeReadiness } = await import('../src/server/chart-service/index.ts');

  const readiness = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: 'postgresql://chart_app:super-secret@db.example.com/chart_service?sslmode=verify-full',
    CHART_SERVICE_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  });
  const databaseCheck = readiness.checks.find((check) => check.key === 'database_url');
  const sslCheck = readiness.checks.find((check) => check.key === 'database_ssl');
  const serialized = JSON.stringify(readiness);

  assert.equal(databaseCheck?.status, 'pass');
  assert.match(databaseCheck?.message ?? '', /db\.example\.com/);
  assert.equal(sslCheck?.status, 'pass');
  assert.equal(serialized.includes('super-secret'), false);
  assert.equal(serialized.includes('chart_app'), false);
});

test('runtime readiness fails unsafe postgres SSL settings in production', async () => {
  const { getChartServiceRuntimeReadiness } = await import('../src/server/chart-service/index.ts');

  const readiness = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: 'postgresql://chart_app:secret@db.example.com/chart_service?sslmode=disable',
    CHART_SERVICE_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  });
  const sslCheck = readiness.checks.find((check) => check.key === 'database_ssl');

  assert.equal(sslCheck?.status, 'fail');
  assert.match(sslCheck?.message ?? '', /SSL/);
});

test('runtime readiness requires a strong session signing secret in production', async () => {
  const { getChartServiceRuntimeReadiness } = await import('../src/server/chart-service/index.ts');

  const missing = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: 'postgres://chart-service.local/app',
  });
  const configured = getChartServiceRuntimeReadiness({
    NODE_ENV: 'production',
    CHART_SERVICE_REPOSITORY: 'postgres',
    CHART_SERVICE_DATABASE_URL: 'postgres://chart-service.local/app',
    CHART_SERVICE_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  });

  assert.equal(missing.checks.find((check) => check.key === 'session_secret')?.status, 'fail');
  assert.equal(configured.checks.find((check) => check.key === 'session_secret')?.status, 'pass');
});

test('health route exposes runtime readiness without leaking database credentials', async () => {
  const { GET } = await import('../app/api/health/route.ts');

  const response = await GET(new Request('http://localhost/api/health'));
  const payload = await response.json();

  assert.equal(typeof payload.ok, 'boolean');
  assert.equal(payload.databaseUrl, undefined);
  assert.equal(JSON.stringify(payload).includes('postgres://'), false);
  assert.equal(Array.isArray(payload.checks), true);
});

test('production readiness harness is wired into package scripts and env template', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/check-production-readiness.mjs', import.meta.url), 'utf8');
  const envExample = fs.readFileSync(new URL('../.env.production.example', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:check'], 'node scripts/check-production-readiness.mjs');
  assert.match(script, /getChartServiceRuntimeReadiness/);
  assert.match(script, /process\.exit\(1\)/);
  assert.match(envExample, /CHART_SERVICE_REPOSITORY=postgres/);
  assert.match(envExample, /CHART_SERVICE_DATABASE_URL=/);
  assert.match(envExample, /CHART_SERVICE_SESSION_SECRET=/);
});
