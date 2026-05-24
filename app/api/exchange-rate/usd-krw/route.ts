import { NextResponse } from 'next/server.js';

const NAVER_USD_KRW_URL = 'https://m.stock.naver.com/front-api/marketIndex/productDetail?category=exchange&reutersCode=FX_USDKRW';

export async function GET() {
  try {
    const response = await fetch(NAVER_USD_KRW_URL, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Naver exchange response failed: ${response.status}`);
    }

    const payload = await response.json();
    const rate = parseNaverUsdKrwRate(payload);

    return NextResponse.json({
      ok: true,
      provider: 'naver',
      baseCurrency: 'USD',
      quoteCurrency: 'KRW',
      rate,
      fetchedAt: new Date().toISOString(),
      marketTimestamp: payload?.result?.localTradedAt ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'exchange rate fetch failed',
    }, { status: 502 });
  }
}

function parseNaverUsdKrwRate(payload: unknown): number {
  const calcPrice = (payload as { result?: { calcPrice?: unknown } })?.result?.calcPrice;
  const rate = Number(String(calcPrice ?? '').replaceAll(',', '').trim());
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid Naver USD/KRW exchange rate');
  }
  return rate;
}
