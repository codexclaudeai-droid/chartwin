import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('release gate script is wired into package scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-release-gate.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:verify'], 'node scripts/run-chart-service-release-gate.mjs');
  assert.equal(packageJson.scripts['service:security'], 'node --test tests/chart-service-security.test.mjs tests/chart-service-admin-mutation-async-routes.test.mjs tests/chart-service-user-async-routes.test.mjs tests/chart-service-payment-settings.test.mjs');
  assert.match(script, /service:check/);
  assert.match(script, /service:security/);
  assert.match(script, /service:smoke/);
  assert.match(script, /service:build/);
  assert.match(script, /spawnSync/);
  assert.match(script, /process\.env\.ComSpec/);
  assert.match(script, /'\/d', '\/s', '\/c'/);
  assert.doesNotMatch(script, /shell:\s*process\.platform === 'win32'/);
});

test('release gate dry run reports readiness smoke and build in order', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-release-gate.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_RELEASE_GATE_DRY_RUN: '1',
    },
  });

  assert.match(stdout, /\[RELEASE GATE\] 1\/4 service:check/);
  assert.match(stdout, /\[RELEASE GATE\] 2\/4 service:security/);
  assert.match(stdout, /\[RELEASE GATE\] 3\/4 service:smoke/);
  assert.match(stdout, /\[RELEASE GATE\] 4\/4 service:build/);
  assert.match(stdout, /Chart service release gate passed/);
});
