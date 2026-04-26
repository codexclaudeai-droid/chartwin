import type { CandleData, ChartConfig } from './types';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    container.appendChild(this.canvas);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.pointerEvents = 'none';
    container.appendChild(this.overlayCanvas);

    this.resize();
  }

  public resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.overlayCanvas.width = window.innerWidth;
    this.overlayCanvas.height = window.innerHeight;
  }

  public draw(data: CandleData[], startIndex: number, endIndex: number, config: ChartConfig): void {
    const { width, height } = this.canvas;
    const visible = data.slice(startIndex, endIndex);

    this.ctx.fillStyle = '#131722';
    this.ctx.fillRect(0, 0, width, height);

    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (!visible.length) return;

    const min = Math.min(...visible.map((c) => c.low));
    const max = Math.max(...visible.map((c) => c.high));
    const range = Math.max(max - min, 0.0001);
    const barWidth = Math.max(2, (width - 60) / visible.length);

    this.ctx.save();
    this.ctx.translate(0, 20);

    for (let i = 0; i < visible.length; i += 1) {
      const candle = visible[i];
      const x = i * barWidth + barWidth * 0.5;
      const yOpen = ((max - candle.open) / range) * (height - 40);
      const yClose = ((max - candle.close) / range) * (height - 40);
      const yHigh = ((max - candle.high) / range) * (height - 40);
      const yLow = ((max - candle.low) / range) * (height - 40);
      const up = candle.close >= candle.open;

      this.ctx.strokeStyle = up ? '#26a69a' : '#ef5350';
      this.ctx.fillStyle = this.ctx.strokeStyle;

      this.ctx.beginPath();
      this.ctx.moveTo(x, yHigh);
      this.ctx.lineTo(x, yLow);
      this.ctx.stroke();

      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
      this.ctx.fillRect(x - barWidth * 0.3, bodyTop, barWidth * 0.6, bodyHeight);
    }

    this.ctx.restore();

    this.ctx.fillStyle = '#9aa4af';
    this.ctx.font = '12px Segoe UI, Arial, sans-serif';
    this.ctx.fillText(`${config.symbol} ${config.timeframe}`, 12, 16);
  }
}
