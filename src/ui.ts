export class UIController {
  public dividers: Record<string, HTMLElement> = {};
  private container: HTMLElement;
  private chart: { draw: () => void; config: any };

  constructor(container: HTMLElement, chart: { draw: () => void; config: any }) {
    this.container = container;
    this.chart = chart;
  }

  public init(): void {
    this.createTopBar();
    this.createDividers();
  }

  private createTopBar(): void {
    const topBar = document.createElement('div');
    topBar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:40px;background:#1c202b;border-bottom:1px solid #363a45;z-index:1000;';
    this.container.appendChild(topBar);
  }

  private createDividers(): void {
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:0;right:0;height:8px;background:transparent;cursor:row-resize;z-index:1000;';
    div.innerHTML = '<div style="width:100%;height:4px;background:#363a45;margin-top:2px;border-radius:2px;"></div>';

    let isResizing = false;
    div.addEventListener('mousedown', (event) => {
      isResizing = true;
      document.body.style.cursor = 'row-resize';
      event.preventDefault();
    });

    window.addEventListener('mousemove', () => {
      if (!isResizing) return;
      this.chart.draw();
      this.updateDividerPositions();
    });

    window.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = 'default';
    });

    div.id = 'divider-main';
    this.dividers['divider-main'] = div;
    this.container.appendChild(div);
  }

  public updateDividerPositions(): void {
    const divider = this.dividers['divider-main'];
    if (!divider) return;
    divider.style.top = '60%';
  }
}
