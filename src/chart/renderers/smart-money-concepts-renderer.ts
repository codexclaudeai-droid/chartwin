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
  startIndex: number;
  visLength: number;
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
  orderBlockBullColor: string;
  orderBlockBearColor: string;
  fairValueGapBullColor: string;
  fairValueGapBearColor: string;
  showStructure: boolean;
  showInternal: boolean;
  showEqualLevels: boolean;
  showOrderBlocks: boolean;
  showFairValueGaps: boolean;
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

function renderStructureEvent(params: SmartMoneyConceptsRenderParams, event: SmartMoneyConceptsStructureEvent): void {
  if (!isVisibleRange(params.startIndex, params.visLength, event.pivotIndex, event.breakIndex)) return;
  if (event.scope === 'internal' && !params.showInternal) return;
  if (event.scope === 'swing' && !params.showStructure) return;

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
  renderBox(
    params,
    block.leftIndex,
    params.startIndex + params.visLength - 1,
    block.high,
    block.low,
    block.bias === 'bullish' ? params.orderBlockBullColor : params.orderBlockBearColor,
  );
}

function renderFairValueGap(params: SmartMoneyConceptsRenderParams, gap: SmartMoneyConceptsFairValueGap): void {
  if (!params.showFairValueGaps) return;
  renderBox(
    params,
    gap.leftIndex,
    gap.rightIndex,
    gap.top,
    gap.bottom,
    gap.bias === 'bullish' ? params.fairValueGapBullColor : params.fairValueGapBearColor,
  );
}

function renderZones(params: SmartMoneyConceptsRenderParams): void {
  if (!params.showZones) return;
  const lastVisible = params.startIndex + params.visLength - 1;
  const leftIndex = Math.max(params.startIndex, lastVisible - Math.max(12, Math.floor(params.visLength * 0.22)));
  if (params.data.zones.premium) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.premium.top, params.data.zones.premium.bottom, 'rgba(242,54,69,0.12)');
  }
  if (params.data.zones.equilibrium) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.equilibrium.top, params.data.zones.equilibrium.bottom, 'rgba(135,139,148,0.12)');
  }
  if (params.data.zones.discount) {
    renderBox(params, leftIndex, lastVisible, params.data.zones.discount.top, params.data.zones.discount.bottom, 'rgba(8,153,129,0.12)');
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

  ctx.restore();
}
