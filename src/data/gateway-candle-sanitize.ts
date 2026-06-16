export type GatewayCandleDataLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const OUTLIER_LOWER_RATIO = 0.2;
const OUTLIER_UPPER_RATIO = 5;

function normalizeSignalPrice(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function isImplausiblePriceJump(previousClose: number, candle: GatewayCandleDataLike): boolean {
  if (!Number.isFinite(previousClose) || previousClose <= 0) return false;
  const prices = [candle.open, candle.high, candle.low, candle.close];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0) return true;
  return minPrice < previousClose * OUTLIER_LOWER_RATIO || maxPrice > previousClose * OUTLIER_UPPER_RATIO;
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
      return {
        time: Math.floor(time),
        open,
        high,
        low,
        close,
        volume,
      };
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
  return filtered.sort((a, b) => a.time - b.time);
}
