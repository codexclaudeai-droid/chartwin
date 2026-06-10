import type { FootprintPriceLevel } from '../../types.ts';

export type FootprintTradeSide = 'buy' | 'sell' | 'unknown';

const MAX_FOOTPRINT_LEVELS_PER_CANDLE = 160;

export interface FootprintTradeInput {
  price: number;
  quantity: number;
  side: FootprintTradeSide;
  priceStep?: number;
}

export function normalizeFootprintPrice(price: number, priceStep = 0): number {
  if (!Number.isFinite(price)) return NaN;
  const step = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0;
  if (step <= 0) return price;
  const decimals = Math.max(0, Math.min(8, Math.ceil(Math.log10(1 / step))));
  return Number((Math.round(price / step) * step).toFixed(decimals));
}

export function applyFootprintTrade(
  levels: FootprintPriceLevel[] | undefined,
  input: FootprintTradeInput,
): FootprintPriceLevel[] {
  const price = normalizeFootprintPrice(input.price, input.priceStep);
  const qty = Number(input.quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return levels ? levels.slice() : [];
  const next = levels ? levels.map((level) => ({ ...level })) : [];
  const index = next.findIndex((level) => level.price === price);
  const buyVolume = input.side === 'buy' ? qty : 0;
  const sellVolume = input.side === 'sell' ? qty : 0;
  const volumeDelta = buyVolume - sellVolume;
  if (index >= 0) {
    const current = next[index];
    current.buyVolume += buyVolume;
    current.sellVolume += sellVolume;
    current.volumeDelta += volumeDelta;
    current.totalVolume += qty;
  } else {
    next.push({
      price,
      buyVolume,
      sellVolume,
      volumeDelta,
      totalVolume: qty,
    });
  }
  next.sort((a, b) => b.price - a.price);
  if (next.length > MAX_FOOTPRINT_LEVELS_PER_CANDLE) {
    next.sort((a, b) => b.totalVolume - a.totalVolume);
    next.length = MAX_FOOTPRINT_LEVELS_PER_CANDLE;
    next.sort((a, b) => b.price - a.price);
  }
  return next;
}

export function getFootprintTradeSide(isBuyerMaker: boolean | null): FootprintTradeSide {
  if (isBuyerMaker === true) return 'sell';
  if (isBuyerMaker === false) return 'buy';
  return 'unknown';
}
