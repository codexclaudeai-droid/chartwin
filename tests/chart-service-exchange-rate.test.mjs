import assert from 'node:assert/strict';
import test from 'node:test';

test('USD/KRW exchange route reads the Naver calcPrice value', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({
      result: {
        calcPrice: '1,390.50',
        localTradedAt: '2026-05-25T10:00:00+09:00',
      },
    });
  };

  try {
    const { GET } = await import('../app/api/exchange-rate/usd-krw/route.ts');
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(calls[0], /m\.stock\.naver\.com/);
    assert.match(calls[0], /FX_USDKRW/);
    assert.equal(payload.provider, 'naver');
    assert.equal(payload.rate, 1390.5);
    assert.equal(payload.baseCurrency, 'USD');
    assert.equal(payload.quoteCurrency, 'KRW');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('USD/KRW exchange route rejects malformed Naver responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ result: { calcPrice: 'not-a-rate' } });

  try {
    const { GET } = await import(`../app/api/exchange-rate/usd-krw/route.ts?malformed=${Date.now()}`);
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.equal(payload.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
