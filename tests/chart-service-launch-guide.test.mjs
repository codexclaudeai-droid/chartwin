import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('launch guide is wired into package scripts, launch check tests, and runbook', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/print-chart-service-launch-guide.mjs', import.meta.url), 'utf8');
  const launchCheck = fs.readFileSync(new URL('../scripts/run-chart-service-launch-check.mjs', import.meta.url), 'utf8');
  const runbook = fs.readFileSync(new URL('../docs/04-deploy/chart-service-deployment-runbook.md', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:launch-guide'], 'node scripts/print-chart-service-launch-guide.mjs');
  assert.match(script, /service:launch-check/);
  assert.match(script, /service:prod-env:check/);
  assert.match(script, /service:postgres:gate/);
  assert.match(script, /service:postdeploy:smoke/);
  assert.match(launchCheck, /chart-service-launch-guide\.test\.mjs/);
  assert.match(runbook, /npm\.cmd run service:launch-guide/);
});

test('launch guide prints the operating sequence without leaking configured secrets', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/print-chart-service-launch-guide.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_BASE_URL: 'https://tradingcore.example.com',
      CHART_SERVICE_DATABASE_URL: 'postgresql://chart_app:super-secret@db.example.com/chart_service?sslmode=require',
      CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
      CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
    },
  });

  assert.match(stdout, /TradingCore Launch Guide/);
  assert.match(stdout, /1\. Prepare production secrets/);
  assert.match(stdout, /2\. Run local launch readiness/);
  assert.match(stdout, /3\. Run production Postgres gate/);
  assert.match(stdout, /4\. Deploy the app/);
  assert.match(stdout, /5\. Run post-deploy smoke/);
  assert.match(stdout, /npm\.cmd run service:launch-check/);
  assert.match(stdout, /npm\.cmd run service:prod-env:check/);
  assert.match(stdout, /npm\.cmd run service:postgres:gate/);
  assert.match(stdout, /npm\.cmd run service:postdeploy:smoke/);
  assert.match(stdout, /CHART_SERVICE_BASE_URL=https:\/\/tradingcore\.example\.com/);
  assert.match(stdout, /CHART_SERVICE_DATABASE_URL=postgresql:\/\/db\.example\.com\/chart_service/);
  assert.match(stdout, /CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL=owner@tradingcore\.test/);
  assert.doesNotMatch(stdout, /super-secret/);
  assert.doesNotMatch(stdout, /chart_app/);
  assert.doesNotMatch(stdout, /ProdAdmin1234!/);
});
