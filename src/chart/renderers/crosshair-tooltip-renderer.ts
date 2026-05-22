import type { CandleData } from '../../types.ts';

export interface CrosshairTooltipRow {
  label: string;
  value: string;
  color: string;
}

export interface RenderCrosshairTooltipParams {
  ctx: CanvasRenderingContext2D;
  candle: CandleData;
  label: string;
  x: number;
  y: number;
  chartLeft: number;
  chartRight: number;
  mainTop: number;
  mainH: number;
  plotHeight: number;
  xAxisHeight: number;
  fontStack: string;
  rows: CrosshairTooltipRow[];
  showMobileTooltip: boolean;
}

export interface RenderCrosshairTooltipResult {
  renderedTimelineLabel: boolean;
  renderedMobileTooltip: boolean;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function renderTimelineLabel(params: RenderCrosshairTooltipParams): void {
  const { ctx, label, x, chartLeft, chartRight, plotHeight, xAxisHeight, fontStack } = params;
  ctx.save();
  ctx.font = `11px ${fontStack}`;
  const boxWidth = Math.ceil(ctx.measureText(label).width) + 16;
  const boxHeight = xAxisHeight;
  const boxX = Math.min(Math.max(chartLeft + 2, x - boxWidth / 2), chartRight - boxWidth - 2);
  const boxY = plotHeight;
  ctx.fillStyle = 'rgba(70,76,88,0.96)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5);
  ctx.restore();
}

function renderMobileTooltip(params: RenderCrosshairTooltipParams): void {
  const { ctx, label, x, y, chartRight, mainTop, mainH, fontStack, rows } = params;
  ctx.save();
  ctx.font = `600 11px ${fontStack}`;
  const padX = 9;
  const padY = 6;
  const lineHeight = 17;
  const labelWidth = 44;
  const valueWidth = Math.max(...rows.map((row) => Math.ceil(ctx.measureText(row.value).width))) + 4;
  const boxWidth = padX * 2 + labelWidth + valueWidth + 6;
  const headerHeight = lineHeight;
  const boxHeight = padY * 2 + headerHeight + rows.length * lineHeight;
  const gap = 52;
  const fitsRight = x + gap + boxWidth <= chartRight - 2;
  const boxX = fitsRight ? x + gap : x - gap - boxWidth;
  const boxY = Math.max(mainTop + 2, Math.min(y - boxHeight / 2, mainH - boxHeight - 4));

  drawRoundedRectPath(ctx, boxX, boxY, boxWidth, boxHeight, 5);
  ctx.fillStyle = 'rgba(15, 20, 32, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 80, 110, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = `600 11px ${fontStack}`;
  ctx.fillStyle = '#7a8aab';
  ctx.textAlign = 'left';
  ctx.fillText(label, boxX + padX, boxY + padY + lineHeight / 2);
  ctx.strokeStyle = 'rgba(60, 80, 110, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(boxX + 4, boxY + padY + lineHeight + 2);
  ctx.lineTo(boxX + boxWidth - 4, boxY + padY + lineHeight + 2);
  ctx.stroke();

  rows.forEach((row, index) => {
    const rowY = boxY + padY + headerHeight + index * lineHeight + lineHeight / 2;
    ctx.font = `600 11px ${fontStack}`;
    ctx.fillStyle = '#4e5d78';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, boxX + padX, rowY);
    ctx.fillStyle = row.color;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, boxX + boxWidth - padX, rowY);
  });
  ctx.restore();
}

export function renderCrosshairTooltip(params: RenderCrosshairTooltipParams): RenderCrosshairTooltipResult {
  renderTimelineLabel(params);
  if (params.showMobileTooltip) {
    renderMobileTooltip(params);
    return { renderedTimelineLabel: true, renderedMobileTooltip: true };
  }
  return { renderedTimelineLabel: true, renderedMobileTooltip: false };
}
