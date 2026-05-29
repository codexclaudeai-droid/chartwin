import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('release gap report is wired into package scripts, launch check tests, and readiness checklist', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/print-chart-service-release-gap-report.mjs', import.meta.url), 'utf8');
  const launchCheck = fs.readFileSync(new URL('../scripts/run-chart-service-launch-check.mjs', import.meta.url), 'utf8');
  const checklist = fs.readFileSync(
    new URL('../docs/03-check/chart-service-production-readiness-checklist.md', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.scripts['service:release-gap-report'], 'node scripts/print-chart-service-release-gap-report.mjs');
  assert.match(script, /READY GATES/);
  assert.match(script, /REAL ENVIRONMENT REQUIRED/);
  assert.match(script, /POST-LAUNCH BACKLOG/);
  assert.match(script, /Landing page final public copy and design polish are covered before launch/);
  assert.doesNotMatch(script, /Design-system polish and final landing\/admin UI refinement can continue after launch gates are stable/);
  assert.match(launchCheck, /chart-service-release-gap-report\.test\.mjs/);
  assert.match(checklist, /Release Gap Report/);
});

test('release gap report prints grouped launch risks without leaking secrets', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/print-chart-service-release-gap-report.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_DATABASE_URL: 'postgresql://chart_app:super-secret@db.example.com/chart_service?sslmode=require',
      CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
    },
  });

  assert.match(stdout, /TradingCore Release Gap Report/);
  assert.match(stdout, /READY GATES/);
  assert.match(stdout, /service:launch-check/);
  assert.match(stdout, /service:postgres:gate/);
  assert.match(stdout, /service:postdeploy:smoke/);
  assert.match(stdout, /Landing page final public copy and design polish/);
  assert.match(stdout, /REAL ENVIRONMENT REQUIRED/);
  assert.match(stdout, /Real Postgres database connection/);
  assert.match(stdout, /Manual bank transfer verification policy/);
  assert.match(stdout, /POST-LAUNCH BACKLOG/);
  assert.match(stdout, /KIS\/MetaTrader data integration/);
  assert.match(stdout, /External email provider/);
  assert.doesNotMatch(stdout, /final landing\/admin UI refinement/);
  assert.doesNotMatch(stdout, /super-secret/);
  assert.doesNotMatch(stdout, /chart_app/);
  assert.doesNotMatch(stdout, /ProdAdmin1234!/);
});
