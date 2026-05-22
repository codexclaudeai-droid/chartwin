export type XauGridMode = 'geometric' | 'arithmetic';

export interface XauGridLongConfig {
  highPrice: number;
  lowPrice: number;
  nLevels: number;
  gridMode: XauGridMode;
  investment: number;
}

export interface XauGridLongBarMeta {
  buyLevels: number[];
  sellLevels: number[];
  ownedCount: number;
  avgEntry: number | null;
  deployedCapital: number;
  openQty: number;
  openPnl: number;
  eventType: 'buy' | 'sell' | 'mixed' | 'none';
  botPayloadHint: {
    action: 'buy' | 'sell' | 'none' | 'mixed';
    buyLevels: number[];
    sellLevels: number[];
    ownedCount: number;
    avgEntry: number | null;
  };
}

export interface XauGridLongResult {
  signals: number[];
  levels: number[];
  bars: XauGridLongBarMeta[];
  config: XauGridLongConfig;
}

const DEFAULT_XAU_GRID_LONG_CONFIG: XauGridLongConfig = {
  highPrice: 4857.27,
  lowPrice: 3568.69,
  nLevels: 48,
  gridMode: 'geometric',
  investment: 2000,
};

const EPSILON = 1e-10;

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveXauGridLongConfig(rawParams: Record<string, unknown> = {}): XauGridLongConfig {
  const highPrice = Math.max(toFiniteNumber(rawParams.highPrice, DEFAULT_XAU_GRID_LONG_CONFIG.highPrice), 0.0000001);
  const lowSeed = Math.max(toFiniteNumber(rawParams.lowPrice, DEFAULT_XAU_GRID_LONG_CONFIG.lowPrice), 0.0000001);
  const lowPrice = Math.min(lowSeed, highPrice);
  const nLevels = Math.max(5, Math.min(50, Math.round(toFiniteNumber(rawParams.nLevels, DEFAULT_XAU_GRID_LONG_CONFIG.nLevels))));
  const gridMode = String(rawParams.gridMode || DEFAULT_XAU_GRID_LONG_CONFIG.gridMode).toLowerCase() === 'arithmetic'
    ? 'arithmetic'
    : 'geometric';
  const investment = Math.max(toFiniteNumber(rawParams.investment, DEFAULT_XAU_GRID_LONG_CONFIG.investment), 0);
  return { highPrice, lowPrice, nLevels, gridMode, investment };
}

export function buildXauGridLevels(configInput: XauGridLongConfig): number[] {
  const config = resolveXauGridLongConfig(configInput as unknown as Record<string, unknown>);
  const { highPrice, lowPrice, nLevels, gridMode } = config;
  const levels: number[] = [];
  for (let i = 0; i < nLevels; i += 1) {
    const pct = nLevels <= 1 ? 0 : i / (nLevels - 1);
    const level = gridMode === 'geometric'
      ? highPrice * Math.pow(lowPrice / highPrice, pct)
      : highPrice - (highPrice - lowPrice) * pct;
    levels.push(level);
  }
  return levels;
}

function createBarMeta(): XauGridLongBarMeta {
  return {
    buyLevels: [],
    sellLevels: [],
    ownedCount: 0,
    avgEntry: null,
    deployedCapital: 0,
    openQty: 0,
    openPnl: 0,
    eventType: 'none',
    botPayloadHint: {
      action: 'none',
      buyLevels: [],
      sellLevels: [],
      ownedCount: 0,
      avgEntry: null,
    },
  };
}

export function simulateXauGridLong(close: Array<number | null | undefined>, rawParams: Record<string, unknown> = {}): XauGridLongResult {
  const prices = Array.isArray(close) ? close.map((value) => Number(value)) : [];
  const config = resolveXauGridLongConfig(rawParams);
  const levels = buildXauGridLevels(config);
  const signals = new Array(prices.length).fill(0);
  const bars = prices.map(() => createBarMeta());
  const owned = new Array(config.nLevels).fill(false);
  const usdtPerLevel = config.nLevels > 0 ? config.investment / config.nLevels : 0;
  let totalCost = 0;
  let totalQty = 0;

  for (let barIndex = 0; barIndex < prices.length; barIndex += 1) {
    const meta = bars[barIndex];
    const currentClose = prices[barIndex];
    if (!Number.isFinite(currentClose)) continue;

    if (barIndex > 0) {
      const prevClose = Number.isFinite(prices[barIndex - 1]) ? prices[barIndex - 1] : currentClose;
      for (let levelIndex = 1; levelIndex < config.nLevels; levelIndex += 1) {
        const levelPx = levels[levelIndex];
        const upperPx = levels[levelIndex - 1];

        if (!owned[levelIndex] && prevClose > levelPx && currentClose <= levelPx) {
          owned[levelIndex] = true;
          totalCost += usdtPerLevel;
          totalQty += levelPx > 0 ? usdtPerLevel / levelPx : 0;
          meta.buyLevels.push(levelIndex);
        }

        if (owned[levelIndex] && prevClose < upperPx && currentClose >= upperPx) {
          owned[levelIndex] = false;
          totalCost -= usdtPerLevel;
          totalQty -= levelPx > 0 ? usdtPerLevel / levelPx : 0;
          meta.sellLevels.push(levelIndex);
        }
      }
    }

    if (Math.abs(totalCost) <= EPSILON) totalCost = 0;
    if (Math.abs(totalQty) <= EPSILON) totalQty = 0;

    let ownedCount = 0;
    for (let levelIndex = 0; levelIndex < config.nLevels; levelIndex += 1) {
      if (owned[levelIndex]) ownedCount += 1;
    }

    const avgEntry = totalQty > 0 ? totalCost / totalQty : null;
    const openPnl = totalQty > 0 && avgEntry != null ? (currentClose - avgEntry) * totalQty : 0;
    const hasBuy = meta.buyLevels.length > 0;
    const hasSell = meta.sellLevels.length > 0;
    const eventType = hasBuy && hasSell
      ? 'mixed'
      : (hasBuy ? 'buy' : (hasSell ? 'sell' : 'none'));

    meta.ownedCount = ownedCount;
    meta.avgEntry = avgEntry;
    meta.deployedCapital = totalCost;
    meta.openQty = totalQty;
    meta.openPnl = openPnl;
    meta.eventType = eventType;
    meta.botPayloadHint = {
      action: eventType,
      buyLevels: [...meta.buyLevels],
      sellLevels: [...meta.sellLevels],
      ownedCount,
      avgEntry,
    };

    if (hasBuy && !hasSell) {
      signals[barIndex] = 1;
    } else if (hasSell && !hasBuy) {
      signals[barIndex] = -1;
    } else if (hasBuy && hasSell) {
      const lastBuy = meta.buyLevels[meta.buyLevels.length - 1] ?? -1;
      const lastSell = meta.sellLevels[meta.sellLevels.length - 1] ?? -1;
      signals[barIndex] = lastSell >= lastBuy ? -1 : 1;
    }
  }

  return { signals, levels, bars, config };
}
