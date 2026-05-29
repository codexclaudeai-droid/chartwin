import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('readiness command labels local warnings as expected launch-check context', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/check-production-readiness.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      CHART_SERVICE_REPOSITORY: 'memory',
    },
  });

  assert.match(stdout, /\[READINESS TARGET\] local development/);
  assert.match(stdout, /\[WARN\] Persistent repository/);
  assert.match(stdout, /\[READINESS NOTE\] Local warnings are expected during service:launch-check/);
  assert.match(stdout, /Use service:postgres:gate for real production DB validation/);
  assert.match(stdout, /Production readiness check passed/);
});

test('readiness command labels production postgres checks separately from local launch warnings', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/check-production-readiness.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CHART_SERVICE_REPOSITORY: 'postgres',
      CHART_SERVICE_DATABASE_URL: 'postgres://chart-service.local/app',
      CHART_SERVICE_DATABASE_SSL_MODE: 'require',
      CHART_SERVICE_SESSION_SECRET: 'prod-session-secret-minimum-32-characters',
      CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
      CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
      CHART_SERVICE_BOOTSTRAP_ADMIN_NAME: 'TradingCore Owner',
    },
  });

  assert.match(stdout, /\[READINESS TARGET\] production postgres/);
  assert.doesNotMatch(stdout, /Local warnings are expected/);
  assert.match(stdout, /Production readiness check passed/);
});
