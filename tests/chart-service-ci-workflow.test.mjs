import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('chart service CI workflow runs tests, builds, and readiness checks', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/chart-service-ci.yml', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /node --test tests\\\*\.test\.mjs/);
  assert.match(workflow, /npm\.cmd run build|npm run build/);
  assert.match(workflow, /npm\.cmd run service:build|npm run service:build/);
  assert.match(workflow, /npm\.cmd run service:check|npm run service:check/);
  assert.match(workflow, /CHART_SERVICE_REPOSITORY: postgres/);
  assert.match(workflow, /CHART_SERVICE_DATABASE_SSL_MODE: require/);
});

