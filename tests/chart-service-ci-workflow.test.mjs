import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('chart service CI workflow runs chart and Cloudflare build checks', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/chart-service-ci.yml', import.meta.url),
    'utf8',
  );
  const openNextConfig = fs.readFileSync(
    new URL('../open-next.config.ts', import.meta.url),
    'utf8',
  );

  assert.match(workflow, /npm\.cmd run build|npm run build/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.match(workflow, /npm run service:cloudflare:build/);
  assert.match(openNextConfig, /buildCommand:\s*'npx next build'/);
  assert.doesNotMatch(workflow, /Owner1234!/);
  assert.doesNotMatch(workflow, /0123456789abcdef/);
  assert.doesNotMatch(workflow, /postgres:\/\/chart_app:secret/);
});
