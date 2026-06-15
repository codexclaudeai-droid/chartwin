import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('root layout exposes the configured data gateway URL to browser chart feeds', () => {
  const source = fs.readFileSync('app/layout.tsx', 'utf8');

  assert.match(source, /dataGatewayClientConfigScript/);
  assert.match(source, /window\.__DATA_GATEWAY_URL__/);
  assert.match(source, /DATA_GATEWAY_URL/);
  assert.doesNotMatch(source, /DATA_GATEWAY_ADMIN_TOKEN/);
});
