type MonitorMode = 'single' | 'multi';

type CreateTopBarArgs = {
  app: HTMLElement;
  splitPresets: readonly number[];
  getSplitCount: () => number;
  getSplitPreset: () => number;
  getMonitorMode: () => MonitorMode;
  setMonitorMode: (mode: MonitorMode) => void;
  onApplySplitLayout: (count: number) => void;
  onOpenMultiMonitor: () => void;
  onSaveScreenshot: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  isPaneMaximized: () => boolean;
  onExitMaximize: () => void;
};

type LayoutIconType =
  | 'single'
  | 'v-split'
  | 'grid-4'
  | 'grid-6'
  | 'grid-8'
  | 'monitor-single'
  | 'monitor-dual'
  | 'monitor-triple';

const screenshotSvgIcon = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h3l1.2-2h7.6L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
`;

const fullscreenSvgIcon = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="9 3 3 3 3 9"></polyline>
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="21 15 21 21 15 21"></polyline>
    <polyline points="9 21 3 21 3 15"></polyline>
  </svg>
`;

const settingsSvgIcon = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12,8a4,4,0,1,0,4,4A4,4,0,0,0,12,8Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,14Z"/>
    <path d="M21.294,13.9l-.444-.256a9.1,9.1,0,0,0,0-3.29l.444-.256a3,3,0,1,0-3-5.2l-.445.257A8.977,8.977,0,0,0,15,3.513V3A3,3,0,0,0,9,3v.513A8.977,8.977,0,0,0,6.152,5.159L5.705,4.9a3,3,0,0,0-3,5.2l.444.256a9.1,9.1,0,0,0,0,3.29l-.444.256a3,3,0,1,0,3,5.2l.445-.257A8.977,8.977,0,0,0,9,20.487V21a3,3,0,0,0,6,0v-.513a8.977,8.977,0,0,0,2.848-1.646l.447.258a3,3,0,0,0,3-5.2Zm-2.548-3.776a7.048,7.048,0,0,1,0,3.75,1,1,0,0,0,.464,1.133l1.084.626a1,1,0,0,1-1,1.733l-1.086-.628a1,1,0,0,0-1.215.165,6.984,6.984,0,0,1-3.243,1.875,1,1,0,0,0-.751.969V21a1,1,0,0,1-2,0V19.748a1,1,0,0,0-.751-.969A6.984,6.984,0,0,1,7.006,16.9a1,1,0,0,0-1.215-.165l-1.084.627a1,1,0,1,1-1-1.732l1.084-.626a1,1,0,0,0,.464-1.133,7.048,7.048,0,0,1,0-3.75A1,1,0,0,0,4.79,8.992L3.706,8.366a1,1,0,0,1,1-1.733l1.086.628A1,1,0,0,0,7.006,7.1a6.984,6.984,0,0,1,3.243-1.875A1,1,0,0,0,11,4.252V3a1,1,0,0,1,2,0V4.252a1,1,0,0,0,.751.969A6.984,6.984,0,0,1,16.994,7.1a1,1,0,0,0,1.215.165l1.084-.627a1,1,0,1,1,1,1.732l-1.084.626A1,1,0,0,0,18.746,10.125Z"/>
  </svg>
`;

const restoreSvgIcon = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 8h11v11H8z"></path>
    <path d="M5 5h11v11"></path>
  </svg>
`;

const closeSvgIcon = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="6" y1="6" x2="18" y2="18"></line>
    <line x1="18" y1="6" x2="6" y2="18"></line>
  </svg>
`;

const layoutIconSvg = (type: LayoutIconType, size = 18, color = 'currentColor') => {
  const strokeWidth = type.includes('grid')
    ? (type.includes('6') ? 1.8 : (type.includes('8') ? 1.6 : 2))
    : 2;
  const svgOpen = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
  const svgClose = '</svg>';
  const body = (() => {
    switch (type) {
      case 'grid-8':
        return `
          <rect x="1" y="3" width="22" height="18" rx="1" ry="1"></rect>
          <line x1="6.5" y1="3" x2="6.5" y2="21"></line>
          <line x1="12" y1="3" x2="12" y2="21"></line>
          <line x1="17.5" y1="3" x2="17.5" y2="21"></line>
          <line x1="1" y1="12" x2="23" y2="12"></line>
        `;
      case 'grid-6':
        return `
          <rect x="2" y="3" width="20" height="18" rx="1.5" ry="1.5"></rect>
          <line x1="8.6" y1="3" x2="8.6" y2="21"></line>
          <line x1="15.3" y1="3" x2="15.3" y2="21"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
        `;
      case 'grid-4':
        return `
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="3" x2="12" y2="21"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
        `;
      case 'v-split':
        return `
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="3" x2="12" y2="21"></line>
        `;
      case 'monitor-single':
        return `
          <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
          <line x1="8" y1="20" x2="16" y2="20"></line>
          <line x1="12" y1="16" x2="12" y2="20"></line>
        `;
      case 'monitor-dual':
        return `
          <rect x="1" y="5" width="10" height="10" rx="1.5" ry="1.5"></rect>
          <rect x="13" y="5" width="10" height="10" rx="1.5" ry="1.5"></rect>
          <line x1="3" y1="18" x2="9" y2="18"></line>
          <line x1="6" y1="15" x2="6" y2="18"></line>
          <line x1="15" y1="18" x2="21" y2="18"></line>
          <line x1="18" y1="15" x2="18" y2="18"></line>
        `;
      case 'monitor-triple':
        return `
          <rect x="6" y="2" width="12" height="6" rx="1" ry="1"></rect>
          <rect x="1" y="9" width="10" height="6" rx="1" ry="1"></rect>
          <rect x="13" y="9" width="10" height="6" rx="1" ry="1"></rect>
          <rect x="6" y="16" width="12" height="6" rx="1" ry="1"></rect>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="22" x2="12" y2="20"></line>
        `;
      case 'single':
      default:
        return '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
    }
  })();
  return `${svgOpen}${body}${svgClose}`;
};

const splitTypeByCount = (count: number): LayoutIconType => {
  if (count <= 1) return 'single';
  if (count <= 2) return 'v-split';
  if (count <= 4) return 'grid-4';
  if (count <= 6) return 'grid-6';
  return 'grid-8';
};

const TOP_BRAND_STYLE_ID = 'tradingcore-brand-flare-style';
const TOP_BRAND_INTERVAL_FLAG = '__tradingcoreBrandFlareIntervalBound__';
const TOP_BRAND_INTERVAL_MS = 5 * 60 * 1000;

const ensureTopBrandFlareStyle = () => {
  if (document.getElementById(TOP_BRAND_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOP_BRAND_STYLE_ID;
  style.textContent = `
    .tc-brand-logo{
      position:relative;
      display:flex;
      align-items:center;
      gap:2px;
      transform-origin:left center;
    }
    .tc-brand-logo.flare-active{
      animation:tcBrandGrow 0.9s ease-in-out;
    }
    @keyframes tcBrandGrow{
      0%{transform:scale(1);filter:brightness(1);}
      35%{transform:scale(1.08);filter:brightness(1.18);}
      100%{transform:scale(1);filter:brightness(1);}
    }
  `;
  document.head.appendChild(style);
};

const playTopBrandFlare = (el: HTMLElement) => {
  el.classList.remove('flare-active');
  void el.offsetWidth;
  el.classList.add('flare-active');
};

const setupTopBrandFlare = (el: HTMLElement) => {
  ensureTopBrandFlareStyle();
  playTopBrandFlare(el);
  const w = window as typeof window & { [TOP_BRAND_INTERVAL_FLAG]?: boolean };
  if (w[TOP_BRAND_INTERVAL_FLAG]) return;
  w[TOP_BRAND_INTERVAL_FLAG] = true;
  window.setInterval(() => {
    const activeLogo = document.querySelector('.tc-brand-logo') as HTMLElement | null;
    if (activeLogo) playTopBrandFlare(activeLogo);
  }, TOP_BRAND_INTERVAL_MS);
};

export function createTopBar({
  app,
  splitPresets,
  getSplitCount,
  getSplitPreset,
  getMonitorMode,
  setMonitorMode,
  onApplySplitLayout,
  onOpenMultiMonitor,
  onSaveScreenshot,
  onToggleFullscreen,
  onOpenSettings,
  isPaneMaximized,
  onExitMaximize,
}: CreateTopBarArgs): { refreshTopControlIcons: () => void } {
  const topBar = document.createElement('div');
  topBar.style.cssText = `position:absolute;top:0;left:0;right:0;height:40px;
    background:#1a1e2e;display:flex;align-items:center;padding:0 12px;gap:8px;
    border-bottom:1px solid #2a2e3e;z-index:1000;color:white;
    font-family:'Segoe UI',Arial,sans-serif;font-size:13px;user-select:none;`;
  app.appendChild(topBar);

  const logo = document.createElement('div');
  logo.className = 'tc-brand-logo';
  logo.innerHTML = `<span style="font-weight:800;font-size:13px;color:#ffffff;">TRADING</span>
    <span style="font-weight:800;font-size:13px;color:#2962ff;">CORE</span>`;
  logo.style.cssText = 'margin-right:6px;flex-shrink:0;display:flex;align-items:center;';
  topBar.appendChild(logo);
  setupTopBrandFlare(logo);

  const rightArea = document.createElement('div');
  rightArea.style.cssText = 'display:flex;align-items:center;gap:4px;margin-left:auto;';

  const topIconRestColor = '#9ba5b7';
  const topIconHoverColor = '#f3f6ff';
  const topIconHoverBg = '#252a3a';
  const iconBtn = (iconHtml: string, title: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.title = title;
    btn.innerHTML = iconHtml;
    btn.style.cssText = `background:transparent;color:${topIconRestColor};border:none;cursor:pointer;
      font-size:16px;padding:4px 8px;border-radius:4px;transition:color 0.15s,background 0.15s;
      display:flex;align-items:center;justify-content:center;`;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = topIconHoverBg;
      btn.style.color = topIconHoverColor;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = topIconRestColor;
    });
    btn.addEventListener('click', onClick);
    return btn;
  };

  const splitWrap = document.createElement('div');
  splitWrap.style.cssText = 'position:relative;';
  const splitBtn = document.createElement('button');
  splitBtn.type = 'button';
  splitBtn.title = '분할/모니터 메뉴';
  splitBtn.style.cssText = `height:28px;min-width:38px;padding:4px 8px;background:transparent;color:${topIconRestColor};
    border:none;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:5px;
    transition:color 0.15s,background 0.15s;`;
  const splitMenu = document.createElement('div');
  splitMenu.style.cssText = 'position:absolute;top:32px;right:0;width:220px;background:#171c2a;border:1px solid #2a2e3e;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,0.35);padding:8px;display:none;z-index:2000;';
  let splitMenuOpen = false;
  const openSplitMenu = () => {
    splitMenuOpen = true;
    splitMenu.style.display = 'block';
    splitBtn.style.background = topIconHoverBg;
    splitBtn.style.color = topIconHoverColor;
  };
  const closeSplitMenu = () => {
    splitMenuOpen = false;
    splitMenu.style.display = 'none';
    splitBtn.style.background = 'transparent';
    splitBtn.style.color = topIconRestColor;
  };

  const splitIconGrid = document.createElement('div');
  splitIconGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;';
  const splitOptions = [...splitPresets];
  splitOptions.forEach((count) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = `${count}분할`;
    btn.style.cssText = 'height:32px;background:#1f2533;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    btn.innerHTML = layoutIconSvg(splitTypeByCount(count), 18, '#d1d4dc');
    btn.addEventListener('click', () => {
      onApplySplitLayout(count);
      closeSplitMenu();
    });
    splitIconGrid.appendChild(btn);
  });
  splitMenu.appendChild(splitIconGrid);

  const menuSep = document.createElement('div');
  menuSep.style.cssText = 'height:1px;background:#2a2e3e;margin:8px 0;';
  splitMenu.appendChild(menuSep);

  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
  const singleModeBtn = document.createElement('button');
  singleModeBtn.type = 'button';
  singleModeBtn.title = '단일 모니터';
  singleModeBtn.style.cssText = 'height:34px;background:#1f2533;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:700;';
  singleModeBtn.innerHTML = layoutIconSvg('monitor-single', 22, '#d1d4dc');
  singleModeBtn.addEventListener('click', () => {
    setMonitorMode('single');
    refreshTopControlIcons();
    closeSplitMenu();
  });
  modeRow.appendChild(singleModeBtn);

  const multiModeBtn = document.createElement('button');
  multiModeBtn.type = 'button';
  multiModeBtn.title = '다중 모니터(팝아웃)';
  multiModeBtn.style.cssText = 'height:34px;background:#1f2533;color:#d1d4dc;border:1px solid #2a2e3e;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:700;';
  multiModeBtn.innerHTML = layoutIconSvg('monitor-dual', 22, '#d1d4dc');
  multiModeBtn.addEventListener('click', () => {
    setMonitorMode('multi');
    refreshTopControlIcons();
    closeSplitMenu();
    onOpenMultiMonitor();
  });
  modeRow.appendChild(multiModeBtn);
  splitMenu.appendChild(modeRow);

  splitWrap.appendChild(splitBtn);
  splitWrap.appendChild(splitMenu);
  splitBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (splitMenuOpen) closeSplitMenu();
    else openSplitMenu();
  });
  splitBtn.addEventListener('mouseenter', () => {
    if (splitMenuOpen) return;
    splitBtn.style.background = topIconHoverBg;
    splitBtn.style.color = topIconHoverColor;
  });
  splitBtn.addEventListener('mouseleave', () => {
    if (splitMenuOpen) return;
    splitBtn.style.background = 'transparent';
    splitBtn.style.color = topIconRestColor;
  });
  splitMenu.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  document.addEventListener('click', () => {
    if (splitMenuOpen) closeSplitMenu();
  });
  rightArea.appendChild(splitWrap);

  const restoreViewBtn = iconBtn(restoreSvgIcon, '화면 복귀', onExitMaximize);
  const exitMaxBtn = iconBtn(closeSvgIcon, '최대화 해제 (X)', onExitMaximize);
  restoreViewBtn.style.display = 'none';
  exitMaxBtn.style.display = 'none';
  rightArea.appendChild(restoreViewBtn);
  rightArea.appendChild(exitMaxBtn);

  rightArea.appendChild(iconBtn(screenshotSvgIcon, '활성 패널 이미지 저장 (Ctrl+S)', onSaveScreenshot));
  rightArea.appendChild(iconBtn(fullscreenSvgIcon, '전체화면 (F)', onToggleFullscreen));
  rightArea.appendChild(iconBtn(settingsSvgIcon, '활성 패널 설정', onOpenSettings));
  topBar.appendChild(rightArea);

  const refreshTopControlIcons = () => {
    splitBtn.innerHTML = layoutIconSvg(splitTypeByCount(getSplitCount()), 16, 'currentColor');
    splitIconGrid.querySelectorAll('button').forEach((el, index) => {
      const count = splitOptions[index];
      const isActive = count === getSplitPreset();
      (el as HTMLButtonElement).style.borderColor = isActive ? '#4f8cff' : '#2a2e3e';
      (el as HTMLButtonElement).style.background = isActive ? '#243659' : '#1f2533';
    });
    const monitorMode = getMonitorMode();
    singleModeBtn.style.borderColor = monitorMode === 'single' ? '#4f8cff' : '#2a2e3e';
    singleModeBtn.style.background = monitorMode === 'single' ? '#243659' : '#1f2533';
    multiModeBtn.style.borderColor = monitorMode === 'multi' ? '#4f8cff' : '#2a2e3e';
    multiModeBtn.style.background = monitorMode === 'multi' ? '#243659' : '#1f2533';
    const showExitMax = isPaneMaximized();
    restoreViewBtn.style.display = showExitMax ? 'flex' : 'none';
    exitMaxBtn.style.display = showExitMax ? 'flex' : 'none';
  };

  refreshTopControlIcons();
  return { refreshTopControlIcons };
}
