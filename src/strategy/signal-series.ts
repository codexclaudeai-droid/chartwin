export function normalizeSignalSeriesLength(signals: readonly unknown[], candleCount: number): number[] {
  const normalizedCount = Math.max(0, Math.floor(Number(candleCount) || 0));
  const normalized = new Array<number>(normalizedCount).fill(0);
  if (!Array.isArray(signals) || normalizedCount === 0) return normalized;

  const limit = Math.min(normalizedCount, signals.length);
  for (let i = 0; i < limit; i += 1) {
    const value = Number(signals[i] ?? 0);
    normalized[i] = Number.isFinite(value) ? (value > 0 ? 1 : value < 0 ? -1 : 0) : 0;
  }
  return normalized;
}
