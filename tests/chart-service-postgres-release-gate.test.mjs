import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('postgres release gate is wired into package scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-postgres-gate.mjs', import.meta.url), 'utf8');
  const adminCheckScript = fs.readFileSync(
    new URL('../scripts/verify-postgres-admin-login.mjs', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.scripts['service:postgres:gate'], 'node scripts/run-chart-service-postgres-gate.mjs');
  assert.equal(packageJson.scripts['service:postgres:admin-check'], 'node scripts/verify-postgres-admin-login.mjs');
  assert.match(script, /CHART_SERVICE_REPOSITORY/);
  assert.match(script, /CHART_SERVICE_DATABASE_URL/);
  assert.match(script, /CHART_SERVICE_SESSION_SECRET/);
  assert.match(script, /CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL/);
  assert.match(script, /CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD/);
  assert.match(script, /service:check/);
  assert.match(script, /service:prod-env:check/);
  assert.match(script, /service:bootstrap/);
  assert.match(script, /service:postgres:admin-check/);
  assert.match(script, /service:security/);
  assert.match(script, /service:build/);
  assert.match(adminCheckScript, /authenticateAsyncUserWithPassword/);
  assert.match(adminCheckScript, /createPostgresAsyncChartServiceRepository/);
});

test('postgres release gate dry run requires postgres env and reports deployment order', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-postgres-gate.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_POSTGRES_GATE_DRY_RUN: '1',
      CHART_SERVICE_REPOSITORY: 'postgres',
      CHART_SERVICE_DATABASE_URL: 'postgres://chart-service.local/app',
      CHART_SERVICE_DATABASE_SSL_MODE: 'require',
      CHART_SERVICE_SESSION_SECRET: 'prod-session-secret-minimum-32-characters',
      CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
      CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
      CHART_SERVICE_BOOTSTRAP_ADMIN_NAME: 'Service Owner',
    },
  });

  assert.match(stdout, /\[POSTGRES GATE\] 1\/6 service:prod-env:check/);
  assert.match(stdout, /\[POSTGRES GATE\] 2\/6 service:check/);
  assert.match(stdout, /\[POSTGRES GATE\] 3\/6 service:bootstrap/);
  assert.match(stdout, /\[POSTGRES GATE\] 4\/6 service:postgres:admin-check/);
  assert.match(stdout, /\[POSTGRES GATE\] 5\/6 service:security/);
  assert.match(stdout, /\[POSTGRES GATE\] 6\/6 service:build/);
  assert.match(stdout, /Chart service Postgres gate passed/);
});

test('postgres release gate fails fast when postgres env is incomplete', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-postgres-gate.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        CHART_SERVICE_POSTGRES_GATE_DRY_RUN: '1',
        CHART_SERVICE_REPOSITORY: 'memory',
      },
    }),
    /CHART_SERVICE_REPOSITORY must be postgres/,
  );
});
