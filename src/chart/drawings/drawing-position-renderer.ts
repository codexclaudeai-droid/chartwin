import type { DrawingDraft, DrawingShape } from '../../ui/workspace/drawing-types.ts';
import {
  getLineDash,
  setCanvasStroke,
  type DrawingLineStyle,
  type DrawingViewportMetrics,
} from './drawing-renderer-utils.ts';

export type DrawingPositionRenderMetrics = DrawingViewportMetrics;

export interface RenderDrawingPositionParams {
  ctx: CanvasRenderingContext2D;
  shape: DrawingShape | DrawingDraft;
  isDraft: boolean;
  metrics: DrawingPositionRenderMetrics;
  alpha: number;
  strokeWidth: number;
  lineStyle: DrawingLineStyle;
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  symbol: string;
  fontStack: string;
  xForIndex: (index: number, totalSp: number, candleW: number) => number;
}

const ENTRY_COLOR = '#c7d0e2';
const STOP_COLOR = '#f23645';
const TARGET_COLOR = '#22ab94';

function getPnlCurrency(symbol: string): 'KRW' | 'USD' {
  const upper = String(symbol || '').toUpperCase();
  return upper === 'KOSPI' || upper === 'KOSDAQ' || upper === 'KOSPI200' ? 'KRW' : 'USD';
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  fill: string,
  fontStack: string,
): void {
  ctx.save();
  ctx.font = `700 12px ${fontStack}`;
  ctx.textBaseline = 'middle';
  const width = Math.ceil(ctx.measureText(text).width) + 10;
  const height = 18;
  const x = centerX - width / 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y - height / 2, width, height, 3);
  ctx.fill();
  ctx.fillStyle = '#f4f8ff';
  ctx.textAlign = 'center';
  ctx.fillText(text, centerX, y + 0.5);
  ctx.restore();
}

function drawDoubleLineBadge(
  ctx: CanvasRenderingContext2D,
  lineTop: string,
  lineBottom: string,
  centerX: number,
  centerY: number,
  fill: string,
  fontStack: string,
): void {
  ctx.save();
  ctx.font = `700 12px ${fontStack}`;
  const width = Math.max(
    Math.ceil(ctx.measureText(lineTop).width),
    Math.ceil(ctx.measureText(lineBottom).width),
  ) + 12;
  const height = 34;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 4);
  ctx.fill();
  ctx.fillStyle = '#f4f8ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lineTop, centerX, centerY - 8);
  ctx.fillText(lineBottom, centerX, centerY + 9);
  ctx.restore();
}

function drawRectHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const size = 10;
  const radius = 3;
  ctx.beginPath();
  ctx.roundRect(x - size / 2, y - size / 2, size, size, radius);
  ctx.fill();
  ctx.stroke();
}

function drawCircleHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const size = 10;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function renderDrawingPosition(params: RenderDrawingPositionParams): void {
  const {
    ctx,
    shape,
    isDraft,
    metrics,
    alpha,
    strokeWidth,
    lineStyle,
    selectedDrawingId,
    hoveredDrawingId,
    symbol,
    fontStack,
    xForIndex,
  } = params;

  const a = shape.a;
  const b = shape.b ?? shape.a;
  const isLong = shape.kind === 'long-position';
  const entryX = xForIndex(a.index, metrics.totalSp, metrics.candleW);
  const entryY = metrics.getY(a.price);
  const stopY = metrics.getY(b.price);
  const targetAnchor = ('channelOffset' in shape ? shape.channelOffset : undefined) ?? { index: 0, price: 0 };
  const targetX = xForIndex(a.index + targetAnchor.index, metrics.totalSp, metrics.candleW);
  const targetY = metrics.getY(a.price + targetAnchor.price);
  let left = Math.min(entryX, targetX);
  let right = Math.max(entryX, targetX);
  const minBoxWidthPx = 228;
  if (Math.abs(right - left) < minBoxWidthPx) {
    if (targetX >= entryX) {
      left = entryX;
      right = entryX + minBoxWidthPx;
    } else {
      right = entryX;
      left = entryX - minBoxWidthPx;
    }
  }

  const profitY = Math.min(entryY, targetY);
  const profitBottomY = Math.max(entryY, targetY);
  const lossY = Math.min(entryY, stopY);
  const lossBottomY = Math.max(entryY, stopY);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(34,171,148,0.20)';
  ctx.fillRect(left, profitY, Math.max(1, right - left), Math.max(1, profitBottomY - profitY));
  ctx.fillStyle = 'rgba(242,54,69,0.20)';
  ctx.fillRect(left, lossY, Math.max(1, right - left), Math.max(1, lossBottomY - lossY));
  ctx.restore();

  setCanvasStroke(ctx, ENTRY_COLOR, Math.max(1, strokeWidth * 0.8), [], alpha);
  ctx.beginPath();
  ctx.moveTo(left, entryY);
  ctx.lineTo(right, entryY);
  ctx.stroke();

  setCanvasStroke(ctx, STOP_COLOR, Math.max(1.1, strokeWidth * 0.9), getLineDash(lineStyle), alpha);
  ctx.beginPath();
  ctx.moveTo(left, stopY);
  ctx.lineTo(right, stopY);
  ctx.stroke();

  setCanvasStroke(ctx, TARGET_COLOR, Math.max(1.1, strokeWidth * 0.9), getLineDash(lineStyle), alpha);
  ctx.beginPath();
  ctx.moveTo(left, targetY);
  ctx.lineTo(right, targetY);
  ctx.stroke();

  if (isDraft) return;

  const shapeId = ('id' in shape) ? shape.id : null;
  const isSelected = shapeId != null && shapeId === selectedDrawingId;
  const isHovered = shapeId != null && shapeId === hoveredDrawingId;
  if (isSelected) {
    const entryPrice = a.price;
    const stopPrice = b.price;
    const targetPrice = a.price + targetAnchor.price;
    const risk = Math.abs(entryPrice - stopPrice);
    const reward = Math.abs(targetPrice - entryPrice);
    const rr = risk > 1e-8 ? reward / risk : 0;
    const positionCfg = ('position' in shape && shape.position)
      ? shape.position
      : {
          accountSize: 1000,
          riskMode: 'percent' as const,
          riskPercent: 25,
          riskAmount: 250,
          leverageEnabled: false,
          leverage: 10000,
        };
    const baseRiskBudget = positionCfg.riskMode === 'amount'
      ? Math.max(0, positionCfg.riskAmount ?? 0)
      : Math.max(0, (positionCfg.accountSize ?? 0) * ((positionCfg.riskPercent ?? 0) / 100));
    const leverageFactor = positionCfg.leverageEnabled ? Math.max(0.1, positionCfg.leverage ?? 1) : 1;
    const qty = risk > 1e-8 ? (baseRiskBudget / risk) * leverageFactor : 0;
    const closePnl = qty * reward;
    const pct = (value: number) => entryPrice !== 0
      ? `${((value / Math.abs(entryPrice)) * 100).toFixed(2)}%`
      : '';
    const fmt = (value: number) => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtMoney = (value: number) => Math.round(value).toLocaleString('ko-KR');
    const tLabelY = isLong ? (profitY - 10) : (profitBottomY + 10);
    const sLabelY = isLong ? (lossBottomY + 10) : (lossY - 10);
    const boxCenterX = (left + right) / 2;

    drawBadge(ctx, `목표 ${fmt(targetPrice)}  +${pct(reward)}`, boxCenterX, tLabelY, 'rgba(31,168,141,0.90)', fontStack);
    drawBadge(ctx, `손절 ${fmt(stopPrice)}  -${pct(risk)}`, boxCenterX, sLabelY, 'rgba(229,65,79,0.90)', fontStack);

    const rrText = rr === 1.0 ? '1 : 1' : `1 : ${rr.toFixed(1)}`;
    drawDoubleLineBadge(
      ctx,
      `청산손익 +${fmtMoney(closePnl)} (${pct(reward)}) ${getPnlCurrency(symbol)}`,
      `손익비 ${rrText}`,
      boxCenterX,
      entryY,
      'rgba(27,152,128,0.90)',
      fontStack,
    );
  }

  if (!isSelected && !isHovered) return;

  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = ENTRY_COLOR;
  drawCircleHandle(ctx, left, entryY);
  ctx.strokeStyle = STOP_COLOR;
  drawRectHandle(ctx, left, stopY);
  ctx.strokeStyle = TARGET_COLOR;
  drawRectHandle(ctx, left, targetY);
  ctx.strokeStyle = '#7a9ccf';
  drawRectHandle(ctx, right, entryY);
  ctx.restore();
}
