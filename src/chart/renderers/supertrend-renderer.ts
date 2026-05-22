import type { DrawSeriesLine, IndicatorLineStyle } from './main-line-renderer';

export interface SupertrendRenderData {
  line: Array<number | null>;
  direction: number[];
}

export interface SupertrendCandle {
  open: number;
  close: number;
}

export function splitSupertrendLines(data: SupertrendRenderData, length: number): {
  upLine: Array<number | null>;
  downLine: Array<number | null>;
} {
  const upLine: Array<number | null> = new Array(length).fill(null);
  const downLine: Array<number | null> = new Array(length).fill(null);
  for (let i = 0; i < length; i += 1) {
    const value = data.line[i];
    if (value == null) continue;
    if ((data.direction[i] ?? 1) < 0) upLine[i] = value;
    else downLine[i] = value;
  }
  return { upLine, downLine };
}

export function renderSupertrend(params: {
  ctx: CanvasRenderingContext2D;
  data: SupertrendRenderData;
  displayData: SupertrendCandle[];
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  upBgEnabled: boolean;
  downBgEnabled: boolean;
  upBgColor: string;
  downBgColor: string;
  upStyle: IndicatorLineStyle;
  downStyle: IndicatorLineStyle;
  showUpLine: boolean;
  showDownLine: boolean;
  drawLine: DrawSeriesLine;
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
    upBgEnabled,
    downBgEnabled,
    upBgColor,
    downBgColor,
    upStyle,
    downStyle,
    showUpLine,
    showDownLine,
    drawLine,
    getY,
  } = params;

  if (upBgEnabled || downBgEnabled) {
    ctx.save();
    for (let i = 0; i < visLength; i += 1) {
      const gi = startIndex + i;
      const value = data.line[gi];
      if (value == null) continue;
      const direction = data.direction[gi] ?? 1;
      const candle = displayData[gi];
      if (!candle) continue;
      const centerPrice = (candle.open + candle.close) / 2;
      const yLine = getY(value);
      const yCenter = getY(centerPrice);
      const yTop = Math.min(yLine, yCenter);
      const height = Math.max(1, Math.abs(yCenter - yLine));
      if (direction < 0 && upBgEnabled) {
        ctx.fillStyle = upBgColor;
        ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), height);
      } else if (direction >= 0 && downBgEnabled) {
        ctx.fillStyle = downBgColor;
        ctx.fillRect(effectiveChartLeft + i * totalSp, yTop, Math.max(1, totalSp), height);
      }
    }
    ctx.restore();
  }

  const { upLine, downLine } = splitSupertrendLines(data, data.line.length);
  if (showUpLine) drawLine(upLine, upStyle.color, upStyle.width, upStyle.dash);
  if (showDownLine) drawLine(downLine, downStyle.color, downStyle.width, downStyle.dash);
}
