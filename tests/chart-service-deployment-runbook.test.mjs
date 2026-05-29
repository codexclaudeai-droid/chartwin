import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('deployment runbook documents the production Postgres release flow', () => {
  const runbook = fs.readFileSync(
    new URL('../docs/04-deploy/chart-service-deployment-runbook.md', import.meta.url),
    'utf8',
  );

  for (const expected of [
    'CHART_SERVICE_REPOSITORY=postgres',
    'CHART_SERVICE_DATABASE_URL',
    'CHART_SERVICE_DATABASE_SSL_MODE',
    'CHART_SERVICE_SESSION_SECRET',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL',
    'npm.cmd run service:launch-check',
    'service:prod-env:check',
    'service:postgres:admin-check',
    'npm.cmd run service:postgres:gate',
    'CHART_SERVICE_POSTGRES_GATE_DRY_RUN=1',
    'npm.cmd run service:verify',
    '.env.production.example',
    '/api/health',
    'Rollback',
  ]) {
    assert.match(runbook, new RegExp(escapeRegExp(expected)), `${expected} should be documented`);
  }

  assert.doesNotMatch(runbook, /Owner1234!/);
  assert.doesNotMatch(runbook, /0123456789abcdef/);
  assert.doesNotMatch(runbook, /postgres:\/\/chart_app:secret/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
