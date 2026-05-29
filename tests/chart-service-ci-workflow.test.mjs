import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('chart service CI workflow runs release gates and Postgres dry-run checks', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/chart-service-ci.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /npm\.cmd run service:launch-check|npm run service:launch-check/);
  assert.match(workflow, /npm\.cmd run build|npm run build/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.match(workflow, /npm run service:cloudflare:build/);
  assert.doesNotMatch(workflow, /Owner1234!/);
  assert.doesNotMatch(workflow, /0123456789abcdef/);
  assert.doesNotMatch(workflow, /postgres:\/\/chart_app:secret/);
});
