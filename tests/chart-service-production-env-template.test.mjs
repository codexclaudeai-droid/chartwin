import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('production env template documents required runtime settings without committed secrets', () => {
  const envExample = fs.readFileSync(new URL('../.env.production.example', import.meta.url), 'utf8');

  for (const key of [
    'NODE_ENV',
    'CHART_SERVICE_REPOSITORY',
    'CHART_SERVICE_DATABASE_URL',
    'CHART_SERVICE_DATABASE_SSL_MODE',
    'CLOUDFLARE_HYPERDRIVE_NAME',
    'CLOUDFLARE_HYPERDRIVE_ID',
    'CLOUDFLARE_HYPERDRIVE_BINDING',
    'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
    'CHART_SERVICE_SESSION_SECRET',
    'CHART_SERVICE_EMAIL_PROVIDER',
    'CHART_SERVICE_EMAIL_DELIVERY_LIMIT',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_NAME',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
  ]) {
    assert.match(envExample, new RegExp(`^${key}=`, 'm'), `${key} should be present`);
  }

  for (const key of [
    'CHART_SERVICE_DATABASE_URL',
    'CLOUDFLARE_HYPERDRIVE_ID',
    'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
    'CHART_SERVICE_SESSION_SECRET',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD',
    'CHART_SERVICE_BOOTSTRAP_ADMIN_NAME',
  ]) {
    const match = envExample.match(new RegExp(`^${key}=(.*)$`, 'm'));
    assert.equal(match?.[1]?.trim(), '', `${key} should stay blank in the committed template`);
  }

  assert.match(envExample, /Do not commit real production values/);
  assert.match(envExample, /npm\.cmd run service:postgres:gate/);
  assert.match(envExample, /^CHART_SERVICE_EMAIL_PROVIDER=cloudflare$/m);
  assert.match(envExample, /^CHART_SERVICE_EMAIL_DELIVERY_LIMIT=50$/m);
  assert.match(envExample, /^CLOUDFLARE_HYPERDRIVE_NAME=tradingcore-hyperdrive$/m);
  assert.match(envExample, /^CLOUDFLARE_HYPERDRIVE_BINDING=HYPERDRIVE$/m);
  assert.doesNotMatch(envExample, /Owner1234!/);
  assert.doesNotMatch(envExample, /0123456789abcdef/);
  assert.doesNotMatch(envExample, /postgres:\/\/chart_app:secret/);
});
