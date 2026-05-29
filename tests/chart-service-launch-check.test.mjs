import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('launch check is wired as the single production-readiness command', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-launch-check.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:launch-check'], 'node scripts/run-chart-service-launch-check.mjs');
  assert.match(script, /service:verify/);
  assert.match(script, /service:email:deliver/);
  assert.match(script, /chart-service-production-env-template\.test\.mjs/);
  assert.match(script, /chart-service-deployment-runbook\.test\.mjs/);
  assert.match(script, /chart-service-ci-workflow\.test\.mjs/);
  assert.match(script, /chart-service-readiness-output\.test\.mjs/);
  assert.match(script, /service:postgres:gate/);
  assert.match(script, /CHART_SERVICE_POSTGRES_GATE_DRY_RUN/);
});

test('launch check dry run prints the full production-readiness sequence', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-launch-check.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_LAUNCH_CHECK_DRY_RUN: '1',
    },
  });

  assert.match(stdout, /\[LAUNCH CHECK\] 1\/4 service:verify/);
  assert.match(stdout, /\[LAUNCH CHECK\] 2\/4 production docs and env tests/);
  assert.match(stdout, /\[LAUNCH CHECK\] 3\/4 service:email:deliver/);
  assert.match(stdout, /\[LAUNCH CHECK\] 4\/4 service:postgres:gate dry-run/);
  assert.match(stdout, /TradingCore launch check passed/);
});
