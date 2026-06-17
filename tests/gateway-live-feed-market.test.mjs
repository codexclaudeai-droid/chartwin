import assert from 'node:assert/strict';
import test from 'node:test';

test('gateway live feed routes Nasdaq index futures through the futures market', async () => {
  const { inferGatewayMarket } = await import('../src/data/gateway-market.ts');

  assert.equal(inferGatewayMarket('NQ1!'), 'futures');
  assert.equal(inferGatewayMarket('NAS100'), 'futures');
  assert.equal(inferGatewayMarket('NQ'), 'futures');
  assert.equal(inferGatewayMarket('NAS100FT'), 'futures');
  assert.equal(inferGatewayMarket('NAS100.FT'), 'futures');
  assert.equal(inferGatewayMarket('NAS100 Futures'), 'futures');
});

test('gateway live feed normalizes Nasdaq broker aliases to NQ1!', async () => {
  const { normalizeSymbol } = await import('../src/data/gateway-market.ts');

  assert.equal(normalizeSymbol('NAS100FT'), 'NQ1!');
  assert.equal(normalizeSymbol('NAS100.FT'), 'NQ1!');
  assert.equal(normalizeSymbol('NAS100 Futures'), 'NQ1!');
});
