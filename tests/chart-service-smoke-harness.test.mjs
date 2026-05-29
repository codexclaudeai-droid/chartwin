import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('chart service smoke harness is wired into package scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-smoke.mjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:smoke'], 'node scripts/run-chart-service-smoke.mjs');
  assert.match(script, /authenticateAsyncUserWithPassword/);
  assert.match(script, /registerAsyncMockUserAccount/);
  assert.match(script, /createAsyncAuthenticatedManualPaymentRequest/);
  assert.match(script, /confirmAsyncManualPaymentRequest/);
  assert.match(script, /approveAsyncSubscriptionActivationRequest/);
  assert.match(script, /replyAsyncToSupportThreadAsAdmin/);
});

test('chart service smoke harness executes the core subscription operations flow', async () => {
  const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-smoke.mjs', import.meta.url));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      CHART_SERVICE_SMOKE_MODE: 'memory',
    },
  });

  assert.match(stdout, /\[SMOKE PASS\] signup/);
  assert.match(stdout, /\[SMOKE PASS\] admin login/);
  assert.match(stdout, /\[SMOKE PASS\] payment request/);
  assert.match(stdout, /\[SMOKE PASS\] payment confirmation/);
  assert.match(stdout, /\[SMOKE PASS\] subscription approval/);
  assert.match(stdout, /\[SMOKE PASS\] support reply/);
  assert.match(stdout, /Chart service smoke passed/);
});
