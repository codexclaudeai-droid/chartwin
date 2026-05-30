import { toRgba } from '../color-utils.ts';

export interface SubPanelCrosshairAddButton {
  panelId: string;
  value: number;
  color: string;
  x: number;
  y: number;
  r: number;
}

export interface RenderSubPanelCrosshairAxisParams {
  ctx: CanvasRenderingContext2D;
  panelId: string;
  value: number;
  labelText: string;
  accentColor: string;
  width: number;
  panelTop: number;
  panelHeight: number;
  clampedY: number;
  axisSide: 'left' | 'right';
  axisLeft: number;
  axisRight: number;
  fontStack: string;
}

export function renderSubPanelCrosshairAxis(params: RenderSubPanelCrosshairAxisParams): SubPanelCrosshairAddButton {
  const {
    ctx,
    panelId,
    value,
    labelText,
    accentColor,
    width,
    panelTop,
    panelHeight,
    clampedY,
    axisSide,
    axisLeft,
    axisRight,
    fontStack,
  } = params;

  ctx.save();
  ctx.font = `600 12px ${fontStack}`;
  const boxWidth = Math.ceil(ctx.measureText(labelText).width) + 12;
  const boxHeight = 18;
  const boxX = axisSide === 'left' ? 2 : width - boxWidth - 2;
  const boxY = Math.max(panelTop + 2, Math.min(panelTop + panelHeight - boxHeight - 2, clampedY - boxHeight / 2));
  const plusRadius = 9;
  const plusX = axisSide === 'left'
    ? (axisRight + plusRadius + 4)
    : (axisLeft - plusRadius - 4);
  const plusY = boxY + boxHeight / 2;

  ctx.fillStyle = toRgba(accentColor, 0.28, 'rgba(80,90,110,0.28)');
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, boxX + boxWidth / 2, boxY + boxHeight / 2 + 0.5);

  ctx.beginPath();
  ctx.fillStyle = 'rgba(14,20,31,0.96)';
  ctx.strokeStyle = toRgba(accentColor, 0.95, '#7aa2ff');
  ctx.lineWidth = 1.2;
  ctx.arc(plusX, plusY, plusRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f2f6ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plusX - 3.2, plusY);
  ctx.lineTo(plusX + 3.2, plusY);
  ctx.moveTo(plusX, plusY - 3.2);
  ctx.lineTo(plusX, plusY + 3.2);
  ctx.stroke();
  ctx.restore();

  return {
    panelId,
    value,
    color: accentColor,
    x: plusX,
    y: plusY,
    r: plusRadius,
  };
}
