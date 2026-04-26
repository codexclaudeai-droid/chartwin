import type { CandleData, ChartConfig } from './types';
import { ChartModel } from './model';
import { Renderer } from './renderer';
import { UIController } from './ui';

export class Chart {
  private model: ChartModel;
  private renderer: Renderer;
  private ui: UIController;

  constructor(container: HTMLElement) {
    const config: ChartConfig = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: {
        ma: {
          show: true,
          nextId: 5,
          lines: [
            { id: 'ma1', period: 5 },
            { id: 'ma2', period: 20 },
            { id: 'ma3', period: 60 },
            { id: 'ma4', period: 120 },
          ],
        } as any,
        maShort: { show: false, value: 5 },
        maLong: { show: false, value: 20 },
        bb: { show: true, period: 20, stdDev: 2 },
        rsi: { show: true, period: 14 },
        volume: { show: true },
        dmi: { show: true, period: 14 },
      },
      layout: { mainRatio: 0.5, volumeRatio: 0.15, rsiRatio: 0.15, dmiRatio: 0.2 },
    };

    this.model = new ChartModel(config);
    this.renderer = new Renderer(container);
    this.ui = new UIController(container, this);
    this.ui.init();

    this.bindEvents();
  }

  public get config(): ChartConfig {
    return this.model.config;
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.draw();
    });
  }

  public setData(data: CandleData[]): void {
    this.model.setData(data);
    this.draw();
  }

  public draw(): void {
    this.renderer.draw(this.model.data, this.model.startIndex, this.model.endIndex, this.model.config);
    this.ui.updateDividerPositions();
  }

  public updateLastCandle(tick: Partial<CandleData>): void {
    this.model.updateLastCandle(tick);
    this.draw();
  }
}
