import type { DrawSeriesLine, IndicatorLineStyle } from './main-line-renderer';
import { toRgba } from '../color-utils.ts';

export const STS_BEARISH = 0;
export const STS_BULLISH = 1;

export interface StatisticalTrailingStopRenderData {
  level: Array<number | null>;
  anchor?: Array<number | null>;
  extreme?: Array<number | null>;
  bias: Array<number | null>;
  newTrail?: boolean[];
}

export function splitStatisticalTrailingStopLines(
  data: StatisticalTrailingStopRenderData,
  length: number,
): {
  bullLine: Array<number | null>;
  bearLine: Array<number | null>;
} {
  const bullLine: Array<number | null> = new Array(length).fill(null);
  const bearLine: Array<number | null> = new Array(length).fill(null);
  for (let i = 0; i < length; i += 1) {
    const value = data.level[i];
    if (value == null) continue;
    if ((data.bias[i] ?? STS_BEARISH) === STS_BULLISH) bullLine[i] = value;
    else bearLine[i] = value;
  }
  return { bullLine, bearLine };
}

export function renderStatisticalTrailingStopBase(params: {
  ctx: CanvasRenderingContext2D;
  data: Required<Pick<StatisticalTrailingStopRenderData, 'level' | 'anchor' | 'bias'>>;
  startIndex: number;
  visLength: number;
  totalLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  bullishFillColor: string;
  bearishFillColor: string;
  bullStyle: IndicatorLineStyle;
  bearStyle: IndicatorLineStyle;
  showBullLine: boolean;
  showBearLine: boolean;
  drawLine: DrawSeriesLine;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    data,
    startIndex,
    visLength,
    totalLength,
    effectiveChartLeft,
    totalSp,
    bullishFillColor,
    bearishFillColor,
    bullStyle,
    bearStyle,
    showBullLine,
    showBearLine,
    drawLine,
    getY,
  } = params;

  ctx.save();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    const trail = data.level[gi];
    const anchor = data.anchor[gi];
    const bias = data.bias[gi];
    if (trail == null || anchor == null || bias == null) continue;
    if (bias === STS_BEARISH && trail <= anchor) {
      ctx.fillStyle = bearishFillColor;
    } else if (bias === STS_BULLISH && trail >= anchor) {
      ctx.fillStyle = bullishFillColor;
    } else {
      continue;
    }
    const yTop = Math.min(getY(trail), getY(anchor));
    const height = Math.max(1, Math.abs(getY(anchor) - getY(trail)));
    ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), height);
  }
  ctx.restore();

  const { bullLine, bearLine } = splitStatisticalTrailingStopLines(data, totalLength);
  if (showBullLine) drawLine(bullLine, bullStyle.color, bullStyle.width, bullStyle.dash);
  if (showBearLine) drawLine(bearLine, bearStyle.color, bearStyle.width, bearStyle.dash);
}

export function getStatisticalTrailingStopMarkerGeometry(pixelRatio: number, isMobileViewport = false): {
  markerSize: number;
  markerOffset: number;
} {
  const ratio = Math.max(1, pixelRatio / 1.5);
  const mobileScale = isMobileViewport ? 0.25 : 1;
  return {
    markerSize: Math.max(4, 6 * ratio) * mobileScale,
    markerOffset: Math.max(8, 10 * ratio) * mobileScale,
  };
}

export function getStatisticalTrailingStopPanelLabelText(
  data: Required<Pick<StatisticalTrailingStopRenderData, 'level' | 'anchor' | 'extreme'>>,
  index: number,
  biasValue: number,
): string {
  const safeIndex = Math.max(0, Math.min(data.level.length - 1, index));
  const level = data.level[safeIndex];
  const anchor = data.anchor[safeIndex];
  const extreme = data.extreme[safeIndex];
  if (level == null || anchor == null || extreme == null) return 'STS';
  const priceDelta = biasValue === STS_BEARISH ? anchor - level : level - anchor;
  const denom = biasValue === STS_BEARISH ? anchor - extreme : extreme - anchor;
  const deltaText = Number.isFinite(priceDelta) ? priceDelta.toFixed(2) : '0.00';
  if (!(priceDelta > 0) || !Number.isFinite(denom) || denom === 0) return deltaText;
  const pct = (priceDelta * 100) / denom;
  if (!Number.isFinite(pct)) return deltaText;
  return `${deltaText}\n${pct.toFixed(2)}%`;
}

function drawStatisticalTrailingStopMarker(params: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  biasValue: number;
  panelText: string;
  markerStyle: string;
  markerSize: number;
  showPanelLabel: boolean;
  fontStack: string;
}): void {
  const { ctx, x, y, color, biasValue, panelText, markerStyle, markerSize: r, showPanelLabel, fontStack } = params;
  const up = biasValue === STS_BULLISH;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  switch (markerStyle) {
    case 'arrowup':
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x - r * 0.75, y + r * 0.2);
      ctx.lineTo(x - r * 0.2, y + r * 0.2);
      ctx.lineTo(x - r * 0.2, y + r);
      ctx.lineTo(x + r * 0.2, y + r);
      ctx.lineTo(x + r * 0.2, y + r * 0.2);
      ctx.lineTo(x + r * 0.75, y + r * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'arrowdown':
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(x - r * 0.75, y - r * 0.2);
      ctx.lineTo(x - r * 0.2, y - r * 0.2);
      ctx.lineTo(x - r * 0.2, y - r);
      ctx.lineTo(x + r * 0.2, y - r);
      ctx.lineTo(x + r * 0.2, y - r * 0.2);
      ctx.lineTo(x + r * 0.75, y - r * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x - r, y + r);
      ctx.lineTo(x + r, y - r);
      ctx.stroke();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flag':
      ctx.beginPath();
      ctx.moveTo(x - r * 0.85, y + r);
      ctx.lineTo(x - r * 0.85, y - r);
      ctx.stroke();
      ctx.beginPath();
      if (up) {
        ctx.moveTo(x - r * 0.8, y - r * 0.8);
        ctx.lineTo(x + r * 0.95, y - r * 0.35);
        ctx.lineTo(x - r * 0.8, y + r * 0.1);
      } else {
        ctx.moveTo(x - r * 0.8, y + r * 0.8);
        ctx.lineTo(x + r * 0.95, y + r * 0.35);
        ctx.lineTo(x - r * 0.8, y - r * 0.1);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'labeldown':
    case 'labelup':
      {
        const down = markerStyle === 'labeldown';
        const lines = panelText.split('\n');
        const hasTwoLines = lines.length > 1;
        const boxW = hasTwoLines ? r * 5.1 : r * 3.8;
        const boxH = hasTwoLines ? r * 3.4 : r * 2.1;
        const bx = x - boxW / 2;
        const by = down ? y - boxH - r * 0.45 : y + r * 0.45;
        ctx.fillStyle = toRgba(color, 0.16);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `500 ${Math.max(12, Math.round(r * 1.35))}px ${fontStack}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lineGap = Math.max(14, Math.round(r * 1.45));
        const textCenterY = by + boxH / 2;
        if (hasTwoLines) {
          ctx.fillText(lines[0], x, textCenterY - lineGap * 0.4);
          ctx.fillText(lines[1], x, textCenterY + lineGap * 0.4);
        } else {
          ctx.fillText(lines[0] || 'STS', x, textCenterY);
        }
        ctx.beginPath();
        if (down) {
          ctx.moveTo(x, by + boxH + r * 0.45);
          ctx.lineTo(x - r * 0.35, by + boxH);
          ctx.lineTo(x + r * 0.35, by + boxH);
        } else {
          ctx.moveTo(x, by - r * 0.45);
          ctx.lineTo(x - r * 0.35, by);
          ctx.lineTo(x + r * 0.35, by);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'square':
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      break;
    case 'triangledown':
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(x - r, y - r * 0.7);
      ctx.lineTo(x + r, y - r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'triangleup':
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x - r, y + r * 0.7);
      ctx.lineTo(x + r, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'circle':
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  if (showPanelLabel && markerStyle !== 'labelup' && markerStyle !== 'labeldown') {
    ctx.fillStyle = color;
    ctx.font = `500 ${Math.max(12, Math.round(r * 1.42))}px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = panelText.split('\n');
    if (lines.length > 1) {
      ctx.fillText(lines[0], x, y + r + 10);
      ctx.fillText(lines[1], x, y + r + 26);
    } else {
      ctx.fillText(lines[0] || 'STS', x, y + r + 12);
    }
  }
  ctx.restore();
}

export function renderStatisticalTrailingStopMarkers(params: {
  ctx: CanvasRenderingContext2D;
  data: Required<Pick<StatisticalTrailingStopRenderData, 'level' | 'bias' | 'extreme'>> & { newTrail: boolean[]; anchor: Array<number | null> };
  displayData: Array<{ high: number; low: number }>;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  markerStyle: string;
  markerLocation: string;
  showPanelLabel: boolean;
  markerSize: number;
  markerOffset: number;
  topY: number;
  bottomY: number;
  plotTop: number;
  plotBottom: number;
  bullColor: string;
  bearColor: string;
  fontStack: string;
  getY: (price: number) => number;
}): void {
  const {
    ctx,
    data,
    displayData,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    candleW,
    markerStyle,
    markerLocation,
    showPanelLabel,
    markerSize,
    markerOffset,
    topY,
    bottomY,
    plotTop,
    plotBottom,
    bullColor,
    bearColor,
    fontStack,
    getY,
  } = params;

  ctx.save();
  for (let i = 0; i < visLength; i += 1) {
    const gi = startIndex + i;
    if (!data.newTrail[gi]) continue;
    const level = data.level[gi];
    const bias = data.bias[gi];
    const candle = displayData[gi];
    if (level == null || bias == null || !candle) continue;
    const cx = effectiveChartLeft + i * totalSp + candleW / 2;
    let cy = getY(level);
    if (markerLocation === 'abovebar') cy = getY(candle.high) - markerOffset;
    else if (markerLocation === 'belowbar') cy = getY(candle.low) + markerOffset;
    else if (markerLocation === 'top') cy = topY;
    else if (markerLocation === 'bottom') cy = bottomY;
    cy = Math.max(plotTop + 3, Math.min(plotBottom - 3, cy));
    const markerColor = bias === STS_BEARISH ? bearColor : bullColor;
    const labelIndex = data.newTrail[gi] ? gi - 1 : gi;
    const labelBias = data.newTrail[gi]
      ? (data.bias[Math.max(0, gi - 1)] ?? bias)
      : bias;
    const panelText = getStatisticalTrailingStopPanelLabelText(data, labelIndex, labelBias);
    drawStatisticalTrailingStopMarker({
      ctx,
      x: cx,
      y: cy,
      color: markerColor,
      biasValue: bias,
      panelText,
      markerStyle,
      markerSize,
      showPanelLabel,
      fontStack,
    });
  }
  ctx.restore();
}
