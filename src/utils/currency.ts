import type { DisplayCurrency } from '../types/market';

const fxRateCache: { updatedAt: number; rates: Partial<Record<'EUR' | 'JPY' | 'KRW', number>> } = {
  updatedAt: 0,
  rates: {},
};
const btcRateCache: { updatedAt: number; usdtPerBtc: number } = {
  updatedAt: 0,
  usdtPerBtc: NaN,
};

export async function getUsdtToDisplayRate(target: DisplayCurrency): Promise<number> {
  if (target === 'USDT' || target === 'USD') return 1;
  if (target === 'BTC') {
    const now = Date.now();
    if (Number.isFinite(btcRateCache.usdtPerBtc) && now - btcRateCache.updatedAt < 20_000) {
      return 1 / btcRateCache.usdtPerBtc;
    }
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const json = await res.json() as { price?: string };
      const px = Number(json.price);
      if (Number.isFinite(px) && px > 0) {
        btcRateCache.usdtPerBtc = px;
        btcRateCache.updatedAt = now;
        return 1 / px;
      }
    } catch {
      // ignore and fallback below
    }
    return Number.isFinite(btcRateCache.usdtPerBtc) && btcRateCache.usdtPerBtc > 0 ? 1 / btcRateCache.usdtPerBtc : 1;
  }

  const now = Date.now();
  if (fxRateCache.rates[target as 'EUR' | 'JPY' | 'KRW'] && now - fxRateCache.updatedAt < 10 * 60_000) {
    return fxRateCache.rates[target as 'EUR' | 'JPY' | 'KRW']!;
  }
  const persistRates = (rates: Partial<Record<'EUR' | 'JPY' | 'KRW', number>>) => {
    if (Number.isFinite(rates.EUR) && Number.isFinite(rates.JPY) && Number.isFinite(rates.KRW)) {
      fxRateCache.rates = rates;
      fxRateCache.updatedAt = now;
      try {
        localStorage.setItem('my-chart-lib.fx.usd', JSON.stringify({ updatedAt: now, rates }));
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  };
  const loadPersisted = (): boolean => {
    try {
      const raw = localStorage.getItem('my-chart-lib.fx.usd');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { updatedAt?: number; rates?: Partial<Record<'EUR' | 'JPY' | 'KRW', number>> };
      if (!parsed || typeof parsed !== 'object' || !parsed.rates) return false;
      if (!persistRates(parsed.rates)) return false;
      return true;
    } catch {
      return false;
    }
  };
  const fetchers: Array<() => Promise<Partial<Record<'EUR' | 'JPY' | 'KRW', number>> | null>> = [
    async () => {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,KRW');
      if (!res.ok) return null;
      const json = await res.json() as { rates?: Partial<Record<'EUR' | 'JPY' | 'KRW', number>> };
      return json.rates ?? null;
    },
    async () => {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR,JPY,KRW');
      if (!res.ok) return null;
      const json = await res.json() as { rates?: Partial<Record<'EUR' | 'JPY' | 'KRW', number>> };
      return json.rates ?? null;
    },
    async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) return null;
      const json = await res.json() as { rates?: Record<string, number> };
      const rates = json.rates ?? {};
      return {
        EUR: rates.EUR,
        JPY: rates.JPY,
        KRW: rates.KRW,
      };
    },
  ];
  for (const fetcher of fetchers) {
    try {
      const rates = await fetcher();
      if (rates && persistRates(rates)) {
        return fxRateCache.rates[target as 'EUR' | 'JPY' | 'KRW']!;
      }
    } catch {
      // try next source
    }
  }
  if (loadPersisted()) {
    return fxRateCache.rates[target as 'EUR' | 'JPY' | 'KRW'] ?? 1;
  }
  return fxRateCache.rates[target as 'EUR' | 'JPY' | 'KRW'] ?? 1;
}
