type TimezoneChartLike = {
  config: {
    timezone: string;
  };
  activePanels?: string[];
  getPanelRatio?: (id: string) => number;
  jumpToLatest?: () => void;
  panViewport?: (shiftBars: number) => void;
  zoomByCandles?: (deltaVisible: number) => void;
};

export type BottomBarPaneLike<TChart extends TimezoneChartLike> = {
  chart: TChart;
  chartArea?: HTMLDivElement;
};

type CreateBottomBarArgs<TChart extends TimezoneChartLike> = {
  app: HTMLElement;
  rangeButtons: readonly string[];
  bottomOffset?: number;
  leftInset?: number;
  getActivePane: () => BottomBarPaneLike<TChart>;
  onApplyRange: (label: string) => void;
  onOpenTimezone: (chart: TChart, onUpdated: () => void) => void;
  formatDateWithTimezone: (date: Date, timezone: string, options: Intl.DateTimeFormatOptions) => string;
  formatTimezoneLabel: (timezone: string) => string;
};

export function createBottomBar<TChart extends TimezoneChartLike>({
  app,
  rangeButtons,
  bottomOffset = 0,
  leftInset = 0,
  getActivePane,
  onApplyRange,
  onOpenTimezone,
  formatDateWithTimezone,
  formatTimezoneLabel,
}: CreateBottomBarArgs<TChart>): HTMLDivElement {
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = `position:absolute;left:${leftInset}px;right:0;bottom:${bottomOffset}px;height:32px;
    background:#131722;border-top:1px solid #2a2e3e;display:flex;align-items:center;
    justify-content:space-between;padding:0 10px;z-index:1000;color:#c0c4cc;
    font-family:'Segoe UI',Arial,sans-serif;font-size:11px;`;
  app.appendChild(bottomBar);

  const rangeWrap = document.createElement('div');
  rangeWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
  rangeButtons.forEach((label) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'border:none;background:transparent;color:#aab0bb;padding:3px 6px;border-radius:4px;cursor:pointer;font-size:11px;';
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#252a3a';
      btn.style.color = '#fff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#aab0bb';
    });
    btn.addEventListener('click', () => onApplyRange(label));
    rangeWrap.appendChild(btn);
  });
  bottomBar.appendChild(rangeWrap);

  const navPanel = document.createElement('div');
  navPanel.style.cssText = `position:absolute;left:50%;transform:translate(-50%,8px);bottom:${bottomOffset + 26}px;
    display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;
    background:rgba(19,23,34,0.94);border:1px solid #2f3649;box-shadow:0 8px 20px rgba(0,0,0,0.35);
    opacity:0;pointer-events:none;transition:opacity .16s ease, transform .16s ease;z-index:1010;`;
  app.appendChild(navPanel);

  const calcAnchorYInApp = (): number | null => {
    const pane = getActivePane();
    const chartArea = pane?.chartArea;
    if (!chartArea) return null;

    const appRect = app.getBoundingClientRect();
    const caRect = chartArea.getBoundingClientRect();
    const panels = Array.isArray(pane.chart.activePanels) ? pane.chart.activePanels : [];
    let anchorY = 0;

    if (panels.length && typeof pane.chart.getPanelRatio === 'function') {
      const plotHeight = Math.max(40, chartArea.clientHeight - 22);
      const subRatio = panels.reduce((sum, id) => sum + pane.chart.getPanelRatio!(id), 0);
      anchorY = caRect.top + plotHeight * (1 - subRatio) - appRect.top;
    } else {
      // No sub-indicator: place above the x-axis.
      anchorY = caRect.bottom - appRect.top - 22;
    }
    return anchorY;
  };

  const updateNavPanelPosition = () => {
    const anchorY = calcAnchorYInApp();
    if (anchorY == null) {
      navPanel.style.top = 'auto';
      navPanel.style.bottom = `${bottomOffset + 26}px`;
      return;
    }

    const panelHeight = navPanel.offsetHeight || 40;
    const gapAboveFirstSub = 10;
    const top = Math.max(8, Math.round(anchorY - panelHeight - gapAboveFirstSub));
    navPanel.style.top = `${top}px`;
    navPanel.style.bottom = 'auto';
  };

  const setNavVisible = (visible: boolean) => {
    if (visible) updateNavPanelPosition();
    navPanel.style.opacity = visible ? '1' : '0';
    navPanel.style.pointerEvents = visible ? 'auto' : 'none';
    navPanel.style.transform = visible ? 'translate(-50%,0)' : 'translate(-50%,8px)';
  };

  let navHoverLock = false;
  const isNearBottomBand = (clientY: number): boolean => {
    const rect = app.getBoundingClientRect();
    const localY = clientY - rect.top;
    const anchorY = calcAnchorYInApp();
    if (anchorY == null) {
      return localY >= rect.height - (bottomOffset + 66);
    }
    const panelHeight = navPanel.offsetHeight || 40;
    const gapAboveFirstSub = 10;
    const panelTop = Math.max(8, Math.round(anchorY - panelHeight - gapAboveFirstSub));
    const panelBottom = panelTop + panelHeight;
    const triggerPadTop = 16;
    const triggerPadBottom = 24;
    return localY >= (panelTop - triggerPadTop) && localY <= (panelBottom + triggerPadBottom);
  };

  const ICON_PAN_LEFT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="14 6 8 12 14 18"/></svg>`;
  const ICON_PAN_RIGHT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 6 16 12 10 18"/></svg>`;
  const ICON_ZOOM_IN = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`;
  const ICON_ZOOM_OUT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>`;
  const ICON_JUMP_LATEST = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline class="chev-left" points="6 17 11 12 6 7"/><polyline class="chev-right" points="13 17 18 12 13 7"/></svg>`;

  type NavMotionKind = 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'latest';
  const makeNavButton = (iconSvg: string, title: string, motionKind: NavMotionKind, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span class="nav-icon" style="display:inline-flex;align-items:center;justify-content:center;transform:translateX(0) scale(1);transform-origin:center center;">${iconSvg}</span>`;
    btn.setAttribute('aria-label', title);
    btn.title = title;
    btn.style.cssText = 'height:30px;min-width:30px;padding:0 8px;border-radius:8px;border:1px solid #d1d5db;background:#ffffff;color:#374151;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;';
    const iconWrap = btn.querySelector('.nav-icon') as HTMLSpanElement | null;
    let runningAnimations: Animation[] = [];
    const stopIconMotion = () => {
      runningAnimations.forEach((anim) => anim.cancel());
      runningAnimations = [];
      if (iconWrap) {
        iconWrap.style.transform = 'translateX(0) scale(1)';
      }
      const svg = iconWrap?.querySelector('svg');
      const left = svg?.querySelector('.chev-left') as SVGElement | null;
      const right = svg?.querySelector('.chev-right') as SVGElement | null;
      if (left) {
        left.style.opacity = '1';
        left.style.transform = 'translateX(0)';
      }
      if (right) {
        right.style.opacity = '1';
        right.style.transform = 'translateX(0)';
      }
    };
    const startIconMotion = () => {
      if (!iconWrap) return;
      stopIconMotion();
      if (motionKind === 'pan-left') {
        runningAnimations.push(iconWrap.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-2.8px)' }, { transform: 'translateX(0)' }],
          { duration: 560, iterations: Infinity, easing: 'ease-in-out' },
        ));
      } else if (motionKind === 'pan-right') {
        runningAnimations.push(iconWrap.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(2.8px)' }, { transform: 'translateX(0)' }],
          { duration: 560, iterations: Infinity, easing: 'ease-in-out' },
        ));
      } else if (motionKind === 'zoom-in') {
        runningAnimations.push(iconWrap.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
          { duration: 620, iterations: Infinity, easing: 'ease-in-out' },
        ));
      } else if (motionKind === 'zoom-out') {
        runningAnimations.push(iconWrap.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(0.82)' }, { transform: 'scale(1)' }],
          { duration: 620, iterations: Infinity, easing: 'ease-in-out' },
        ));
      } else {
        const svg = iconWrap.querySelector('svg');
        const left = svg?.querySelector('.chev-left') as SVGElement | null;
        const right = svg?.querySelector('.chev-right') as SVGElement | null;
        if (left && right) {
          runningAnimations.push(left.animate(
            [
              { opacity: 0.2, transform: 'translateX(-1px)' },
              { opacity: 1, transform: 'translateX(0)' },
              { opacity: 0.2, transform: 'translateX(1px)' },
            ],
            { duration: 760, iterations: Infinity, easing: 'ease-in-out' },
          ));
          runningAnimations.push(right.animate(
            [
              { opacity: 0.2, transform: 'translateX(-1px)' },
              { opacity: 1, transform: 'translateX(0)' },
              { opacity: 0.2, transform: 'translateX(1px)' },
            ],
            { duration: 760, delay: 210, iterations: Infinity, easing: 'ease-in-out' },
          ));
        }
      }
    };
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f3f4f6';
      btn.style.borderColor = '#9ca3af';
      btn.style.color = '#1f2937';
      startIconMotion();
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#ffffff';
      btn.style.borderColor = '#d1d5db';
      btn.style.color = '#374151';
      stopIconMotion();
    });
    btn.addEventListener('click', onClick);
    return btn;
  };

  const viewportStep = 10;
  const zoomStep = 6;
  const callChartControl = (fn: (chart: TChart) => void): void => {
    const pane = getActivePane();
    if (!pane || !pane.chart) return;
    fn(pane.chart);
  };

  navPanel.appendChild(makeNavButton(ICON_PAN_LEFT, 'Pan Left', 'pan-left', () => {
    callChartControl((chart) => chart.panViewport?.(-viewportStep));
  }));
  navPanel.appendChild(makeNavButton(ICON_PAN_RIGHT, 'Pan Right', 'pan-right', () => {
    callChartControl((chart) => chart.panViewport?.(viewportStep));
  }));
  navPanel.appendChild(makeNavButton(ICON_ZOOM_IN, 'Zoom In', 'zoom-in', () => {
    callChartControl((chart) => chart.zoomByCandles?.(-zoomStep));
  }));
  navPanel.appendChild(makeNavButton(ICON_ZOOM_OUT, 'Zoom Out', 'zoom-out', () => {
    callChartControl((chart) => chart.zoomByCandles?.(zoomStep));
  }));
  navPanel.appendChild(makeNavButton(ICON_JUMP_LATEST, 'Jump To Latest Candle', 'latest', () => {
    callChartControl((chart) => chart.jumpToLatest?.());
  }));

  app.addEventListener('mousemove', (event) => {
    if (navHoverLock) return;
    const target = event.target as Element | null;
    if (target?.closest('.panel-divider')) {
      // Do not force-hide here; just ignore divider hover as a trigger source.
      return;
    }
    setNavVisible(isNearBottomBand(event.clientY));
  });
  app.addEventListener('mouseleave', () => {
    if (!navHoverLock) setNavVisible(false);
  });
  bottomBar.addEventListener('mouseenter', () => setNavVisible(true));
  navPanel.addEventListener('mouseenter', () => {
    navHoverLock = true;
    setNavVisible(true);
  });
  navPanel.addEventListener('mouseleave', () => {
    navHoverLock = false;
    setNavVisible(false);
  });
  window.addEventListener('resize', updateNavPanelPosition);
  window.setInterval(updateNavPanelPosition, 350);

  const tzWrap = document.createElement('div');
  tzWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const clockEl = document.createElement('span');
  clockEl.style.color = '#d1d4dc';
  const tzBtn = document.createElement('button');
  tzBtn.type = 'button';
  tzBtn.style.cssText = 'background:#1c2030;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;';
  const refreshTimezoneButton = () => {
    tzBtn.textContent = formatTimezoneLabel(getActivePane().chart.config.timezone);
  };
  tzBtn.addEventListener('click', () => {
    onOpenTimezone(getActivePane().chart, refreshTimezoneButton);
  });
  const updateClock = () => {
    const now = new Date();
    clockEl.textContent = formatDateWithTimezone(now, getActivePane().chart.config.timezone, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };
  refreshTimezoneButton();
  updateClock();
  window.setInterval(updateClock, 1000);
  tzWrap.appendChild(clockEl);
  tzWrap.appendChild(tzBtn);
  bottomBar.appendChild(tzWrap);

  return bottomBar;
}
