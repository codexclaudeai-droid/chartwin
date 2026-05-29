import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('production env doctor is wired into package scripts and postgres gate', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const doctorScript = fs.readFileSync(new URL('../scripts/check-production-env.mjs', import.meta.url), 'utf8');
  const gateScript = fs.readFileSync(new URL('../scripts/run-chart-service-postgres-gate.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:prod-env:check'], 'node scripts/check-production-env.mjs');
  assert.match(doctorScript, /validatePasswordPolicy/);
  assert.match(doctorScript, /redactDatabaseUrl/);
  assert.match(gateScript, /service:prod-env:check/);
});

test('production env doctor passes valid postgres launch env without leaking secrets', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/check-production-env.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CHART_SERVICE_REPOSITORY: 'postgres',
      CHART_SERVICE_DATABASE_URL: 'postgresql://chart_app:super-secret@db.example.com/chart_service?sslmode=require',
      CHART_SERVICE_DATABASE_SSL_MODE: 'require',
      CHART_SERVICE_SESSION_SECRET: 'prod-session-secret-minimum-32-characters',
      CHART_SERVICE_EMAIL_PROVIDER: 'log',
      CHART_SERVICE_EMAIL_DELIVERY_LIMIT: '50',
      CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
      CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
      CHART_SERVICE_BOOTSTRAP_ADMIN_NAME: 'TradingCore Owner',
    },
  });

  assert.match(stdout, /\[PROD ENV PASS\] repository: postgres/);
  assert.match(stdout, /\[PROD ENV PASS\] database: postgresql:\/\/db\.example\.com\/chart_service/);
  assert.match(stdout, /\[PROD ENV PASS\] bootstrap admin: owner@tradingcore\.test/);
  assert.match(stdout, /Production environment check passed/);
  assert.doesNotMatch(stdout, /super-secret/);
  assert.doesNotMatch(stdout, /chart_app/);
  assert.doesNotMatch(stdout, /ProdAdmin1234!/);
});

test('production env doctor fails before database work when secrets are placeholders or weak', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/check-production-env.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CHART_SERVICE_REPOSITORY: 'postgres',
        CHART_SERVICE_DATABASE_URL: '<production-postgres-url>',
        CHART_SERVICE_DATABASE_SSL_MODE: 'disable',
        CHART_SERVICE_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
        CHART_SERVICE_EMAIL_PROVIDER: 'log',
        CHART_SERVICE_EMAIL_DELIVERY_LIMIT: '-1',
        CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: '<first-admin-email>',
        CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'Owner1234!',
        CHART_SERVICE_BOOTSTRAP_ADMIN_NAME: '',
      },
    }),
    /Production environment check failed/,
  );
});
