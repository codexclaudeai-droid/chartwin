import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('chart service CI workflow runs chart and Cloudflare build checks', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/chart-service-ci.yml', import.meta.url),
    'utf8',
  );
  const deployWorkflow = fs.readFileSync(
    new URL('../.github/workflows/cloudflare-deploy.yml', import.meta.url),
    'utf8',
  );
  const openNextConfig = fs.readFileSync(
    new URL('../open-next.config.ts', import.meta.url),
    'utf8',
  );
  const nextConfig = fs.readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  const wranglerConfig = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

  assert.match(workflow, /npm\.cmd run build|npm run build/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.match(workflow, /npm run service:cloudflare:build/);
  assert.match(deployWorkflow, /npm ci --include=dev/);
  assert.match(deployWorkflow, /npx wrangler deploy/);
  assert.match(deployWorkflow, /npm run service:migrate/);
  assert.match(deployWorkflow, /npm run service:bootstrap/);
  assert.match(deployWorkflow, /npm run service:postgres:admin-check/);
  assert.match(deployWorkflow, /node scripts\/ensure-cloudflare-hyperdrive\.mjs/);
  assert.match(deployWorkflow, /CHART_SERVICE_DATABASE_URL/);
  assert.match(deployWorkflow, /CHART_SERVICE_SESSION_SECRET/);
  assert.match(deployWorkflow, /CLOUDFLARE_HYPERDRIVE_NAME:\s+tradingcore-hyperdrive/);
  assert.match(deployWorkflow, /CLOUDFLARE_HYPERDRIVE_ID/);
  assert.match(deployWorkflow, /CHART_SERVICE_REPOSITORY:\s+postgres/);
  assert.match(deployWorkflow, /CHART_SERVICE_DATABASE_SSL_MODE:\s+require/);
  assert.match(wranglerConfig, /CHART_SERVICE_RUNTIME_TARGET/);
  assert.match(wranglerConfig, /cloudflare-workers/);
  assert.match(deployWorkflow, /CHART_SERVICE_EMAIL_PROVIDER:\s+log/);
  assert.match(openNextConfig, /buildCommand:\s*'npx next build'/);
  assert.match(nextConfig, /pg-cloudflare/);
  assert.match(nextConfig, /serverExternalPackages:\s*\['pg', 'pg-cloudflare'\]/);
  assert.doesNotMatch(workflow, /Owner1234!/);
  assert.doesNotMatch(workflow, /0123456789abcdef/);
  assert.doesNotMatch(workflow, /postgres:\/\/chart_app:secret/);
});
