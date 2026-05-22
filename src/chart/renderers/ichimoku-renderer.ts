import type { IndicatorLineStyle } from './main-line-renderer.ts';
import type { IchimokuResult } from '../indicators/index.ts';

type DrawIchimokuLine = (
  data: Array<number | null>,
  color: string,
  width?: number,
  dash?: number[],
  offsetBars?: number,
) => void;

export function renderIchimoku(params: {
  ctx: CanvasRenderingContext2D;
  data: IchimokuResult | null;
  enabled: boolean;
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  tenkanStyle: IndicatorLineStyle;
  kijunStyle: IndicatorLineStyle;
  senkouAStyle: IndicatorLineStyle;
  senkouBStyle: IndicatorLineStyle;
  chikouStyle: IndicatorLineStyle;
  showLine: (key: string) => boolean;
  drawLine: DrawIchimokuLine;
  getY: (price: number) => number;
  kijunOffset: number;
  bullishCloudColor?: string;
  bearishCloudColor?: string;
}): void {
  const {
    ctx,
    data,
    enabled,
    startIndex,
    visLength,
    effectiveChartLeft,
    totalSp,
    tenkanStyle,
    kijunStyle,
    senkouAStyle,
    senkouBStyle,
    chikouStyle,
    showLine,
    drawLine,
    getY,
    kijunOffset,
    bullishCloudColor = 'rgba(34,171,148,0.1)',
    bearishCloudColor = 'rgba(242,54,69,0.1)',
  } = params;
  if (!enabled || !data) return;

  ctx.save();
  for (let i = 0; i < visLength; i += 1) {
    const globalIndex = startIndex + i;
    const senkouA = data.senkouA[globalIndex];
    const senkouB = data.senkouB[globalIndex];
    if (senkouA == null || senkouB == null) continue;
    ctx.fillStyle = senkouA >= senkouB ? bullishCloudColor : bearishCloudColor;
    ctx.fillRect(
      effectiveChartLeft + i * totalSp,
      Math.min(getY(senkouA), getY(senkouB)),
      totalSp,
      Math.abs(getY(senkouA) - getY(senkouB)),
    );
  }
  ctx.restore();

  if (showLine('ichimokuTenkan')) drawLine(data.tenkanLine, tenkanStyle.color, tenkanStyle.width, tenkanStyle.dash);
  if (showLine('ichimokuKijun')) drawLine(data.kijunLine, kijunStyle.color, kijunStyle.width, kijunStyle.dash);
  if (showLine('ichimokuSenkouA')) drawLine(data.senkouA, senkouAStyle.color, senkouAStyle.width, senkouAStyle.dash);
  if (showLine('ichimokuSenkouB')) drawLine(data.senkouB, senkouBStyle.color, senkouBStyle.width, senkouBStyle.dash);
  if (showLine('ichimokuChikou')) drawLine(data.chikouSpan, chikouStyle.color, chikouStyle.width, chikouStyle.dash, -kijunOffset);
}
