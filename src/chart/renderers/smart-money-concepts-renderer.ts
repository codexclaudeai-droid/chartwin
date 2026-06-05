import type {
  SmartMoneyConceptsEqualLevel,
  SmartMoneyConceptsFairValueGap,
  SmartMoneyConceptsOrderBlock,
  SmartMoneyConceptsResult,
  SmartMoneyConceptsStructureEvent,
} from '../indicators/smart-money-concepts.ts';

export interface SmartMoneyConceptsRenderStyle {
  color: string;
  width: number;
  dash: number[];
}

export interface SmartMoneyConceptsRenderParams {
  ctx: CanvasRenderingContext2D;
  data: SmartMoneyConceptsResult;
  candles: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  lastDataIndex: number;
  chartLeft: number;
  chartRight: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  top: number;
  bottom: number;
  fontStack: string;
  getY: (price: number) => number;
  bullishStyle: SmartMoneyConceptsRenderStyle;
  bearishStyle: SmartMoneyConceptsRenderStyle;
  internalBullishStyle: SmartMoneyConceptsRenderStyle;
  internalBearishStyle: SmartMoneyConceptsRenderStyle;
  equalStyle: SmartMoneyConceptsRenderStyle;
  internalOrderBlockBullColor: string;
  internalOrderBlockBearColor: string;
  swingOrderBlockBullColor: string;
  swingOrderBlockBearColor: string;
  fairValueGapBullColor: string;
  fairValueGapBearColor: string;
  premiumZoneColor: string;
  equilibriumZoneColor: string;
  discountZoneColor: string;
  internalBullishFilter: 'All' | 'BOS' | 'CHoCH';
  internalBearishFilter: 'All' | 'BOS' | 'CHoCH';
  swingBullishFilter: 'All' | 'BOS' | 'CHoCH';
  swingBearishFilter: 'All' | 'BOS' | 'CHoCH';
  showStructure: boolean;
  showInternal: boolean;
  showEqualLevels: boolean;
  showOrderBlocks: boolean;
  showFairValueGaps: boolean;
  fairValueGapsExtend: number;
  showHighLowSwings: boolean;
  showZones: boolean;
}

function xForIndex(params: Pick<SmartMoneyConceptsRenderParams, 'startIndex' | 'effectiveChartLeft' | 'totalSp' | 'candleW'>, index: number): number {
  return params.effectiveChartLeft + (index - params.startIndex) * params.totalSp + params.candleW / 2;
}

function isVisibleRange(startIndex: number, visLength: number, leftIndex: number, rightIndex: number): boolean {
  const visStart = startIndex;
  const visEnd = startIndex + visLength - 1;
  return rightIndex >= visStart && leftIndex <= visEnd;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontStack: string): void {
  ctx.font = `10px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function fillColor(source: string, fallbackAlpha: number): string {
  if (/^rgba\(/i.test(source)) return source;
  const hex = source.trim();
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return source;
  const raw = match[1];
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${fallbackAlpha})`;
}

function renderStructureEvent(params: SmartMoneyConceptsRenderParams, event: SmartMoneyConceptsStructureEvent): void {
  if (!isVisibleRange(params.startIndex, params.visLength, event.pivotIndex, event.breakIndex)) return;
  if (event.scope === 'internal' && !params.showInternal) return;
  if (event.scope === 'swing' && !params.showStructure) return;
  const filter = event.scope === 'internal'
    ? event.bias === 'bullish' ? params.internalBullishFilter : params.internalBearishFilter
    : event.bias === 'bullish' ? params.swingBullishFilter : params.swingBearishFilter;
  if (filter !== 'All' && filter !== event.kind) return;

  const style = event.scope === 'internal'
    ? event.bias === 'bullish' ? params.internalBullishStyle : params.internalBearishStyle
    : event.bias === 'bullish' ? params.bullishStyle : params.bearishStyle;
  const y = params.getY(event.level);
  const x1 = xForIndex(params, event.pivotIndex);
  const x2 = xForIndex(params, event.breakIndex);
  const labelX = (x1 + x2) / 2;
  const labelY = y + (event.bias === 'bullish' ? -10 : 10);

  params.ctx.save();
  params.ctx.strokeStyle = style.color;
  params.ctx.lineWidth = style.width;
  params.ctx.setLineDash(event.scope === 'internal' ? [5, 4] : style.dash);
  params.ctx.beginPath();
  params.ctx.moveTo(x1, y);
  params.ctx.lineTo(x2, y);
  params.ctx.stroke();
  params.ctx.setLineDash([]);
  drawText(params.ctx, event.kind, labelX, labelY, style.color, params.fontStack);
  params.ctx.restore();
}

function renderEqualLevel(params: SmartMoneyConceptsRenderParams, level: SmartMoneyConceptsEqualLevel): void {
  if (!params.showEqualLevels || !isVisibleRange(params.startIndex, params.visLength, level.leftIndex, level.rightIndex)) return;
  const x1 = xForIndex(params, level.leftIndex);
  const x2 = xForIndex(params, level.rightIndex);
  const y = params.getY(level.level);
  const labelY = y + (level.kind === 'EQH' ? -10 : 10);

  params.ctx.save();
  params.ctx.strokeStyle = params.equalStyle.color;
  params.ctx.lineWidth = params.equalStyle.width;
  params.ctx.setLineDash(params.equalStyle.dash.length ? params.equalStyle.dash : [2, 3]);
  params.ctx.beginPath();
  params.ctx.moveTo(x1, y);
  params.ctx.lineTo(x2, y);
  params.ctx.stroke();
  params.ctx.setLineDash([]);
  drawText(params.ctx, level.kind, (x1 + x2) / 2, labelY, params.equalStyle.color, params.fontStack);
  params.ctx.restore();
}

function renderBox(
  params: SmartMoneyConceptsRenderParams,
  leftIndex: number,
  rightIndex: number,
  topPrice: number,
  bottomPrice: number,
  color: string,
): void {
  if (!isVisibleRange(params.startIndex, params.visLength, leftIndex, rightIndex)) return;
  const x1 = Math.max(params.chartLeft, xForIndex(params, leftIndex) - params.candleW / 2);
  const x2 = Math.min(params.chartRight, xForIndex(params, rightIndex) + params.candleW / 2);
  const y1 = params.getY(topPrice);
  const y2 = params.getY(bottomPrice);
  const top = Math.min(y1, y2);
  const height = Math.max(1, Math.abs(y2 - y1));

  params.ctx.save();
  params.ctx.fillStyle = color;
  params.ctx.strokeStyle = color;
  params.ctx.lineWidth = 1;
  params.ctx.fillRect(x1, top, Math.max(1, x2 - x1), height);
  params.ctx.strokeRect(x1, top, Math.max(1, x2 - x1), height);
  params.ctx.restore();
}

function renderOrderBlock(params: SmartMoneyConceptsRenderParams, block: SmartMoneyConceptsOrderBlock): void {
  if (!params.showOrderBlocks) return;
  const color = block.scope === 'internal'
    ? block.bias === 'bullish' ? params.internalOrderBlockBullColor : params.internalOrderBlockBearColor
    : block.bias === 'bullish' ? params.swingOrderBlockBullColor : params.swingOrderBlockBearColor;
  renderBox(
    params,
    block.leftIndex,
    params.startIndex + params.visLength - 1,
    block.high,
    block.low,
    fillColor(color, block.scope === 'internal' ? 0.2 : 0.18),
  );
}

function renderFairValueGap(params: SmartMoneyConceptsRenderParams, gap: SmartMoneyConceptsFairValueGap): void {
  if (!params.showFairValueGaps) return;
  renderBox(
    params,
    gap.leftIndex,
    gap.rightIndex + Math.max(0, Math.floor(params.fairValueGapsExtend)),
    gap.top,
    gap.bottom,
    fillColor(gap.bias === 'bullish' ? params.fairValueGapBullColor : params.fairValueGapBearColor, 0.25),
  );
}

function renderZones(params: SmartMoneyConceptsRenderParams): void {
  if (!params.showZones) return;
  const lastVisible = params.startIndex + params.visLength - 1;
  const leftIndex = Math.max(params.startIndex, lastVisible - Math.max(12, Math.floor(params.visLength * 0.22)));
  if (params.data.zones.premium) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.premium.top, params.data.zones.premium.bottom, fillColor(params.premiumZoneColor, 0.12));
  }
  if (params.data.zones.equilibrium) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.equilibrium.top, params.data.zones.equilibrium.bottom, fillColor(params.equilibriumZoneColor, 0.12));
  }
  if (params.data.zones.discount) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.discount.top, params.data.zones.discount.bottom, fillColor(params.discountZoneColor, 0.12));
  }
}

function renderHighLowSwings(params: SmartMoneyConceptsRenderParams): void {
  if (!params.showHighLowSwings || !params.showStructure) return;
  const lastSwingStructure = [...params.data.structures].reverse().find((event) => event.scope === 'swing');
  if (!lastSwingStructure) return;

  const lastSwingHigh = [...params.data.pivots].reverse().find((pivot) => pivot.scope === 'swing' && pivot.kind === 'high');
  const lastSwingLow = [...params.data.pivots].reverse().find((pivot) => pivot.scope === 'swing' && pivot.kind === 'low');
  const lastVisible = params.startIndex + params.visLength - 1;
  const rightIndex = Math.min(lastVisible, Math.max(0, params.lastDataIndex));

  const findExtreme = (fromIndex: number, toIndex: number, kind: 'high' | 'low') => {
    const start = Math.max(0, Math.min(fromIndex, toIndex));
    const end = Math.min(params.candles.length - 1, Math.max(fromIndex, toIndex));
    let extremeIndex = start;
    let extremeLevel = kind === 'high' ? -Infinity : Infinity;
    for (let index = start; index <= end; index += 1) {
      const candle = params.candles[index];
      if (!candle) continue;
      const level = kind === 'high' ? candle.high : candle.low;
      if ((kind === 'high' && level >= extremeLevel) || (kind === 'low' && level <= extremeLevel)) {
        extremeIndex = index;
        extremeLevel = level;
      }
    }
    if (!Number.isFinite(extremeLevel)) return null;
    return { index: extremeIndex, level: extremeLevel };
  };

  const drawLevel = (
    level: { index: number; level: number } | null,
    label: string,
    color: string,
    labelOffset: number,
  ) => {
    if (!level || level.index > rightIndex || !isVisibleRange(params.startIndex, params.visLength, level.index, rightIndex)) return;
    const y = params.getY(level.level);
    const x1 = xForIndex(params, level.index);
    const x2 = Math.min(params.chartRight - 4, xForIndex(params, rightIndex));
    const labelX = Math.max(x1, x2 - 28);
    params.ctx.save();
    params.ctx.strokeStyle = color;
    params.ctx.lineWidth = 1;
    params.ctx.setLineDash([]);
    params.ctx.beginPath();
    params.ctx.moveTo(x1, y);
    params.ctx.lineTo(x2, y);
    params.ctx.stroke();
    drawText(params.ctx, label, labelX, y + labelOffset, color, params.fontStack);
    params.ctx.restore();
  };

  if (lastSwingStructure.bias === 'bullish') {
    const weakHigh = lastSwingLow ? findExtreme(lastSwingLow.index, rightIndex, 'high') : lastSwingHigh;
    drawLevel(weakHigh, 'Weak High', params.bullishStyle.color, -12);
    drawLevel(lastSwingLow, 'Strong Low', params.bullishStyle.color, 12);
  } else {
    drawLevel(lastSwingHigh, 'Strong High', params.bearishStyle.color, -12);
    const weakLow = lastSwingHigh ? findExtreme(lastSwingHigh.index, rightIndex, 'low') : lastSwingLow;
    drawLevel(weakLow, 'Weak Low', params.bullishStyle.color, 12);
  }
}

export function renderSmartMoneyConcepts(params: SmartMoneyConceptsRenderParams): void {
  const { ctx, chartLeft, chartRight, top, bottom } = params;
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, top, Math.max(1, chartRight - chartLeft), Math.max(1, bottom - top));
  ctx.clip();

  renderZones(params);
  params.data.fairValueGaps.forEach((gap) => renderFairValueGap(params, gap));
  params.data.orderBlocks.forEach((block) => renderOrderBlock(params, block));
  params.data.equalLevels.forEach((level) => renderEqualLevel(params, level));
  params.data.structures.forEach((event) => renderStructureEvent(params, event));
  renderHighLowSwings(params);

  ctx.restore();
}
