type DividerChartLike<TPanelState> = {
  activePanels: string[];
  getPanelRatio: (panelId: string) => number;
  dividers: Record<string, HTMLElement>;
  config: {
    panelState: TPanelState;
  };
  draw: () => void;
};

type CreatePanelDividerManagerArgs<TPanelState> = {
  chart: DividerChartLike<TPanelState>;
  chartArea: HTMLDivElement;
  xAxisHeight: number;
  resizePanelBoundary: (panelState: TPanelState, activePanels: string[], boundaryIndex: number, deltaRatio: number) => void;
};

export type PanelDividerManager = {
  syncDividers: () => void;
  positionDividers: () => void;
  clearDividers: () => void;
  setOnAfterResize: (callback: () => void) => void;
};

export function createPanelDividerManager<TPanelState>({
  chart,
  chartArea,
  xAxisHeight,
  resizePanelBoundary,
}: CreatePanelDividerManagerArgs<TPanelState>): PanelDividerManager {
  const dividerCleanup: Array<() => void> = [];
  let onAfterResize = () => {};

  const positionDividers = () => {
    const panels = chart.activePanels;
    if (!panels.length) return;
    const plotHeight = Math.max(40, chartArea.clientHeight - xAxisHeight);
    let runningTop = plotHeight * (1 - panels.reduce((sum, id) => sum + chart.getPanelRatio(id), 0));
    for (let boundaryIndex = 0; boundaryIndex < panels.length; boundaryIndex += 1) {
      const divider = chart.dividers[`divider-${boundaryIndex}`];
      if (!divider) continue;
      divider.style.top = `${runningTop}px`;
      runningTop += plotHeight * chart.getPanelRatio(panels[boundaryIndex]);
    }
  };

  const clearDividers = () => {
    dividerCleanup.splice(0).forEach((fn) => fn());
    chart.dividers = {};
    chartArea.querySelectorAll('.panel-divider').forEach((el) => el.remove());
  };

  const syncDividers = () => {
    clearDividers();
    const panels = chart.activePanels;
    if (!panels.length) return;
    for (let boundaryIndex = 0; boundaryIndex < panels.length; boundaryIndex += 1) {
      const divider = document.createElement('div');
      divider.className = 'panel-divider';
      divider.style.cssText = 'position:absolute;left:0;right:0;height:12px;background:transparent;cursor:row-resize;z-index:500;transform:translateY(-6px);';
      divider.innerHTML = `<div class="divider-line" style="width:100%;height:1px;background:#2a2e3e;margin-top:6px;position:relative;border-radius:999px;transition:background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-56%);color:#59617a;font-size:18px;font-weight:700;line-height:1;letter-spacing:1px;pointer-events:none;transition:color 0.15s ease;">⋯</div>
      </div>`;
      chartArea.appendChild(divider);
      chart.dividers[`divider-${boundaryIndex}`] = divider;
      const dividerLine = divider.querySelector('.divider-line') as HTMLElement | null;
      const setDividerVisual = (active: boolean) => {
        if (!dividerLine) return;
        dividerLine.style.background = active ? 'rgba(99, 158, 255, 0.7)' : '#2a2e3e';
        dividerLine.style.boxShadow = active
          ? '0 0 0 1px rgba(99,158,255,0.35), 0 0 10px rgba(99,158,255,0.45), 0 0 18px rgba(99,158,255,0.24)'
          : 'none';
        dividerLine.style.transform = active ? 'scaleY(1.12)' : 'scaleY(1)';
        const dots = dividerLine.firstElementChild as HTMLElement | null;
        if (dots) dots.style.color = active ? '#d7e6ff' : '#59617a';
      };

      let dragging = false;
      let lastY = 0;
      const onMouseMove = (event: MouseEvent) => {
        if (!dragging) return;
        const rect = chartArea.getBoundingClientRect();
        const deltaRatio = (event.clientY - lastY) / Math.max(1, rect.height);
        lastY = event.clientY;
        resizePanelBoundary(chart.config.panelState, chart.activePanels, boundaryIndex, deltaRatio);
        chart.draw();
        positionDividers();
        onAfterResize();
      };
      const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = 'default';
        setDividerVisual(false);
      };
      const onMouseDown = (event: MouseEvent) => {
        dragging = true;
        lastY = event.clientY;
        document.body.style.cursor = 'row-resize';
        setDividerVisual(true);
        event.preventDefault();
      };
      const onMouseEnter = () => {
        if (!dragging) setDividerVisual(true);
      };
      const onMouseLeave = () => {
        if (!dragging) setDividerVisual(false);
      };
      divider.addEventListener('mouseenter', onMouseEnter);
      divider.addEventListener('mouseleave', onMouseLeave);
      divider.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      dividerCleanup.push(() => {
        divider.removeEventListener('mouseenter', onMouseEnter);
        divider.removeEventListener('mouseleave', onMouseLeave);
        divider.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      });
    }
    positionDividers();
  };

  const setOnAfterResize = (callback: () => void) => {
    onAfterResize = callback;
  };

  return {
    syncDividers,
    positionDividers,
    clearDividers,
    setOnAfterResize,
  };
}
