import { getLineStyle } from '../indicator-panel-module';
import { INDICATOR_CATALOG } from '../catalog/indicators';
import { openSettingsPopup } from './modal-handlers';
import type { StrategyDefinition } from '../strategy/strategy-service';

const X_AXIS_HEIGHT = 22;
const CHART_FONT_STACK = `'Inter','Segoe UI','Noto Sans KR','Apple SD Gothic Neo',sans-serif`;

export function createIndicatorOverlay(container: HTMLElement, chart: any, onOverlayChange?: () => void): () => void {
  if (!document.getElementById('indicator-panel-control-motion-style')) {
    const style = document.createElement('style');
    style.id = 'indicator-panel-control-motion-style';
    style.textContent = `
      @keyframes panel-icon-pulse {
        0% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-1px) scale(1.06); }
        100% { transform: translateY(0) scale(1); }
      }
      @keyframes panel-expand-top {
        0% { transform: translateY(0); }
        50% { transform: translateY(-1.8px); }
        100% { transform: translateY(0); }
      }
      @keyframes panel-expand-bottom {
        0% { transform: translateY(0); }
        50% { transform: translateY(1.8px); }
        100% { transform: translateY(0); }
      }
      @keyframes panel-collapse-top {
        0% { transform: translateY(0); }
        50% { transform: translateY(1.1px); }
        100% { transform: translateY(0); }
      }
      @keyframes panel-collapse-bottom {
        0% { transform: translateY(0); }
        50% { transform: translateY(-1.1px); }
        100% { transform: translateY(0); }
      }
      .panel-ctrl-btn svg { transform-origin: center; }
      .panel-ctrl-btn:not([data-motion]):not([data-no-motion="1"]):hover svg { animation: panel-icon-pulse 520ms ease-in-out 1; }
      .panel-ctrl-btn[data-motion="expand"]:hover .chev-top { animation: panel-expand-top 640ms ease-in-out 1; }
      .panel-ctrl-btn[data-motion="expand"]:hover .chev-bottom { animation: panel-expand-bottom 640ms ease-in-out 1; }
      .panel-ctrl-btn[data-motion="collapse"]:hover .chev-top { animation: panel-collapse-top 640ms ease-in-out 1; }
      .panel-ctrl-btn[data-motion="collapse"]:hover .chev-bottom { animation: panel-collapse-bottom 640ms ease-in-out 1; }
      @keyframes panel-eye-blink-top {
        0%, 100% { transform: translateY(0); }
        48% { transform: translateY(2.4px); }
        52% { transform: translateY(2.6px); }
      }
      @keyframes panel-eye-blink-bottom {
        0%, 100% { transform: translateY(0); }
        48% { transform: translateY(-2.4px); }
        52% { transform: translateY(-2.6px); }
      }
      @keyframes panel-eye-iris-fade {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.08; transform: scale(0.72); }
      }
      @keyframes panel-settings-knob-left {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(-2.2px); }
      }
      @keyframes panel-settings-knob-right {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(2.2px); }
      }
      @keyframes panel-trash-lid-open {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        40%, 70% { transform: translate(-0.8px, -1.2px) rotate(-16deg); }
      }
      @keyframes panel-trash-body-pop {
        0%, 100% { transform: translateY(0) scale(1); }
        45% { transform: translateY(-0.6px) scale(1.02); }
      }
      @keyframes panel-trash-dot-drop {
        0%, 100% { opacity: 0; transform: translateY(-1px) scale(0.9); }
        20% { opacity: 0.95; transform: translateY(0) scale(1); }
        70% { opacity: 0.3; transform: translateY(3.2px) scale(0.75); }
      }
      @keyframes strategy-report-arrow-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.4px); }
      }
      @keyframes strategy-report-arrow-bob-down {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(1.4px); }
      }
      .panel-title-ctrl-btn svg { transform-origin: center; }
      .panel-title-ctrl-btn[data-motion="eye"]:hover .eye-lid-top { animation: panel-eye-blink-top 620ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="eye"]:hover .eye-lid-bottom { animation: panel-eye-blink-bottom 620ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="eye"]:hover .eye-iris { animation: panel-eye-iris-fade 620ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="settings"]:hover .settings-knob-left { animation: panel-settings-knob-left 620ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="settings"]:hover .settings-knob-right { animation: panel-settings-knob-right 620ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="trash"]:hover .trash-lid { animation: panel-trash-lid-open 660ms ease-in-out 1; transform-origin: 8px 7px; }
      .panel-title-ctrl-btn[data-motion="trash"]:hover .trash-body { animation: panel-trash-body-pop 660ms ease-in-out 1; }
      .panel-title-ctrl-btn[data-motion="trash"]:hover .trash-dot-1 { animation: panel-trash-dot-drop 660ms ease-in-out 1 30ms; }
      .panel-title-ctrl-btn[data-motion="trash"]:hover .trash-dot-2 { animation: panel-trash-dot-drop 660ms ease-in-out 1 90ms; }
      .panel-title-ctrl-btn[data-motion="trash"]:hover .trash-dot-3 { animation: panel-trash-dot-drop 660ms ease-in-out 1 150ms; }
      .panel-ctrl-btn[data-motion="trash"]:hover .trash-lid { animation: panel-trash-lid-open 660ms ease-in-out 1; transform-origin: 8px 7px; }
      .panel-ctrl-btn[data-motion="trash"]:hover .trash-body { animation: panel-trash-body-pop 660ms ease-in-out 1; }
      .panel-ctrl-btn[data-motion="trash"]:hover .trash-dot-1 { animation: panel-trash-dot-drop 660ms ease-in-out 1 30ms; }
      .panel-ctrl-btn[data-motion="trash"]:hover .trash-dot-2 { animation: panel-trash-dot-drop 660ms ease-in-out 1 90ms; }
      .panel-ctrl-btn[data-motion="trash"]:hover .trash-dot-3 { animation: panel-trash-dot-drop 660ms ease-in-out 1 150ms; }
      .strategy-report-open-btn:hover .sr-arrow-up {
        animation: strategy-report-arrow-bob 620ms ease-in-out 1;
      }
      .strategy-report-open-btn:hover .sr-arrow-down {
        animation: strategy-report-arrow-bob-down 620ms ease-in-out 1;
      }
      .strategy-visibility-btn:hover .eye-lid-top { animation: panel-eye-blink-top 620ms ease-in-out 1; }
      .strategy-visibility-btn:hover .eye-lid-bottom { animation: panel-eye-blink-bottom 620ms ease-in-out 1; }
      .strategy-visibility-btn:hover .eye-iris { animation: panel-eye-iris-fade 620ms ease-in-out 1; }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.id = 'ind-overlay';
  overlay.style.cssText = `position:absolute;top:6px;left:8px;z-index:200;
    pointer-events:none;display:flex;flex-direction:column;gap:3px;`;
  container.appendChild(overlay);

  const panelControls = document.createElement('div');
  panelControls.style.cssText = 'position:absolute;inset:0;z-index:260;pointer-events:none;';
  container.appendChild(panelControls);

  const collapsedPanels = new Set<string>();
  const collapsedRatioMemory = new Map<string, number>();
  let maximizedPanelId: string | null = null;
  let maximizedPanelWasCollapsed = false;
  let maximizeRatioMemory: Record<string, number> | null = null;
  let panelHoverControllers: Array<{ id: string; top: number; bottom: number; setExpanded: (expanded: boolean) => void }> = [];
  let hoveredPanelId: string | null = null;
  const TITLE_COLLAPSED_PX = 26;
  const getValueHint = (panelId: string, valueIndex: number): string => {
    const map: Record<string, string[]> = {
      rsi: ['RSI 현재값'],
      dmi: ['+DI 현재값', '-DI 현재값', 'ADX 현재값'],
      macd: ['MACD 라인 현재값', 'Signal 라인 현재값'],
      stochF: ['Stoch Fast %K 현재값', 'Stoch Fast %D 현재값'],
      stochS: ['Stoch Slow %K 현재값', 'Stoch Slow %D 현재값'],
      cci: ['CCI 현재값'],
      obv: ['OBV 현재값'],
      volume: ['현재 거래량', '거래대금(볼륨×가격)'],
    };
    return map[panelId]?.[valueIndex] ?? '현재 수치';
  };

  const getCollapsedRatio = (): number => {
    const plotHeight = Math.max(40, container.clientHeight - X_AXIS_HEIGHT);
    // Keep collapsed panel height close to TITLE_COLLAPSED_PX across viewport sizes.
    // A large hard minimum ratio made collapsed rows taller than intended on big screens.
    return Math.max(0.01, Math.min(0.12, TITLE_COLLAPSED_PX / Math.max(1, plotHeight)));
  };

  const syncHiddenPanelState = () => {
    const activePanelSet = new Set(chart.activePanels);
    Array.from(collapsedPanels).forEach((id) => {
      if (!activePanelSet.has(id)) {
        collapsedPanels.delete(id);
        collapsedRatioMemory.delete(id);
      }
    });
    // Keep collapsed panel height visually stable even when workspace height changes
    // (e.g. strategy report panel open/close).
    const collapsedRatio = getCollapsedRatio();
    collapsedPanels.forEach((id) => {
      chart.config.panelState.panelRatios[id] = collapsedRatio;
    });
    if (maximizedPanelId && !activePanelSet.has(maximizedPanelId)) {
      maximizedPanelId = null;
      maximizedPanelWasCollapsed = false;
      maximizeRatioMemory = null;
    }
    (chart.config.panelState as any).hiddenPanels = Array.from(collapsedPanels);
  };

  const refreshAll = () => {
    syncHiddenPanelState();
    chart.draw();
    renderOverlay();
    onOverlayChange?.();
  };

  const applyHoveredPanel = (nextId: string | null) => {
    hoveredPanelId = nextId;
    panelHoverControllers.forEach((controller) => {
      controller.setExpanded(controller.id === hoveredPanelId);
    });
  };

  const updateHoveredPanelFromMouse = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hit = panelHoverControllers.find((controller) => y >= controller.top && y <= controller.bottom) ?? null;
    applyHoveredPanel(hit?.id ?? null);
  };

  container.addEventListener('mousemove', updateHoveredPanelFromMouse);
  container.addEventListener('mouseleave', () => applyHoveredPanel(null));

  const renderOverlay = () => {
    syncHiddenPanelState();
    overlay.innerHTML = '';
    panelControls.innerHTML = '';
    const ind = chart.config.indicators;
    const strategies = chart.getStrategies() as StrategyDefinition[];
    const activeStrategyId = chart.getActiveStrategyId();
    const activeStrategy = strategies.find((s) => s.id === activeStrategyId);

    const makeTag = (label: string, color: string, key: string) => {
      const tag = document.createElement('div');
      tag.style.cssText = `display:inline-flex;align-items:center;gap:4px;max-width:fit-content;
        background:rgba(19,23,34,0.82);border:1px solid transparent;border-radius:3px;
        padding:2px 7px;font-size:12px;font-family:${CHART_FONT_STACK};color:${color};
        pointer-events:auto;cursor:pointer;transition:border-color 0.15s;`;
      const gearEl = document.createElement('span');
      gearEl.textContent = '⚙';
      gearEl.style.cssText = 'color:#84898e;font-size:10px;opacity:0;transition:opacity 0.15s;';
      const textEl = document.createElement('span');
      textEl.textContent = label;
      tag.appendChild(textEl); tag.appendChild(gearEl);
      tag.addEventListener('mouseenter', () => { tag.style.borderColor = '#4a4e5e'; gearEl.style.opacity = '1'; });
      tag.addEventListener('mouseleave', () => { tag.style.borderColor = 'transparent'; gearEl.style.opacity = '0'; });
      tag.addEventListener('click', () => openSettingsPopup(tag, chart, key, () => {
        // 인디케이터 설정 변경
        const updated = buildLabel(chart, key);
        if (updated) textEl.textContent = updated;
        renderOverlay();
        onOverlayChange?.();
      }));
      return tag;
    };

    const makeStrategyTag = (label: string) => {
      const tag = document.createElement('div');
      tag.style.cssText = `display:inline-flex;align-items:center;gap:4px;max-width:fit-content;
        background:rgba(19,23,34,0.82);border:none;border-radius:0;
        padding:2px 7px;font-size:12px;font-family:${CHART_FONT_STACK};color:#f5f7fb;
        pointer-events:auto;cursor:default;`;
      const textEl = document.createElement('span');
      textEl.textContent = label;
      const isVisible = chart.isStrategySignalVisible?.() !== false;
      const visibilityBtn = document.createElement('button');
      visibilityBtn.type = 'button';
      visibilityBtn.className = 'strategy-visibility-btn';
      visibilityBtn.title = isVisible ? '전략시그널 감추기' : '전략시그널 보이기';
      visibilityBtn.style.cssText = `width:30px;height:30px;border:none;border-radius:5px;
        background:transparent;color:#edf3ff;display:inline-flex;align-items:center;justify-content:center;
        padding:0;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease,color 0.15s ease;`;
      visibilityBtn.innerHTML = isVisible
        ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><path class="eye-lid-top" d="M3 12c2.6-3.4 5.5-5 9-5 3.5 0 6.4 1.6 9 5"></path><path class="eye-lid-bottom" d="M3 12c2.6 3.4 5.5 5 9 5 3.5 0 6.4-1.6 9-5"></path><circle class="eye-iris" cx="12" cy="12" r="2.8"></circle></svg>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="2.8"></circle><line x1="4" y1="20" x2="20" y2="4"></line></svg>`;
      visibilityBtn.addEventListener('mouseenter', () => {
        visibilityBtn.style.background = 'transparent';
        visibilityBtn.style.color = '#ffffff';
      });
      visibilityBtn.addEventListener('mouseleave', () => {
        visibilityBtn.style.background = 'transparent';
        visibilityBtn.style.color = '#edf3ff';
      });
      visibilityBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        chart.setStrategySignalVisible?.(!isVisible);
        renderOverlay();
      });
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'strategy-report-open-btn';
      reportBtn.title = '전략 리포트 열기';
      reportBtn.style.cssText = `width:25px;height:21px;border:1px solid #3a4158;border-radius:5px;
        background:#ffffff;color:#0f1218;display:inline-flex;align-items:center;justify-content:center;
        padding:0;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease,color 0.15s ease;`;
      reportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <polyline class="sr-chart-line" points="4 16 9 11 13 13 19 7"></polyline>
        <path class="sr-arrow-down" d="M5 4v4"></path>
        <path class="sr-arrow-down" d="M3 7l2 2 2-2"></path>
        <path class="sr-arrow-up" d="M19 17v-4"></path>
        <path class="sr-arrow-up" d="M17 15l2-2 2 2"></path>
      </svg>`;
      reportBtn.addEventListener('mouseenter', () => {
        reportBtn.style.background = '#ffffff';
        reportBtn.style.borderColor = '#9aa3b3';
        reportBtn.style.color = '#000000';
      });
      reportBtn.addEventListener('mouseleave', () => {
        reportBtn.style.background = '#ffffff';
        reportBtn.style.borderColor = '#3a4158';
        reportBtn.style.color = '#0f1218';
      });
      reportBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('chart-open-strategy-report', {
          detail: { chart },
        }));
      });
      tag.appendChild(textEl);
      tag.appendChild(visibilityBtn);
      tag.appendChild(reportBtn);
      return tag;
    };

    const buildLabel = (c: any, key: string): string => {
      const i = c.config.indicators as any;
      const map: Record<string, () => string> = {
        maShort:  () => `MA ${i.maShort.value}`,
        maLong:   () => `MA ${i.maLong.value}`,
        ma60:     () => `MA ${i.ma60.value}`,
        ma120:    () => `MA ${i.ma120.value}`,
        ma200:    () => `MA ${i.ma200.value}`,
        bb:       () => `BB(${i.bb.period}, ${i.bb.stdDev})`,
        rsi:      () => `RSI(${i.rsi.period})`,
        dmi:      () => `DMI(${i.dmi.period})`,
        macd:     () => `MACD(${i.macd.fast},${i.macd.slow},${i.macd.signal})`,
        stochF:   () => `Stoch Fast(${i.stochF.kPeriod},${i.stochF.dPeriod})`,
        stochS:   () => `Stoch Slow(${i.stochS.kPeriod},${i.stochS.dPeriod})`,
        cci:      () => `CCI(${i.cci.period})`,
        obv:      () => 'OBV',
        vwap:     () => 'VWAP',
        ichimoku: () => `Ichimoku(${i.ichimoku.tenkan},${i.ichimoku.kijun})`,
        envelope: () => `Envelope(${i.envelope.period}, ${i.envelope.pct}%)`,
        supertrend: () => `Supertrend(${i.supertrend.period}, ${i.supertrend.factor})`,
        volume:   () => 'Volume',
      };
      return map[key]?.() ?? key;
    };

    const colorMap: Record<string, string> = {
      maShort: getLineStyle(chart.config.panelState, 'maShort', { color: '#f7931a', width: 1.5, dash: [] }).color,
      maLong: getLineStyle(chart.config.panelState, 'maLong', { color: '#2962ff', width: 1.5, dash: [] }).color,
      ma60: getLineStyle(chart.config.panelState, 'ma60', { color: '#4caf50', width: 1.5, dash: [] }).color,
      ma120: getLineStyle(chart.config.panelState, 'ma120', { color: '#9c27b0', width: 1.5, dash: [] }).color,
      ma200: getLineStyle(chart.config.panelState, 'ma200', { color: '#ff5722', width: 1.5, dash: [] }).color,
      bb: getLineStyle(chart.config.panelState, 'bbUpper', { color: 'rgba(100,149,237,0.95)', width: 1, dash: [] }).color,
      vwap: getLineStyle(chart.config.panelState, 'vwap', { color: '#ff9800', width: 1.5, dash: [] }).color,
      ichimoku: '#aaaaff',
      envelope: getLineStyle(chart.config.panelState, 'envelopeUpper', { color: 'rgba(255,200,50,0.95)', width: 1, dash: [] }).color,
      supertrend: getLineStyle(chart.config.panelState, 'supertrendUp', { color: '#26a69a', width: 1.7, dash: [] }).color,
      rsi: getLineStyle(chart.config.panelState, 'rsi', { color: '#ffeb3b', width: 1.5, dash: [] }).color,
      dmi: getLineStyle(chart.config.panelState, 'dmiPlus', { color: '#26a69a', width: 1.5, dash: [] }).color,
      macd: getLineStyle(chart.config.panelState, 'macdLine', { color: '#2962ff', width: 1.5, dash: [] }).color,
      stochF: getLineStyle(chart.config.panelState, 'stochFastK', { color: '#26a69a', width: 1.5, dash: [] }).color,
      stochS: getLineStyle(chart.config.panelState, 'stochSlowK', { color: '#26a69a', width: 1.5, dash: [] }).color,
      cci: getLineStyle(chart.config.panelState, 'cci', { color: '#26a69a', width: 1.5, dash: [] }).color,
      obv: getLineStyle(chart.config.panelState, 'obv', { color: '#26a69a', width: 1.5, dash: [] }).color,
      volume: '#84898e',
    };

    const mainRow = document.createElement('div');
    mainRow.style.cssText = 'display:flex;flex-direction:row;flex-wrap:wrap;gap:4px;';
    const subColumn = document.createElement('div');
    subColumn.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    const panelMap: Record<string, string> = {};
    INDICATOR_CATALOG.forEach((item) => {
      panelMap[item.id] = item.panel;
    });

    const allKeys = [
      'maShort','maLong','ma60','ma120','ma200','bb','vwap','ichimoku','envelope',
      'supertrend',
      'rsi','dmi','macd','stochF','stochS','cci','obv','volume',
    ];
    allKeys.forEach(key => {
      if ((ind as any)[key]?.show && !collapsedPanels.has(key)) {
        const tag = makeTag(buildLabel(chart, key), colorMap[key] ?? '#84898e', key);
        tag.style.pointerEvents = 'auto';
        if (panelMap[key] === 'main') {
          mainRow.appendChild(tag);
        } else {
          subColumn.appendChild(tag);
        }
      }
    });

    if (activeStrategy) {
      const strategyLabel = `전략: ${activeStrategy.name}${activeStrategy.version ? ` (v${activeStrategy.version})` : ''}`;
      mainRow.appendChild(makeStrategyTag(strategyLabel));
    }

    if (mainRow.children.length) overlay.appendChild(mainRow);
    if (subColumn.children.length) overlay.appendChild(subColumn);

    const panels = chart.activePanels as string[];
    if (!panels.length) return;

    const height = container.clientHeight;
    const plotHeight = Math.max(40, height - X_AXIS_HEIGHT);
    const subRat = panels.reduce((sum: number, id: string) => sum + chart.getPanelRatio(id), 0);
    const mainH = plotHeight * (1 - subRat);
    let curTop = mainH;

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `position:absolute;display:none;pointer-events:none;z-index:310;
      background:rgba(9,12,18,0.95);border:1px solid #4d5a73;border-radius:6px;padding:3px 7px;
      color:#eef3ff;font:600 11px ${CHART_FONT_STACK};white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,0.45);`;
    panelControls.appendChild(tooltip);

    const showTip = (anchor: HTMLElement, text: string) => {
      const hostRect = panelControls.getBoundingClientRect();
      const rect = anchor.getBoundingClientRect();
      tooltip.textContent = text;
      tooltip.style.display = 'block';
      const rawX = rect.left - hostRect.left + (rect.width - tooltip.offsetWidth) / 2;
      const x = Math.min(
        Math.max(4, rawX),
        Math.max(4, hostRect.width - tooltip.offsetWidth - 4),
      );
      const y = Math.min(
        Math.max(4, rect.bottom - hostRect.top + 4),
        Math.max(4, hostRect.height - tooltip.offsetHeight - 4),
      );
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    };
    const hideTip = () => {
      tooltip.style.display = 'none';
    };

    const iconSvg = (
      kind: 'eye' | 'settings' | 'delete' | 'up' | 'down' | 'collapse' | 'expand' | 'maximize' | 'restore' | 'menu',
    ) => {
      const map: Record<string, string> = {
        eye: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><path class="eye-lid-top" d="M3 12c2.6-3.4 5.5-5 9-5 3.5 0 6.4 1.6 9 5"></path><path class="eye-lid-bottom" d="M3 12c2.6 3.4 5.5 5 9 5 3.5 0 6.4-1.6 9-5"></path><circle class="eye-iris" cx="12" cy="12" r="2.8"></circle></svg>`,
        settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"></line><circle class="settings-knob-left" cx="9" cy="7" r="2.2"></circle><line x1="4" y1="12" x2="20" y2="12"></line><circle class="settings-knob-right" cx="15" cy="12" r="2.2"></circle><line x1="4" y1="17" x2="20" y2="17"></line><circle class="settings-knob-left" cx="11" cy="17" r="2.2"></circle></svg>`,
        delete: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><polyline class="trash-lid" points="3 6 5 6 21 6"></polyline><path class="trash-body" d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path><circle class="trash-dot-1" cx="9" cy="10.4" r="0.9" fill="currentColor" stroke="none" opacity="0"></circle><circle class="trash-dot-2" cx="12" cy="10.4" r="0.9" fill="currentColor" stroke="none" opacity="0"></circle><circle class="trash-dot-3" cx="15" cy="10.4" r="0.9" fill="currentColor" stroke="none" opacity="0"></circle></svg>`,
        up: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 15.2V4.8M10 4.8 6.8 8.2M10 4.8l3.2 3.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        down: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4.8v10.4M10 15.2l-3.2-3.4M10 15.2l3.2-3.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        collapse: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path class="chev-top" d="M6 4.8 10 8 14 4.8" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="chev-bottom" d="M6 15.2 10 12.4 14 15.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        expand: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path class="chev-top" d="M6 8.4 10 4.6 14 8.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="chev-bottom" d="M6 11.6 10 15.4 14 11.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        maximize: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4.2" y="4.2" width="11.6" height="11.6" rx="2" stroke="currentColor" stroke-width="2"/></svg>`,
        restore: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3.2" y="5.4" width="10.2" height="10.2" rx="1.8" stroke="currentColor" stroke-width="2"/><path d="M6.2 3.2h8.2c1 0 1.8.8 1.8 1.8v8.2" stroke="currentColor" stroke-width="2"/></svg>`,
        menu: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="5" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="10" r="1.6" fill="currentColor"/></svg>`,
      };
      return map[kind];
    };

    const iconBtn = (iconHtml: string, title: string, onClick: () => void, danger = false): HTMLButtonElement => {
      const size = 30;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = iconHtml;
      btn.className = 'panel-title-ctrl-btn';
      if (title === '표시' || title === '감추기') btn.dataset.motion = 'eye';
      if (title === '설정') btn.dataset.motion = 'settings';
      if (title.includes('삭제')) btn.dataset.motion = 'trash';
      btn.style.cssText = `width:${size}px;height:${size}px;border-radius:6px;
        border:none;background:transparent;
        color:${danger ? '#ffd2d7' : '#edf3ff'};cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:background 0.1s ease,color 0.1s ease;
        pointer-events:auto;`;
      btn.title = title;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = danger ? 'rgba(186,40,63,0.42)' : 'rgba(58,126,246,0.34)';
        btn.style.color = '#ffffff';
        showTip(btn, title);
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.color = danger ? '#ffd2d7' : '#edf3ff';
        hideTip();
      });
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
      return btn;
    };

    const rightOffset = Math.max(10, chart.config.layout.rightPadding + 6);
    panelHoverControllers = [];
    const headerBoxHeight = 24;
    const titleHeaderBoxHeight = 30;
    const controlButtonSize = headerBoxHeight;

    panels.forEach((panelId: string, index: number) => {
      const panelH = plotHeight * chart.getPanelRatio(panelId);
      const collapsed = collapsedPanels.has(panelId);
      const headerTop = collapsed
        ? Math.max(2, Math.round(curTop + (panelH - titleHeaderBoxHeight) / 2))
        : Math.max(2, Math.round(curTop + 2));
      const header = document.createElement('div');
      header.style.cssText = `position:absolute;top:${headerTop}px;left:8px;display:flex;align-items:center;gap:8px;
        box-sizing:border-box;height:${titleHeaderBoxHeight}px;line-height:1;padding:0 6px;border-radius:6px;border:1px solid transparent;background:rgba(0,0,0,0.0);pointer-events:auto;z-index:4;`;
      header.style.overflow = 'hidden';

      const infoWrap = document.createElement('div');
      infoWrap.style.cssText = `display:flex;align-items:center;gap:8px;color:#dbe3f4;font:600 12px ${CHART_FONT_STACK};line-height:1;`;
      const titleEl = document.createElement('span');
      titleEl.style.cssText = 'color:#d7dfef;font-weight:700;';

      const settingsWrap = document.createElement('span');
      settingsWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;color:#b3bfd4;';
      const valuesWrap = document.createElement('span');
      valuesWrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';

      const headerData = chart.getIndicatorPanelHeader?.(panelId) ?? null;
      titleEl.textContent = headerData?.title ?? panelId.toUpperCase();
      infoWrap.appendChild(titleEl);

      (headerData?.settings ?? []).forEach((s: { text: string; hint: string }) => {
        const chip = document.createElement('span');
        chip.textContent = s.text;
        chip.style.cssText = 'color:#a9b5cc;cursor:help;';
        chip.addEventListener('mouseenter', () => showTip(chip, s.hint));
        chip.addEventListener('mouseleave', hideTip);
        settingsWrap.appendChild(chip);
      });
      if ((headerData?.settings?.length ?? 0) > 0) infoWrap.appendChild(settingsWrap);

      (headerData?.values ?? []).forEach((v: { text: string; color: string }, valueIndex: number) => {
        const val = document.createElement('span');
        val.textContent = v.text;
        val.style.cssText = `color:${v.color};font-weight:700;cursor:help;`;
        const hint = getValueHint(panelId, valueIndex);
        val.addEventListener('mouseenter', () => showTip(val, hint));
        val.addEventListener('mouseleave', hideTip);
        valuesWrap.appendChild(val);
      });
      if ((headerData?.values?.length ?? 0) > 0) infoWrap.appendChild(valuesWrap);

      const actionWrap = document.createElement('div');
      actionWrap.style.cssText = `display:none;align-items:center;gap:2px;height:${titleHeaderBoxHeight}px;overflow:hidden;`;

      const eyeBtn = iconBtn(iconSvg('eye'), collapsed ? '표시' : '감추기', () => {
        if (collapsedPanels.has(panelId)) {
          const restore = collapsedRatioMemory.get(panelId);
          if (restore != null) chart.config.panelState.panelRatios[panelId] = restore;
          collapsedPanels.delete(panelId);
          collapsedRatioMemory.delete(panelId);
        } else {
          collapsedRatioMemory.set(panelId, chart.getPanelRatio(panelId));
          chart.config.panelState.panelRatios[panelId] = getCollapsedRatio();
          collapsedPanels.add(panelId);
        }
        refreshAll();
      });

      const settingBtn = iconBtn(iconSvg('settings'), '설정', () => {
        openSettingsPopup(settingBtn, chart, panelId, () => {
          refreshAll();
        });
      });

      const trashBtn = iconBtn(iconSvg('delete'), '삭제', () => {
        if ((chart.config.indicators as any)[panelId]) {
          (chart.config.indicators as any)[panelId].show = false;
          collapsedPanels.delete(panelId);
          collapsedRatioMemory.delete(panelId);
          refreshAll();
        }
      }, true);

      actionWrap.appendChild(eyeBtn);
      actionWrap.appendChild(settingBtn);
      actionWrap.appendChild(trashBtn);

      header.addEventListener('mouseenter', () => {
        actionWrap.style.display = 'flex';
        header.style.background = 'rgba(15,21,33,0.60)';
        header.style.borderColor = '#546a93';
        header.style.boxShadow = '0 4px 14px rgba(0,0,0,0.28)';
      });
      header.addEventListener('mouseleave', () => {
        actionWrap.style.display = 'none';
        header.style.background = 'rgba(0,0,0,0.0)';
        header.style.borderColor = 'transparent';
        header.style.boxShadow = 'none';
        hideTip();
      });

      header.appendChild(infoWrap);
      header.appendChild(actionWrap);
      panelControls.appendChild(header);

      const buttonSize = controlButtonSize;
      const rowVisualHeight = headerBoxHeight;
      const rowTop = collapsed
        ? Math.max(2, Math.round(curTop + (panelH - rowVisualHeight) / 2))
        : headerTop;
      const rowPadding = collapsed ? '0 4px' : '0 3px';
      const row = document.createElement('div');
      row.style.cssText = `position:absolute;top:${rowTop}px;right:${rightOffset + 8}px;
        box-sizing:border-box;height:${headerBoxHeight}px;display:flex;align-items:center;gap:4px;padding:${rowPadding};border-radius:10px;
        background:transparent;backdrop-filter:none;pointer-events:auto;z-index:2;`;

      const panelIconBtn = (
        svg: string,
        title: string,
        onClick: () => void,
        danger = false,
        motion: 'none' | 'expand' | 'collapse' | 'trash' = 'none',
      ) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = svg;
        btn.title = title;
        btn.className = 'panel-ctrl-btn';
        if (motion !== 'none') btn.dataset.motion = motion;
        if (danger) btn.dataset.noMotion = '1';
        btn.style.cssText = `width:${buttonSize}px;height:${buttonSize}px;border-radius:5px;
          border:1px solid ${danger ? '#8f3542' : '#5f7090'};
          background:${danger ? 'rgba(126,26,42,0.35)' : 'rgba(15,21,33,0.92)'};
          color:${danger ? '#ffd2d7' : '#edf3ff'};cursor:pointer;display:flex;align-items:center;justify-content:center;
          transition:background 0.1s ease,color 0.1s ease,border-color 0.1s ease;pointer-events:auto;`;
        btn.addEventListener('mouseenter', () => {
          btn.style.background = danger ? 'rgba(186,40,63,0.62)' : 'rgba(58,126,246,0.48)';
          btn.style.color = '#ffffff';
          btn.style.borderColor = danger ? '#cf586a' : '#86acff';
          showTip(btn, title);
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = danger ? 'rgba(126,26,42,0.35)' : 'rgba(15,21,33,0.92)';
          btn.style.color = danger ? '#ffd2d7' : '#edf3ff';
          btn.style.borderColor = danger ? '#8f3542' : '#5f7090';
          hideTip();
        });
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          onClick();
        });
        const svgEl = btn.querySelector('svg') as SVGElement | null;
        if (svgEl) {
          svgEl.style.width = '20px';
          svgEl.style.height = '20px';
          svgEl.style.display = 'block';
          svgEl.style.flex = '0 0 20px';
        }
        return btn;
      };

      const actionWrapRight = document.createElement('div');
      actionWrapRight.style.cssText = 'display:flex;align-items:center;gap:2px;opacity:0;max-width:0;overflow:hidden;transform:translateX(6px);transition:opacity 0.12s ease,max-width 0.16s ease,transform 0.12s ease;';
      const setExpanded = (expanded: boolean) => {
        actionWrapRight.style.opacity = expanded ? '1' : '0';
        actionWrapRight.style.maxWidth = expanded ? '260px' : '0';
        actionWrapRight.style.transform = expanded ? 'translateX(0)' : 'translateX(6px)';
        row.style.background = expanded ? 'rgba(10,14,22,0.56)' : 'transparent';
        row.style.backdropFilter = expanded ? 'blur(2px)' : 'none';
        row.style.zIndex = expanded ? '6' : '2';
      };

      const isMobileOverlay = /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent)
        || (window.matchMedia?.('(pointer: coarse)').matches ?? false)
        || window.innerWidth < 600;

      const collapseBtn = panelIconBtn(
        collapsed ? iconSvg('expand') : iconSvg('collapse'),
        collapsed ? '펼치기' : '접기',
        () => {
          if (collapsedPanels.has(panelId)) {
            const restore = collapsedRatioMemory.get(panelId);
            if (restore != null) chart.config.panelState.panelRatios[panelId] = restore;
            collapsedPanels.delete(panelId);
            collapsedRatioMemory.delete(panelId);
            if (maximizedPanelId === panelId) {
              maximizedPanelId = null;
              maximizeRatioMemory = null;
            }
          } else {
            collapsedRatioMemory.set(panelId, chart.getPanelRatio(panelId));
            chart.config.panelState.panelRatios[panelId] = getCollapsedRatio();
            collapsedPanels.add(panelId);
            if (maximizedPanelId === panelId) {
              maximizedPanelId = null;
              maximizeRatioMemory = null;
            }
          }
          refreshAll();
        },
        false,
        collapsed ? 'expand' : 'collapse',
      );

      const isMaximized = maximizedPanelId === panelId;
      const maxBtn = panelIconBtn(
        isMaximized ? iconSvg('restore') : iconSvg('maximize'),
        isMaximized ? '최대화 해제' : '최대화',
        () => {
          if (maximizedPanelId === panelId && maximizeRatioMemory) {
            const restoreSnapshot = maximizeRatioMemory;
            Object.entries(maximizeRatioMemory).forEach(([id, ratio]) => {
              chart.config.panelState.panelRatios[id] = ratio;
            });
            maximizeRatioMemory = null;
            if (maximizedPanelWasCollapsed) {
              collapsedPanels.add(panelId);
              const restoreRatio = restoreSnapshot[panelId];
              if (Number.isFinite(restoreRatio)) collapsedRatioMemory.set(panelId, restoreRatio);
              chart.config.panelState.panelRatios[panelId] = getCollapsedRatio();
            }
            maximizedPanelWasCollapsed = false;
            maximizedPanelId = null;
          } else {
            maximizeRatioMemory = {};
            panels.forEach((id: string) => {
              maximizeRatioMemory![id] = chart.getPanelRatio(id);
            });
            maximizedPanelWasCollapsed = collapsedPanels.has(panelId);
            if (maximizedPanelWasCollapsed) {
              collapsedPanels.delete(panelId);
              collapsedRatioMemory.delete(panelId);
            }
            const collapsedRatio = getCollapsedRatio();
            const others = panels.filter((id: string) => id !== panelId);
            others.forEach((id: string) => { chart.config.panelState.panelRatios[id] = collapsedRatio; });
            chart.config.panelState.panelRatios[panelId] = 0.275;
            maximizedPanelId = panelId;
          }
          refreshAll();
        },
      );

      const delBtn = panelIconBtn(iconSvg('delete'), '패널 삭제', () => {
        if ((chart.config.indicators as any)[panelId]) {
          (chart.config.indicators as any)[panelId].show = false;
          collapsedPanels.delete(panelId);
          collapsedRatioMemory.delete(panelId);
          if (maximizedPanelId === panelId) {
            maximizedPanelId = null;
            maximizeRatioMemory = null;
          }
          refreshAll();
        }
      }, true, 'trash');

      // 최상단은 upBtn 제거, 최하단은 downBtn 제거
      if (index > 0) {
        actionWrapRight.appendChild(panelIconBtn(iconSvg('up'), '위로 이동', () => {
          chart.shiftPanelOrder(panelId, -1);
          refreshAll();
        }));
      }
      if (index < panels.length - 1) {
        actionWrapRight.appendChild(panelIconBtn(iconSvg('down'), '아래로 이동', () => {
          chart.shiftPanelOrder(panelId, 1);
          refreshAll();
        }));
      }
      actionWrapRight.appendChild(collapseBtn);
      actionWrapRight.appendChild(maxBtn);
      // 모바일에서는 우측 컨트롤의 휴지통 제거
      if (!isMobileOverlay) {
        actionWrapRight.appendChild(delBtn);
      }
      row.appendChild(actionWrapRight);
      panelControls.appendChild(row);
      panelHoverControllers.push({
        id: panelId,
        top: curTop,
        bottom: curTop + panelH,
        setExpanded,
      });
      setExpanded(hoveredPanelId === panelId);

      curTop += panelH;
    });
  };

  return renderOverlay;
}

