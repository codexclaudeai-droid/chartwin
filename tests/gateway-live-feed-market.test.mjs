import assert from 'node:assert/strict';
import test from 'node:test';

test('gateway live feed routes Nasdaq index futures through the futures market', async () => {
  const { inferGatewayMarket } = await import('../src/data/gateway-market.ts');

  assert.equal(inferGatewayMarket('NQ1!'), 'futures');
  assert.equal(inferGatewayMarket('NAS100'), 'futures');
  assert.equal(inferGatewayMarket('NQ'), 'futures');
});
