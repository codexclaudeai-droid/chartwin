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
  assert.match(deployWorkflow, /npx wrangler deploy --secrets-file "\$SECRETS_FILE"/);
  assert.match(deployWorkflow, /npm run service:migrate/);
  assert.match(deployWorkflow, /npm run service:bootstrap/);
  assert.match(deployWorkflow, /npm run service:postgres:admin-check/);
  assert.match(deployWorkflow, /node scripts\/ensure-cloudflare-hyperdrive\.mjs/);
  assert.ok(
    deployWorkflow.indexOf('Write runtime secrets file') < deployWorkflow.indexOf('Deploy Worker'),
    'runtime secrets file must be written before deploying the Worker',
  );
  assert.match(deployWorkflow, /SECRETS_FILE:\s+\$\{\{ runner\.temp \}\}\/chartwin-secrets\.json/);
  assert.match(deployWorkflow, /CHART_SERVICE_DATABASE_URL/);
  assert.match(deployWorkflow, /CHART_SERVICE_SESSION_SECRET/);
  assert.match(deployWorkflow, /CLOUDFLARE_HYPERDRIVE_NAME:\s+tradingcore-hyperdrive/);
  assert.match(deployWorkflow, /CLOUDFLARE_HYPERDRIVE_ID/);
  assert.match(deployWorkflow, /CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:\s+\$\{\{ secrets\.CHART_SERVICE_DATABASE_URL \}\}/);
  assert.match(deployWorkflow, /CHART_SERVICE_REPOSITORY:\s+postgres/);
  assert.match(deployWorkflow, /CHART_SERVICE_DATABASE_SSL_MODE:\s+require/);
  assert.match(wranglerConfig, /CHART_SERVICE_RUNTIME_TARGET/);
  assert.match(wranglerConfig, /cloudflare-workers/);
  assert.match(wranglerConfig, /"CHART_SERVICE_BASE_URL":\s*"https:\/\/tradingcore\.co"/);
  assert.match(wranglerConfig, /"CHART_SERVICE_EMAIL_PROVIDER":\s*"cloudflare"/);
  assert.doesNotMatch(wranglerConfig, /"CHART_SERVICE_EMAIL_PROVIDER":\s*"log"/);
  assert.match(wranglerConfig, /"send_email":\s*\[/);
  assert.match(wranglerConfig, /"name":\s*"EMAIL"/);
  assert.match(wranglerConfig, /"allowed_sender_addresses":\s*\[/);
  assert.match(wranglerConfig, /"verify@tradingcore\.co"/);
  assert.match(deployWorkflow, /CHART_SERVICE_EMAIL_PROVIDER:\s+cloudflare/);
  assert.match(deployWorkflow, /WEB_PUSH_PUBLIC_KEY:\s+\$\{\{ secrets\.WEB_PUSH_PUBLIC_KEY \}\}/);
  assert.match(deployWorkflow, /WEB_PUSH_PRIVATE_KEY:\s+\$\{\{ secrets\.WEB_PUSH_PRIVATE_KEY \}\}/);
  assert.match(deployWorkflow, /WEB_PUSH_SUBJECT:\s+\$\{\{ secrets\.WEB_PUSH_SUBJECT \}\}/);
  assert.match(deployWorkflow, /CHART_SERVICE_GOOGLE_CLIENT_ID:\s+\$\{\{ secrets\.CHART_SERVICE_GOOGLE_CLIENT_ID \}\}/);
  assert.match(deployWorkflow, /CHART_SERVICE_GOOGLE_CLIENT_SECRET:\s+\$\{\{ secrets\.CHART_SERVICE_GOOGLE_CLIENT_SECRET \}\}/);
  assert.match(deployWorkflow, /CHART_SERVICE_NAVER_CLIENT_ID:\s+\$\{\{ secrets\.CHART_SERVICE_NAVER_CLIENT_ID \}\}/);
  assert.match(deployWorkflow, /CHART_SERVICE_NAVER_CLIENT_SECRET:\s+\$\{\{ secrets\.CHART_SERVICE_NAVER_CLIENT_SECRET \}\}/);
  assert.match(deployWorkflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployWorkflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(deployWorkflow, /CLOUDFLARE_EMAIL_API_TOKEN:\s+\$\{\{ secrets\.CLOUDFLARE_EMAIL_API_TOKEN \}\}/);
  assert.match(deployWorkflow, /process\.env\.CLOUDFLARE_EMAIL_API_TOKEN \|\| process\.env\.CLOUDFLARE_API_TOKEN/);
  assert.match(deployWorkflow, /secrets\.CHART_SERVICE_CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployWorkflow, /secrets\.CHART_SERVICE_CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(deployWorkflow, /wrangler secret put/);
  assert.match(deployWorkflow, /WEB_PUSH_PRIVATE_KEY/);
  assert.match(openNextConfig, /buildCommand:\s*'npx next build'/);
  assert.match(nextConfig, /pg-cloudflare/);
  assert.match(nextConfig, /serverExternalPackages:\s*\['pg', 'pg-cloudflare'\]/);
  assert.doesNotMatch(workflow, /Owner1234!/);
  assert.doesNotMatch(workflow, /0123456789abcdef/);
  assert.doesNotMatch(workflow, /postgres:\/\/chart_app:secret/);
});
