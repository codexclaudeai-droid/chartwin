import type { CandleData, FootprintPriceLevel } from '../../types.ts';
import { toRgba } from '../color-utils.ts';

export interface RenderFootprintOverlayParams {
  ctx: CanvasRenderingContext2D;
  candles: CandleData[];
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSpacing: number;
  candleWidth: number;
  mainHeight: number;
  getY: (price: number) => number;
  fontStack: string;
  maxLevels?: number;
  priceStep?: number;
  showSummary?: boolean;
}

const MIN_FOOTPRINT_SLOT_WIDTH = 48;
const MAX_LEVELS_PER_VISIBLE_CANDLE = 18;

export function formatFootprintVolume(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const format = (scaled: number, suffix = ''): string => {
    const fixed = scaled.toFixed(2);
    const trimmed = fixed.replace(/\.?0+$/, '');
    return `${sign}${trimmed}${suffix}`;
  };
  if (abs >= 1_000_000) return format(abs / 1_000_000, 'M');
  if (abs >= 1_000) return format(abs / 1_000, 'K');
  return format(abs);
}

function normalizeFootprintDisplayPrice(price: number, priceStep: number): number {
  if (!Number.isFinite(price)) return NaN;
  const step = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0;
  if (step <= 0) return price;
  const decimals = Math.max(0, Math.min(8, Math.ceil(Math.log10(1 / step))));
  return Number((Math.round(price / step) * step).toFixed(decimals));
}

function groupFootprintLevelsByPriceStep(
  levels: FootprintPriceLevel[],
  priceStep: number,
): FootprintPriceLevel[] {
  const step = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0;
  if (step <= 0) return levels;
  const grouped = new Map<number, FootprintPriceLevel>();
  for (const level of levels) {
    const price = normalizeFootprintDisplayPrice(level.price, step);
    if (!Number.isFinite(price)) continue;
    const current = grouped.get(price);
    if (current) {
      current.buyVolume += level.buyVolume;
      current.sellVolume += level.sellVolume;
      current.volumeDelta += level.volumeDelta;
      current.totalVolume += level.totalVolume;
    } else {
      grouped.set(price, { ...level, price });
    }
  }
  return [...grouped.values()].sort((a, b) => b.price - a.price);
}

function getVisibleFootprintLevels(
  levels: FootprintPriceLevel[],
  getY: (price: number) => number,
  mainHeight: number,
  maxLevels: number,
): Array<FootprintPriceLevel & { y: number }> {
  const visible: Array<FootprintPriceLevel & { y: number }> = [];
  for (const level of levels) {
    const y = getY(level.price);
    if (!Number.isFinite(y) || y < -12 || y > mainHeight + 12) continue;
    visible.push({ ...level, y });
  }
  const limit = Math.max(1, Math.min(40, Math.floor(maxLevels || MAX_LEVELS_PER_VISIBLE_CANDLE)));
  if (visible.length <= limit) return visible;
  visible.sort((a, b) => b.totalVolume - a.totalVolume);
  const trimmed = visible.slice(0, limit);
  trimmed.sort((a, b) => b.price - a.price);
  return trimmed;
}

export function renderFootprintOverlay(params: RenderFootprintOverlayParams): void {
  const {
    ctx,
    candles,
    chartLeft,
    chartRight,
    effectiveChartLeft,
    totalSpacing,
    candleWidth,
    mainHeight,
    getY,
    fontStack,
    maxLevels = MAX_LEVELS_PER_VISIBLE_CANDLE,
    priceStep = 0,
    showSummary = true,
  } = params;

  if (totalSpacing < MIN_FOOTPRINT_SLOT_WIDTH || candleWidth < 2) return;

  const rowHeight = Math.max(10, Math.min(16, totalSpacing * 0.52));
  const halfRow = rowHeight / 2;
  const centerXOffset = candleWidth / 2;
  const sideGap = Math.max(2, Math.min(6, candleWidth * 0.12));
  const sideWidth = Math.max(12, Math.min(Math.max(8, (totalSpacing - candleWidth) / 2 - sideGap - 2), totalSpacing * 0.38));
  const summaryOffset = Math.max(20, Math.min(46, totalSpacing * 0.95));

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, 0, Math.max(1, chartRight - chartLeft), Math.max(1, mainHeight));
  ctx.clip();
  ctx.font = `600 10px ${fontStack}`;
  ctx.textBaseline = 'middle';

  candles.forEach((candle, index) => {
    const levels = candle.footprint;
    if (!levels?.length) return;

    const x = effectiveChartLeft + index * totalSpacing;
    const candleCenter = x + centerXOffset;
    const left = candleCenter - totalSpacing / 2;
    const right = candleCenter + totalSpacing / 2;
    if (right < chartLeft || left > chartRight) return;

    const displayLevels = groupFootprintLevelsByPriceStep(levels, priceStep);
    if (!displayLevels.length) return;
    const maxSideVolume = Math.max(...displayLevels.flatMap((level) => [level.buyVolume, level.sellVolume]), 1);
    const visibleLevels = getVisibleFootprintLevels(displayLevels, getY, mainHeight, maxLevels);
    const bidTotal = displayLevels.reduce((sum, level) => sum + level.sellVolume, 0);
    const askTotal = displayLevels.reduce((sum, level) => sum + level.buyVolume, 0);
    const delta = askTotal - bidTotal;
    const total = askTotal + bidTotal;
    for (const level of visibleLevels) {
      const bidWidth = Math.max(0, sideWidth * Math.min(1, level.sellVolume / maxSideVolume));
      const askWidth = Math.max(0, sideWidth * Math.min(1, level.buyVolume / maxSideVolume));

      if (bidWidth > 0) {
        ctx.fillStyle = toRgba('#f23645', 0.42, 'rgba(242,54,69,0.42)');
        ctx.fillRect(candleCenter - sideGap - bidWidth, level.y - halfRow, bidWidth, rowHeight);
      }
      if (askWidth > 0) {
        ctx.fillStyle = toRgba('#22ab94', 0.42, 'rgba(34,171,148,0.42)');
        ctx.fillRect(candleCenter + sideGap, level.y - halfRow, askWidth, rowHeight);
      }

      ctx.fillStyle = 'rgba(252, 211, 211, 0.94)';
      ctx.textAlign = 'right';
      ctx.fillText(formatFootprintVolume(level.sellVolume), candleCenter - sideGap - 2, level.y);
      ctx.fillStyle = 'rgba(187, 247, 208, 0.94)';
      ctx.textAlign = 'left';
      ctx.fillText(formatFootprintVolume(level.buyVolume), candleCenter + sideGap + 2, level.y);
    }

    if (showSummary) {
      const lowY = getY(candle.low);
      const summaryY = Math.min(mainHeight - 7, Math.max(12, lowY + summaryOffset));
      ctx.font = `700 10px ${fontStack}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(252, 211, 211, 0.96)';
      ctx.fillText(formatFootprintVolume(bidTotal), candleCenter - sideGap - 2, summaryY);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(187, 247, 208, 0.96)';
      ctx.fillText(formatFootprintVolume(askTotal), candleCenter + sideGap + 2, summaryY);

      ctx.textAlign = 'center';
      ctx.font = `700 10px ${fontStack}`;
      ctx.fillStyle = delta >= 0 ? 'rgba(45, 212, 191, 0.96)' : 'rgba(248, 113, 113, 0.96)';
      ctx.fillText(`Delta ${formatFootprintVolume(delta)}`, candleCenter, Math.min(mainHeight - 7, summaryY + 13));
      ctx.fillStyle = 'rgba(226, 232, 240, 0.94)';
      ctx.fillText(`Total ${formatFootprintVolume(total)}`, candleCenter, Math.min(mainHeight - 7, summaryY + 26));
      ctx.font = `600 10px ${fontStack}`;
    }
  });

  ctx.restore();
}
