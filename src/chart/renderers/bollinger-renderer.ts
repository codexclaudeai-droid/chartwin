import type { BollingerBandsResult } from '../indicators/index.ts';

export interface BollingerBandRenderSeries {
  id: string;
  data: BollingerBandsResult;
}

export function renderBollingerBandFills(params: {
  ctx: CanvasRenderingContext2D;
  bbSeries: BollingerBandRenderSeries[];
  startIndex: number;
  visLength: number;
  effectiveChartLeft: number;
  totalSp: number;
  candleW: number;
  showLine: (key: string) => boolean;
  getY: (price: number) => number;
}): void {
  const { ctx, bbSeries, startIndex, visLength, effectiveChartLeft, totalSp, candleW, showLine, getY } = params;
  bbSeries.forEach((bbLine, index) => {
    const upKey = `${bbLine.id}Upper`;
    const loKey = `${bbLine.id}Lower`;
    if (!showLine(upKey) || !showLine(loKey)) return;

    ctx.save();
    ctx.fillStyle = index === 0 ? 'rgba(100,100,255,0.05)' : 'rgba(255,255,255,0.025)';
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < visLength; i += 1) {
      const value = bbLine.data.upper[startIndex + i];
      if (value == null) continue;
      const x = effectiveChartLeft + i * totalSp + candleW / 2;
      if (first) {
        ctx.moveTo(x, getY(value));
        first = false;
      } else {
        ctx.lineTo(x, getY(value));
      }
    }
    for (let i = visLength - 1; i >= 0; i -= 1) {
      const value = bbLine.data.lower[startIndex + i];
      if (value == null) continue;
      ctx.lineTo(effectiveChartLeft + i * totalSp + candleW / 2, getY(value));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}
