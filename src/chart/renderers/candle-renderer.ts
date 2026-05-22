export interface CandleRendererCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface RenderCandlesParams {
  ctx: CanvasRenderingContext2D;
  candles: CandleRendererCandle[];
  effectiveChartLeft: number;
  totalSpacing: number;
  candleWidth: number;
  getY: (price: number) => number;
  snapToDevice: (value: number) => number;
  snapStrokeCenter: (value: number, lineWidth?: number) => number;
  snapSize: (value: number, minCssPx?: number) => number;
  upColor: string;
  downColor: string;
}

export function renderCandles(params: RenderCandlesParams): void {
  const {
    ctx,
    candles,
    effectiveChartLeft,
    totalSpacing,
    candleWidth,
    getY,
    snapToDevice,
    snapStrokeCenter,
    snapSize,
    upColor,
    downColor,
  } = params;

  candles.forEach((candle, index) => {
    const x = effectiveChartLeft + index * totalSpacing;
    const candleColor = candle.close >= candle.open ? upColor : downColor;
    ctx.fillStyle = candleColor;
    ctx.strokeStyle = candleColor;

    const wickLineWidth = 1;
    ctx.lineWidth = wickLineWidth;
    const wickX = snapStrokeCenter(x + candleWidth / 2, wickLineWidth);
    const wickLowY = snapStrokeCenter(getY(candle.low), wickLineWidth);
    const wickHighY = snapStrokeCenter(getY(candle.high), wickLineWidth);
    ctx.beginPath();
    ctx.moveTo(wickX, wickLowY);
    ctx.lineTo(wickX, wickHighY);
    ctx.stroke();

    const bodyX = snapToDevice(x);
    const bodyY = snapToDevice(Math.min(getY(candle.open), getY(candle.close)));
    const bodyW = snapSize(Math.max(2, candleWidth), 2);
    const bodyH = snapSize(Math.max(2, Math.abs(getY(candle.close) - getY(candle.open))), 2);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
  });
}
