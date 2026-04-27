import { getLineStyle } from '../indicator-panel-module';
import { INDICATOR_CATALOG } from '../catalog/indicators';
import { INDICATOR_STYLE_TARGETS } from '../indicator-panel-module';
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
    pointer-events:none;display:flex;flex-direction:column;gap:1px;`;
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
  let activeMobileMainTag: HTMLDivElement | null = null;
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
  container.addEventListener('touchstart', (event) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (!overlay.contains(target)) {
      activeMobileMainTag?.classList.remove('indicator-overlay-main-tag-mobile-active');
      activeMobileMainTag = null;
    }
  }, { passive: true });

  const renderOverlay = () => {
    syncHiddenPanelState();
    overlay.innerHTML = '';
    panelControls.innerHTML = '';
    const ind = chart.config.indicators;
    const strategies = chart.getStrategies() as StrategyDefinition[];
    const activeStrategyId = chart.getActiveStrategyId();
    const activeStrategy = strategies.find((s) => s.id === activeStrategyId);
    const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const compactOverlay = !isTouchDevice && window.innerWidth < 600;
    // 모바일 터치: 태그 폰트/패딩을 보조지표 타이틀 수준(13px)으로 확대
    const touchLarge = isTouchDevice;
    const tagFontSize = touchLarge ? 13 : (compactOverlay ? 11 : 12);
    const tagPadX = touchLarge ? '1px 3px' : (compactOverlay ? '1px 3px' : '2px 5px');
    const tagGap = touchLarge ? 3 : (compactOverlay ? 2 : 3);
    const tagLineH = touchLarge ? 1.3 : (compactOverlay ? 1.2 : 1.35);
    const isMobileOverlay = /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent)
      || isTouchDevice
      || window.innerWidth < 600;
    activeMobileMainTag = null;
    const marketLeftInset = chart.config.layout.marketInfoSide === 'left'
      ? Math.max(0, chart.config.layout.rightPadding)
      : 0;
    overlay.style.left = `${8 + marketLeftInset}px`;
    overlay.style.maxWidth = (compactOverlay || touchLarge)
      ? `calc(100% - ${marketLeftInset + 16}px)`
      : 'none';
    overlay.style.gap = '0px';

    const getIndicatorStyleKeys = (targetKey: string): string[] => {
      const indicators = chart.config.indicators as any;
      if (targetKey === 'ma') {
        const maLines = Array.isArray(indicators.ma?.lines) ? indicators.ma.lines : [];
        return maLines.map((line: any, index: number) => String(line.id || `ma${index + 1}`));
      }
      if (targetKey === 'bb') {
        const bbLines = Array.isArray(indicators.bb?.lines)
          ? indicators.bb.lines
          : [{ id: 'bb1' }];
        return bbLines.flatMap((line: any, index: number) => {
          const id = String(line.id || `bb${index + 1}`);
          return [`${id}Upper`, `${id}Middle`, `${id}Lower`];
        });
      }
      return (INDICATOR_STYLE_TARGETS[targetKey] ?? []).map((item) => item.key);
    };

    const isIndicatorLineVisible = (targetKey: string): boolean => {
      const styleKeys = getIndicatorStyleKeys(targetKey);
      if (!styleKeys.length) return true;
      return styleKeys.some((styleKey) => chart.isIndicatorLineVisible?.(styleKey) !== false);
    };

    const setIndicatorLineVisible = (targetKey: string, visible: boolean) => {
      const styleKeys = getIndicatorStyleKeys(targetKey);
      if (!styleKeys.length) return;
      styleKeys.forEach((styleKey) => chart.setIndicatorLineVisible?.(styleKey, visible));
      chart.draw();
      renderOverlay();
      onOverlayChange?.();
    };

    const actionIconSz = touchLarge ? 18 : 12;
    const eyeIconSvg = (visible: boolean): string => (
      visible
        ? `<svg viewBox="0 0 24 24" width="${actionIconSz}" height="${actionIconSz}" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12"></path><circle cx="12" cy="12" r="2.8"></circle><line x1="4" y1="20" x2="20" y2="4"></line></svg>`
        : `<svg viewBox="0 0 24 24" width="${actionIconSz}" height="${actionIconSz}" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12"></path><circle cx="12" cy="12" r="2.8"></circle></svg>`
    );

    const makeTagActionButton = (title: string, svg: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = title;
      btn.innerHTML = svg;
      const actionBtnSz = touchLarge ? 19 : (compactOverlay ? 15 : 16);
      btn.style.cssText = `width:${actionBtnSz}px;height:${actionBtnSz}px;
        display:inline-flex;align-items:center;justify-content:center;
        border:1px solid rgba(121,136,166,0.45);border-radius:4px;background:rgba(15,21,33,0.9);
        color:#d3def4;cursor:pointer;padding:0;`;
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
      return btn;
    };

    const addTagActions = (
      tag: HTMLDivElement,
      key: string,
      openSettings: () => void,
      hoverEnter: () => void,
      hoverLeave: () => void,
    ) => {
      const actions = document.createElement('span');
      actions.className = 'indicator-overlay-tag-actions';
      actions.style.cssText = `display:none;align-items:center;gap:${touchLarge ? 3 : 2}px;`;
      const currentlyVisible = isIndicatorLineVisible(key);
      const hideBtn = makeTagActionButton(
        currentlyVisible ? '감추기' : '표시',
        eyeIconSvg(currentlyVisible),
        () => setIndicatorLineVisible(key, !currentlyVisible),
      );
      const settingsBtn = makeTagActionButton(
        '설정',
        `<svg viewBox="0 0 24 24" width="${actionIconSz}" height="${actionIconSz}" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"></line><circle cx="9" cy="7" r="2"></circle><line x1="4" y1="12" x2="20" y2="12"></line><circle cx="15" cy="12" r="2"></circle><line x1="4" y1="17" x2="20" y2="17"></line><circle cx="11" cy="17" r="2"></circle></svg>`,
        openSettings,
      );
      actions.appendChild(hideBtn);
      actions.appendChild(settingsBtn);
      tag.appendChild(actions);
      const valueEls = Array.from(tag.querySelectorAll<HTMLElement>('.indicator-overlay-tag-value'));
      const setMobileActiveState = (active: boolean) => {
        tag.classList.toggle('indicator-overlay-main-tag-mobile-active', active);
        valueEls.forEach((el) => { el.style.display = active ? 'none' : ''; });
        actions.style.display = active ? 'inline-flex' : 'none';
      };
      tag.addEventListener('mouseenter', () => {
        if (isMobileOverlay) return;
        hoverEnter();
        actions.style.display = 'inline-flex';
      });
      tag.addEventListener('mouseleave', () => {
        if (isMobileOverlay) return;
        hoverLeave();
        actions.style.display = 'none';
      });
      if (isMobileOverlay) {
        tag.addEventListener('click', (event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          event.preventDefault();
          event.stopPropagation();
          const nextActive = activeMobileMainTag !== tag;
          if (activeMobileMainTag && activeMobileMainTag !== tag) {
            activeMobileMainTag.classList.remove('indicator-overlay-main-tag-mobile-active');
            Array.from(activeMobileMainTag.querySelectorAll<HTMLElement>('.indicator-overlay-tag-value'))
              .forEach((el) => { el.style.display = ''; });
            const prevActions = activeMobileMainTag.querySelector<HTMLElement>('.indicator-overlay-tag-actions');
            if (prevActions) prevActions.style.display = 'none';
          }
          if (nextActive) {
            activeMobileMainTag = tag;
          } else {
            activeMobileMainTag = null;
          }
          setMobileActiveState(nextActive);
        });
      }
    };

    const makeTag = (label: string, color: string, key: string) => {
      const tag = document.createElement('div');
      tag.style.cssText = `position:relative;display:inline-flex;align-items:center;gap:${tagGap}px;max-width:fit-content;
        background:transparent;border:1px solid transparent;border-radius:3px;
        padding:${tagPadX};font-size:${tagFontSize}px;font-family:${CHART_FONT_STACK};color:${color};
        pointer-events:auto;cursor:pointer;transition:border-color 0.15s;line-height:${tagLineH};text-shadow:0 1px 2px rgba(0,0,0,0.72);`;
      const textEl = document.createElement('span');
      textEl.className = 'indicator-overlay-tag-name';
      textEl.textContent = label;
      tag.appendChild(textEl);
      const openSettings = () => openSettingsPopup(tag, chart, key, () => {
        const updated = buildLabel(chart, key);
        if (updated) textEl.textContent = updated;
        renderOverlay();
        onOverlayChange?.();
      });
      addTagActions(
        tag,
        key,
        openSettings,
        () => { tag.style.borderColor = 'rgba(74,78,94,0.6)'; },
        () => { tag.style.borderColor = 'transparent'; },
      );
      if (!isMobileOverlay) {
        tag.addEventListener('click', openSettings);
      }
      return tag;
    };

    const makeStrategyTag = (label: string) => {
      const tag = document.createElement('div');
      tag.style.cssText = `display:inline-flex;align-items:center;gap:2px;max-width:none;
        background:transparent;border:none;border-radius:0;
        padding:${tagPadX};font-size:${tagFontSize}px;font-family:${CHART_FONT_STACK};color:#f5f7fb;
        pointer-events:auto;cursor:default;box-sizing:border-box;overflow:visible;white-space:nowrap;line-height:${tagLineH};text-shadow:0 1px 2px rgba(0,0,0,0.72);`;
      const textEl = document.createElement('span');
      textEl.textContent = label;
      textEl.style.cssText = 'white-space:nowrap;';
      const isVisible = chart.isStrategySignalVisible?.() !== false;
      const visibilityBtn = document.createElement('button');
      visibilityBtn.type = 'button';
      visibilityBtn.className = 'strategy-visibility-btn';
      visibilityBtn.title = isVisible ? '전략시그널 감추기' : '전략시그널 보이기';
      const eyeSvgSz = actionIconSz;
      const eyeBtnSz = touchLarge ? 22 : (compactOverlay ? 16 : 18);
      const reportSvgSz = touchLarge ? 14 : (compactOverlay ? 10 : 10);
      const reportBtnSz = touchLarge ? 18 : (compactOverlay ? 14 : 16);
      visibilityBtn.style.cssText = `width:${eyeBtnSz}px;height:${eyeBtnSz}px;border:none;border-radius:4px;
        background:transparent;color:#edf3ff;display:inline-flex;align-items:center;justify-content:center;
        padding:0;cursor:pointer;transition:color 0.15s ease;flex:0 0 auto;`;
      visibilityBtn.innerHTML = isVisible
        ? `<svg viewBox="0 0 24 24" width="${eyeSvgSz}" height="${eyeSvgSz}" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><path class="eye-lid-top" d="M3 12c2.6-3.4 5.5-5 9-5 3.5 0 6.4 1.6 9 5"></path><path class="eye-lid-bottom" d="M3 12c2.6 3.4 5.5 5 9 5 3.5 0 6.4-1.6 9-5"></path><circle class="eye-iris" cx="12" cy="12" r="2.8"></circle></svg>`
        : `<svg viewBox="0 0 24 24" width="${eyeSvgSz}" height="${eyeSvgSz}" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="2.8"></circle><line x1="4" y1="20" x2="20" y2="4"></line></svg>`;
      visibilityBtn.addEventListener('mouseenter', () => { visibilityBtn.style.color = '#ffffff'; });
      visibilityBtn.addEventListener('mouseleave', () => { visibilityBtn.style.color = '#edf3ff'; });
      visibilityBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        chart.setStrategySignalVisible?.(!isVisible);
        renderOverlay();
      });
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.title = '전략리포트';
      reportBtn.style.cssText = `width:${reportBtnSz}px;height:${reportBtnSz}px;border:1px solid #3a4158;border-radius:3px;
        background:#ffffff;color:#0f1218;display:inline-flex;align-items:center;justify-content:center;
        padding:0;cursor:pointer;transition:border-color 0.15s ease;flex:0 0 auto;`;
      reportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="${reportSvgSz}" height="${reportSvgSz}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 16 9 11 13 13 19 7"></polyline>
        <path d="M5 4v4"></path><path d="M3 7l2 2 2-2"></path>
        <path d="M19 17v-4"></path><path d="M17 15l2-2 2 2"></path>
      </svg>`;
      reportBtn.addEventListener('mouseenter', () => { reportBtn.style.borderColor = '#9aa3b3'; });
      reportBtn.addEventListener('mouseleave', () => { reportBtn.style.borderColor = '#3a4158'; });
      reportBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('chart-open-strategy-report', { detail: { chart } }));
      });
      tag.appendChild(textEl);
      tag.appendChild(visibilityBtn);
      tag.appendChild(reportBtn);
      return tag;
    };

    const makeRichTag = (
      parts: Array<{ text: string; color?: string }>,
      key: string,
      fallbackColor = '#dbe3f4',
    ) => {
      const tag = document.createElement('div');
      tag.style.cssText = `position:relative;display:inline-flex;align-items:center;gap:${touchLarge ? 6 : (compactOverlay ? 3 : 5)}px;max-width:fit-content;
        background:transparent;border:1px solid transparent;border-radius:3px;
        padding:${tagPadX};font-size:${tagFontSize}px;font-family:${CHART_FONT_STACK};color:${fallbackColor};
        pointer-events:auto;cursor:pointer;transition:border-color 0.15s;line-height:${tagLineH};text-shadow:0 1px 2px rgba(0,0,0,0.72);`;
      const textWrap = document.createElement('span');
      textWrap.className = 'indicator-overlay-tag-name';
      textWrap.style.cssText = `display:inline-flex;align-items:center;gap:${compactOverlay ? 3 : 5}px;`;
      parts.forEach((part, index) => {
        const partEl = document.createElement('span');
        partEl.textContent = part.text;
        partEl.style.color = part.color ?? fallbackColor;
        partEl.className = index === 0 ? 'indicator-overlay-tag-name' : 'indicator-overlay-tag-value';
        textWrap.appendChild(partEl);
      });
      tag.appendChild(textWrap);
      const openSettings = () => openSettingsPopup(tag, chart, key, () => {
        renderOverlay();
        onOverlayChange?.();
      });
      addTagActions(
        tag,
        key,
        openSettings,
        () => { tag.style.borderColor = 'rgba(74,78,94,0.6)'; },
        () => { tag.style.borderColor = 'transparent'; },
      );
      if (!isMobileOverlay) {
        tag.addEventListener('click', openSettings);
      }
      return tag;
    };

    const buildLabel = (c: any, key: string): string => {
      const i = c.config.indicators as any;
      const maLines = Array.isArray(i.ma?.lines) ? i.ma.lines : [];
      const bbLines = Array.isArray(i.bb?.lines)
        ? i.bb.lines
        : (i.bb?.show ? [{ period: i.bb.period, stdDev: i.bb.stdDev }] : []);
      const map: Record<string, () => string> = {
        ma:       () => maLines.length
          ? `MA ${maLines.map((line: any) => Number(line.period ?? line.value ?? 20)).join(' ')}`
          : 'MA',
        maShort:  () => `MA ${i.maShort.value}`,
        maLong:   () => `MA ${i.maLong.value}`,
        ma60:     () => `MA ${i.ma60.value}`,
        ma120:    () => `MA ${i.ma120.value}`,
        ma200:    () => `MA ${i.ma200.value}`,
        bb:       () => bbLines.length
          ? `BB ${bbLines.map((line: any) => `${Number(line.period ?? 20)} ${Number(line.stdDev ?? 2)}`).join(' / ')}`
          : `BB ${i.bb.period} ${i.bb.stdDev}`,
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
        statisticalTrailingStop: () => `STS(${i.statisticalTrailingStop.dataLength}, ${i.statisticalTrailingStop.distributionLength}, L${i.statisticalTrailingStop.baseLevel})`,
        zeroLagMaTrendLevels: () => `ZLMA(${Number(i.zeroLagMaTrendLevels?.length ?? 15)})`,
        volumeProfile: () => {
          const cfg = i.volumeProfile;
          const rows = Number(cfg?.rows ?? 24);
          const widthPct = Number(cfg?.widthPct ?? 22);
          return `매물대(${rows}, ${widthPct}%)`;
        },
        vpvr: () => {
          const cfg = i.vpvr;
          const rows = cfg?.rowsLayout === 'ticks_per_row'
            ? Number(cfg?.rowSize ?? 50)
            : Number(cfg?.rowSize ?? 50);
          const widthPct = Number(cfg?.widthPct ?? 22);
          const rowLabel = cfg?.rowsLayout === 'ticks_per_row' ? `T${rows}` : `R${rows}`;
          return `VPVR(${rowLabel}, ${widthPct}%)`;
        },
        volume:   () => 'Volume',
      };
      return map[key]?.() ?? key;
    };

    const colorMap: Record<string, string> = {
      ma: getLineStyle(chart.config.panelState, ((chart.config.indicators as any).ma?.lines?.[0]?.id ?? 'ma1'), { color: '#f7931a', width: 1.5, dash: [] }).color,
      maShort: getLineStyle(chart.config.panelState, 'maShort', { color: '#f7931a', width: 1.5, dash: [] }).color,
      maLong: getLineStyle(chart.config.panelState, 'maLong', { color: '#2962ff', width: 1.5, dash: [] }).color,
      ma60: getLineStyle(chart.config.panelState, 'ma60', { color: '#4caf50', width: 1.5, dash: [] }).color,
      ma120: getLineStyle(chart.config.panelState, 'ma120', { color: '#9c27b0', width: 1.5, dash: [] }).color,
      ma200: getLineStyle(chart.config.panelState, 'ma200', { color: '#ff5722', width: 1.5, dash: [] }).color,
      bb: getLineStyle(chart.config.panelState, ((chart.config.indicators as any).bb?.lines?.[0]?.id ?? 'bb1') + 'Upper', { color: 'rgba(100,149,237,0.95)', width: 1, dash: [] }).color,
      vwap: getLineStyle(chart.config.panelState, 'vwap', { color: '#ff9800', width: 1.5, dash: [] }).color,
      ichimoku: '#aaaaff',
      envelope: getLineStyle(chart.config.panelState, 'envelopeUpper', { color: 'rgba(255,200,50,0.95)', width: 1, dash: [] }).color,
      supertrend: getLineStyle(chart.config.panelState, 'supertrendUp', { color: '#26a69a', width: 1.7, dash: [] }).color,
      statisticalTrailingStop: getLineStyle(chart.config.panelState, 'statisticalTrailingStopBull', { color: '#26a69a', width: 1.7, dash: [] }).color,
      zeroLagMaTrendLevels: getLineStyle(chart.config.panelState, 'zeroLagMaTrendLevelsZlma', { color: '#30d453', width: 1, dash: [] }).color,
      volumeProfile: getLineStyle(chart.config.panelState, 'volumeProfilePoc', { color: 'rgba(255,193,7,0.95)', width: 1.2, dash: [4, 3] }).color,
      vpvr: String((chart.config.indicators as any).vpvr?.pocColor ?? '#ffc107'),
      rsi: getLineStyle(chart.config.panelState, 'rsi', { color: '#ffeb3b', width: 1.5, dash: [] }).color,
      dmi: getLineStyle(chart.config.panelState, 'dmiPlus', { color: '#26a69a', width: 1.5, dash: [] }).color,
      macd: getLineStyle(chart.config.panelState, 'macdLine', { color: '#2962ff', width: 1.5, dash: [] }).color,
      stochF: getLineStyle(chart.config.panelState, 'stochFastK', { color: '#26a69a', width: 1.5, dash: [] }).color,
      stochS: getLineStyle(chart.config.panelState, 'stochSlowK', { color: '#26a69a', width: 1.5, dash: [] }).color,
      cci: getLineStyle(chart.config.panelState, 'cci', { color: '#26a69a', width: 1.5, dash: [] }).color,
      obv: getLineStyle(chart.config.panelState, 'obv', { color: '#26a69a', width: 1.5, dash: [] }).color,
      volume: '#84898e',
    };

    const getMainIndicatorTag = (key: string): HTMLElement => {
      const chartIndicators = chart.config.indicators as any;
      if (key === 'ma') {
        const maLines = Array.isArray(chartIndicators.ma?.lines) ? chartIndicators.ma.lines : [];
        const parts = [{ text: 'MA', color: '#dbe3f4' }];
        maLines.forEach((line: any, index: number) => {
          const styleKey = String(line.id || `ma${index + 1}`);
          const style = getLineStyle(chart.config.panelState, styleKey, { color: colorMap.ma, width: 1.5, dash: [] });
          parts.push({ text: String(Number(line.period ?? line.value ?? 20)), color: style.color });
        });
        return makeRichTag(parts, key, '#dbe3f4');
      }
      if (key === 'bb') {
        const bbLines = Array.isArray(chartIndicators.bb?.lines)
          ? chartIndicators.bb.lines
          : [{ id: 'bb1', period: chartIndicators.bb?.period ?? 20, stdDev: chartIndicators.bb?.stdDev ?? 2 }];
        const parts = [{ text: 'BB', color: '#dbe3f4' }];
        bbLines.forEach((line: any, index: number) => {
          const styleKey = `${String(line.id || `bb${index + 1}`)}Upper`;
          const style = getLineStyle(chart.config.panelState, styleKey, { color: colorMap.bb, width: 1, dash: [] });
          if (index > 0) parts.push({ text: '/', color: '#8b95aa' });
          parts.push({ text: `${Number(line.period ?? 20)} ${Number(line.stdDev ?? 2)}`, color: style.color });
        });
        return makeRichTag(parts, key, '#dbe3f4');
      }
      if (key === 'volumeProfile') {
        const cfg = chartIndicators.volumeProfile;
        const parts = [
          { text: '매물대', color: '#dbe3f4' },
          { text: String(Number(cfg?.rows ?? 24)), color: getLineStyle(chart.config.panelState, 'volumeProfilePoc', { color: colorMap.volumeProfile, width: 1.2, dash: [4, 3] }).color },
          { text: `${Number(cfg?.widthPct ?? 22)}%`, color: getLineStyle(chart.config.panelState, 'volumeProfileUp', { color: '#26a69a', width: 1, dash: [] }).color },
        ];
        return makeRichTag(parts, key, '#dbe3f4');
      }
      if (key === 'vpvr') {
        const cfg = chartIndicators.vpvr ?? {};
        const rowLabel = cfg.rowsLayout === 'ticks_per_row'
          ? `T${Number(cfg.rowSize ?? 50)}`
          : `R${Number(cfg.rowSize ?? 50)}`;
        return makeRichTag([
          { text: 'VPVR', color: '#dbe3f4' },
          { text: rowLabel, color: colorMap.vpvr },
          { text: `${Number(cfg.widthPct ?? 22)}%`, color: colorMap.vpvr },
        ], key, '#dbe3f4');
      }
      const c = colorMap[key] ?? '#84898e';
      const i = chartIndicators;
      const richParts: Array<{ text: string; color?: string }> = (() => {
        switch (key) {
          case 'maShort':  return [{ text: 'MA', color: '#dbe3f4' }, { text: String(i.maShort.value), color: c }];
          case 'maLong':   return [{ text: 'MA', color: '#dbe3f4' }, { text: String(i.maLong.value),  color: c }];
          case 'ma60':     return [{ text: 'MA', color: '#dbe3f4' }, { text: String(i.ma60.value),    color: c }];
          case 'ma120':    return [{ text: 'MA', color: '#dbe3f4' }, { text: String(i.ma120.value),   color: c }];
          case 'ma200':    return [{ text: 'MA', color: '#dbe3f4' }, { text: String(i.ma200.value),   color: c }];
          case 'vwap':     return [{ text: 'VWAP', color: c }];
          case 'ichimoku': return [{ text: 'Ichi', color: '#dbe3f4' }, { text: String(i.ichimoku.tenkan), color: c }, { text: String(i.ichimoku.kijun), color: c }];
          case 'envelope': return [{ text: 'Env', color: '#dbe3f4' }, { text: String(i.envelope.period), color: c }, { text: `${i.envelope.pct}%`, color: c }];
          case 'supertrend': return [{ text: 'ST', color: '#dbe3f4' }, { text: String(i.supertrend.period), color: c }, { text: String(i.supertrend.factor), color: c }];
          case 'statisticalTrailingStop': return [{ text: 'STS', color: '#dbe3f4' }, { text: String(i.statisticalTrailingStop.dataLength), color: c }, { text: String(i.statisticalTrailingStop.distributionLength), color: c }, { text: `L${i.statisticalTrailingStop.baseLevel}`, color: c }];
          case 'zeroLagMaTrendLevels': return [{ text: 'ZLMA', color: '#dbe3f4' }, { text: String(Number(i.zeroLagMaTrendLevels?.length ?? 15)), color: c }];
          case 'rsi':    return [{ text: 'RSI',  color: '#dbe3f4' }, { text: String(i.rsi.period),  color: c }];
          case 'dmi':    return [{ text: 'DMI',  color: '#dbe3f4' }, { text: String(i.dmi.period),  color: c }];
          case 'macd':   return [{ text: 'MACD', color: '#dbe3f4' }, { text: String(i.macd.fast), color: c }, { text: String(i.macd.slow), color: c }, { text: String(i.macd.signal), color: c }];
          case 'stochF': return [{ text: 'StF',  color: '#dbe3f4' }, { text: String(i.stochF.kPeriod), color: c }, { text: String(i.stochF.dPeriod), color: c }];
          case 'stochS': return [{ text: 'StS',  color: '#dbe3f4' }, { text: String(i.stochS.kPeriod), color: c }, { text: String(i.stochS.dPeriod), color: c }];
          case 'cci':    return [{ text: 'CCI',  color: '#dbe3f4' }, { text: String(i.cci.period),  color: c }];
          case 'obv':    return [{ text: 'OBV',  color: c }];
          case 'volume': return [{ text: 'Vol',  color: c }];
          default:       return [{ text: key.toUpperCase(), color: c }];
        }
      })();
      return makeRichTag(richParts, key, '#dbe3f4');
    };

    const mainRow = document.createElement('div');
    mainRow.style.cssText = (compactOverlay || touchLarge)
      ? `display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;align-content:flex-start;gap:${touchLarge ? 2 : 2}px;row-gap:${touchLarge ? 2 : 2}px;white-space:normal;max-width:100%;`
      : 'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:3px;white-space:nowrap;';
    const strategyRow = document.createElement('div');
    strategyRow.style.cssText = compactOverlay
      ? 'display:flex;flex-direction:row;align-items:center;gap:2px;margin-top:0;'
      : `display:flex;flex-direction:row;align-items:center;gap:3px;margin-top:${touchLarge ? '1px' : '1px'};`;
    const subColumn = document.createElement('div');
    subColumn.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    const panelMap: Record<string, string> = {};
    INDICATOR_CATALOG.forEach((item) => {
      panelMap[item.id] = item.panel;
    });

    const allKeys = [
      'ma','maShort','maLong','ma60','ma120','ma200','bb','vwap','volumeProfile','vpvr','ichimoku','envelope',
      'supertrend','statisticalTrailingStop','zeroLagMaTrendLevels',
      'rsi','dmi','macd','stochF','stochS','cci','obv','volume',
    ];
    allKeys.forEach(key => {
      const enabled = Boolean((ind as any)[key]?.show);
      if (enabled && !collapsedPanels.has(key)) {
        const tag = getMainIndicatorTag(key);
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
      strategyRow.appendChild(makeStrategyTag(strategyLabel));
    }

    if (mainRow.children.length) overlay.appendChild(mainRow);
    if (strategyRow.children.length) overlay.appendChild(strategyRow);
    // Sub-indicator tags are hidden here because each sub panel has its own header.

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
      header.style.maxWidth = `calc(100% - ${rightOffset + 90}px)`;

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

      const panelVisible = isIndicatorLineVisible(panelId);
      const eyeBtn = iconBtn(iconSvg('eye'), panelVisible ? '감추기' : '표시', () => {
        setIndicatorLineVisible(panelId, !panelVisible);
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
        // 모바일: 수치값/설정값 숨김
        if (isMobileOverlay) {
          settingsWrap.style.display = 'none';
          valuesWrap.style.display   = 'none';
        }
      });
      header.addEventListener('mouseleave', () => {
        actionWrap.style.display = 'none';
        header.style.background = 'rgba(0,0,0,0.0)';
        header.style.borderColor = 'transparent';
        header.style.boxShadow = 'none';
        if (isMobileOverlay) {
          settingsWrap.style.display = '';
          valuesWrap.style.display   = '';
        }
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

