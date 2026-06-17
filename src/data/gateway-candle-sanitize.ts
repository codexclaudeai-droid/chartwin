import type { FootprintPriceLevel } from '../types.ts';

export type GatewayCandleDataLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  volumeDelta?: number;
  footprint?: FootprintPriceLevel[];
};

const OUTLIER_LOWER_RATIO = 0.2;
const OUTLIER_UPPER_RATIO = 5;
const CLUSTER_LOWER_RATIO = 0.65;
const CLUSTER_UPPER_RATIO = 1.55;

function normalizeSignalPrice(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function normalizeGatewayFootprint(input: unknown): FootprintPriceLevel[] | undefined {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Object.entries(input as Record<string, unknown>).map(([price, value]) => ({
        ...(value && typeof value === 'object' ? value as Record<string, unknown> : {}),
        price,
      }))
      : [];

  const normalized = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const value = row as Record<string, unknown>;
      const price = normalizeSignalPrice(value.price);
      const buyVolume = normalizeSignalPrice(value.buyVolume ?? value.buy ?? value.askVolume ?? value.ask);
      const sellVolume = normalizeSignalPrice(value.sellVolume ?? value.sell ?? value.bidVolume ?? value.bid);
      if (![price, buyVolume, sellVolume].every(Number.isFinite)) return null;
      const volumeDeltaRaw = normalizeSignalPrice(value.volumeDelta ?? value.delta);
      const totalVolumeRaw = normalizeSignalPrice(value.totalVolume ?? value.total);
      return {
        price,
        buyVolume,
        sellVolume,
        volumeDelta: Number.isFinite(volumeDeltaRaw) ? volumeDeltaRaw : buyVolume - sellVolume,
        totalVolume: Number.isFinite(totalVolumeRaw) ? totalVolumeRaw : buyVolume + sellVolume,
      };
    })
    .filter((row): row is FootprintPriceLevel => row != null)
    .sort((a, b) => a.price - b.price);

  return normalized.length ? normalized : undefined;
}

function isImplausiblePriceJump(previousClose: number, candle: GatewayCandleDataLike): boolean {
  if (!Number.isFinite(previousClose) || previousClose <= 0) return false;
  const prices = [candle.open, candle.high, candle.low, candle.close];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0) return true;
  return minPrice < previousClose * OUTLIER_LOWER_RATIO || maxPrice > previousClose * OUTLIER_UPPER_RATIO;
}

function isOutsideLatestPriceCluster(referenceClose: number, candle: GatewayCandleDataLike): boolean {
  if (!Number.isFinite(referenceClose) || referenceClose <= 0) return false;
  const prices = [candle.open, candle.high, candle.low, candle.close];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0) return true;
  return minPrice < referenceClose * CLUSTER_LOWER_RATIO || maxPrice > referenceClose * CLUSTER_UPPER_RATIO;
}

function keepLatestPlausiblePriceCluster(rows: GatewayCandleDataLike[]): GatewayCandleDataLike[] {
  if (rows.length < 2) return rows;
  let startIndex = rows.length - 1;
  let referenceClose = rows[startIndex]?.close;
  for (let i = rows.length - 2; i >= 0; i -= 1) {
    const candle = rows[i];
    if (isOutsideLatestPriceCluster(referenceClose, candle)) break;
    startIndex = i;
    referenceClose = candle.close;
  }
  return rows.slice(startIndex);
}

export function sanitizeGatewayCandles(rows: unknown): GatewayCandleDataLike[] {
  if (!Array.isArray(rows)) return [];
  const parsed = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const value = row as Record<string, unknown>;
      const time = normalizeSignalPrice(value.time);
      const open = normalizeSignalPrice(value.open);
      const high = normalizeSignalPrice(value.high);
      const low = normalizeSignalPrice(value.low);
      const close = normalizeSignalPrice(value.close);
      const volume = normalizeSignalPrice(value.volume);
      if (![time, open, high, low, close, volume].every((numeric) => Number.isFinite(numeric))) return null;
      const candle: GatewayCandleDataLike = {
        time: Math.floor(time),
        open,
        high,
        low,
        close,
        volume,
      };
      const buyVolume = normalizeSignalPrice(value.buyVolume);
      const sellVolume = normalizeSignalPrice(value.sellVolume);
      const volumeDelta = normalizeSignalPrice(value.volumeDelta);
      if (Number.isFinite(buyVolume)) candle.buyVolume = buyVolume;
      if (Number.isFinite(sellVolume)) candle.sellVolume = sellVolume;
      if (Number.isFinite(volumeDelta)) {
        candle.volumeDelta = volumeDelta;
      } else if (Number.isFinite(buyVolume) && Number.isFinite(sellVolume)) {
        candle.volumeDelta = buyVolume - sellVolume;
      }
      const footprint = normalizeGatewayFootprint(value.footprint);
      if (footprint) candle.footprint = footprint;
      return candle;
    })
    .filter((item): item is GatewayCandleDataLike => item != null)
    .sort((a, b) => a.time - b.time);

  const deduped = new Map<number, GatewayCandleDataLike>();
  parsed.forEach((item) => {
    deduped.set(item.time, item);
  });

  const filtered: GatewayCandleDataLike[] = [];
  for (const candle of deduped.values()) {
    const previousClose = filtered[filtered.length - 1]?.close;
    if (isImplausiblePriceJump(previousClose, candle)) continue;
    filtered.push(candle);
  }
  return keepLatestPlausiblePriceCluster(filtered).sort((a, b) => a.time - b.time);
}
