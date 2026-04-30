const iconStroke = '#d5deef';
const mobileBottomDrawingIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff"><path d="M9,16h1.59c1.07,0,2.07-.42,2.83-1.17L23.12,5.12c.57-.57,.88-1.32,.88-2.12s-.31-1.55-.88-2.12c-1.17-1.17-3.07-1.17-4.24,0L9.17,10.59c-.76,.76-1.17,1.76-1.17,2.83v1.59c0,.55,.45,1,1,1ZM21.71,2.29c.19,.19,.29,.44,.29,.71s-.1,.52-.29,.71l-1.29,1.29-1.41-1.41,1.29-1.29c.39-.39,1.02-.39,1.41,0ZM10,13.41c0-.53,.21-1.04,.59-1.41l7-7,1.41,1.41-7,7c-.38,.38-.88,.59-1.41,.59h-.59v-.59Zm14,9.59c0,.55-.45,1-1,1-1.54,0-2.29-1.12-2.83-1.95-.5-.75-.75-1.05-1.17-1.05-.51,0-.9,.44-1.51,1.15-.7,.83-1.57,1.85-3.03,1.85s-2.32-1.03-3-1.87c-.58-.7-.96-1.13-1.46-1.13-.39,0-.63,.25-1.16,.91-.72,.88-1.71,2.09-3.84,2.09-2.76,0-5-2.24-5-5s2.24-5,5-5c.55,0,1,.45,1,1s-.45,1-1,1c-1.65,0-3,1.35-3,3s1.35,3,3,3c1.18,0,1.67-.6,2.29-1.36,.6-.73,1.34-1.64,2.71-1.64,1.47,0,2.32,1.03,3,1.87,.58,.7,.96,1.13,1.46,1.13s.9-.44,1.51-1.15c.7-.83,1.57-1.85,3.03-1.85s2.29,1.12,2.83,1.95c.5,.75,.75,1.05,1.17,1.05,.55,0,1,.45,1,1Z"/></svg>`;
const trendToolDefaultIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="18" x2="18" y2="4"></line><circle cx="4" cy="18" r="1.7"></circle><circle cx="18" cy="4" r="1.7"></circle></svg>`;
const eyeHideIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path><circle cx="12" cy="12" r="2.7"></circle><line x1="4" y1="20" x2="20" y2="4"></line></svg>`;
const eyeShowIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>`;
const magnetOnIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5v6a5 5 0 0 0 10 0V5"></path><path d="M7 5h4v4H7zM13 5h4v4h-4z"></path></svg>`;
const magnetOffIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5v6a5 5 0 0 0 10 0V5"></path><path d="M7 5h4v4H7zM13 5h4v4h-4z"></path><line x1="5" y1="19" x2="19" y2="5"></line></svg>`;
const eraserIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15.5 13.5 6a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3L13 19.5H7.8a2.8 2.8 0 0 1-2-.8l-1-1a2.8 2.8 0 0 1-.8-2z"></path><line x1="11.5" y1="19.5" x2="20.5" y2="19.5"></line></svg>`;

type ToolboxItem = {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
};

type ToolboxSection = {
  title: string;
  items: ToolboxItem[];
};

type ToolboxMenu = {
  title: string;
  sections: ToolboxSection[];
};

type ToolboxTool = {
  id: string;
  label: string;
  icon: string;
  menu?: ToolboxMenu;
};

const tools: ToolboxTool[] = [
  {
    id: 'trend',
    label: '추세선',
    icon: trendToolDefaultIcon,
    menu: {
      title: '추세선',
      sections: [
        {
          title: '라인',
          items: [
            {
              id: 'trendline',
              label: '추세선',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="18" x2="18" y2="4"></line><circle cx="4" cy="18" r="1.7"></circle><circle cx="18" cy="4" r="1.7"></circle></svg>`,
              shortcut: 'Alt + T',
            },
            {
              id: 'hline',
              label: '수평선',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>`,
              shortcut: 'Alt + H',
            },
          ],
        },
        {
          title: '채널',
          items: [
            {
              id: 'channel',
              label: '평행채널',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.7" stroke-linecap="round"><line x1="5" y1="8" x2="19" y2="3"></line><line x1="5" y1="16" x2="19" y2="11"></line></svg>`,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'fibonacci',
    label: '피보나치',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="19" x2="20" y2="5"></line><line x1="4" y1="15" x2="9" y2="15"></line><line x1="7" y1="12" x2="12" y2="12"></line><line x1="10" y1="9" x2="15" y2="9"></line><line x1="13" y1="6" x2="18" y2="6"></line></svg>`,
    menu: {
      title: '피보나치',
      sections: [
        {
          title: '피보나치',
          items: [
            {
              id: 'fib-retracement',
              label: '피보나치 되돌림',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.2" cy="6.2" r="1.5"></circle><circle cx="4.2" cy="17.8" r="1.5"></circle><line x1="5.7" y1="6.8" x2="10.2" y2="10.2"></line><line x1="5.7" y1="17.2" x2="10.2" y2="13.8"></line><line x1="8.8" y1="6.6" x2="21" y2="6.6"></line><line x1="7.4" y1="11.8" x2="21" y2="11.8"></line><line x1="8.8" y1="17.1" x2="21" y2="17.1"></line></svg>`,
            },
            {
              id: 'fib-trend',
              label: '추세기반 피보나치',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.2" cy="6.1" r="1.5"></circle><circle cx="4.2" cy="17.9" r="1.5"></circle><line x1="5.8" y1="6.8" x2="11.6" y2="10.5"></line><line x1="5.8" y1="17.2" x2="11.6" y2="13.5"></line><line x1="10.6" y1="6.7" x2="21" y2="6.7"></line><line x1="10.6" y1="11.9" x2="21" y2="11.9"></line><line x1="10.6" y1="17.1" x2="21" y2="17.1"></line></svg>`,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'forecast',
    label: '예측',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l5-6 4 3 7-8"></path><polyline points="18 6 20 6 20 8"></polyline><polyline points="6 18 4 18 4 16"></polyline></svg>`,
    menu: {
      title: '예측',
      sections: [
        {
          title: '포지션',
          items: [
            {
              id: 'long-position',
              label: '매수 포지션',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><path d="M5 16h14"></path><path d="M12 19V5"></path><path d="M9 8l3-3 3 3"></path></svg>`,
            },
            {
              id: 'short-position',
              label: '매도 포지션',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><path d="M5 8h14"></path><path d="M12 5v14"></path><path d="M9 16l3 3 3-3"></path></svg>`,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'text',
    label: '텍스트입력',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="6" x2="19" y2="6"></line><line x1="12" y1="6" x2="12" y2="19"></line></svg>`,
    menu: {
      title: '텍스트입력',
      sections: [
        {
          title: '텍스트',
          items: [
            {
              id: 'text-note',
              label: '텍스트 입력',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><line x1="5" y1="6" x2="19" y2="6"></line><line x1="12" y1="6" x2="12" y2="19"></line></svg>`,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'measure',
    label: '재기',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 16.5 4l3.5 3.5L7.5 20z"></path><path d="M8.2 12.3l2.5 2.5M11.1 9.4l2.5 2.5M14 6.5l2.5 2.5"></path></svg>`,
  },
  {
    id: 'magnet',
    label: '자석',
    icon: magnetOnIcon,
    menu: {
      title: '자석',
      sections: [
        {
          title: '스냅 강도',
          items: [
            { id: 'magnet-off', label: '자석 끄기' },
            { id: 'magnet-soft', label: '자석 약하게' },
            { id: 'magnet-strong', label: '자석 강하게' },
          ],
        },
      ],
    },
  },
  {
    id: 'hide',
    label: '감추기',
    icon: eyeShowIcon,

    menu: {
      title: '감추기',
      sections: [
        {
          title: '표시 관리',
          items: [
            {
              id: 'hide-drawings',
              label: '드로잉 감추기',
              icon: eyeHideIcon,

            },
            {
              id: 'hide-indicators',
              label: '지표 감추기',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.7"><line x1="5" y1="17" x2="9" y2="11"></line><line x1="10" y1="14" x2="14" y2="8"></line><line x1="15" y1="12" x2="19" y2="6"></line><line x1="4" y1="20" x2="20" y2="4"></line></svg>`,
            },
            {
              id: 'hide-patterns',
              label: '패턴 감추기',
              icon: eyeHideIcon,
            },
            {
              id: 'hide-all',
              label: '모두 감추기',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="3"></rect><line x1="4" y1="20" x2="20" y2="4"></line></svg>`,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'delete-selected-drawing',
    label: '지우개',
    icon: eraserIcon,
  },
  {
    id: 'trash',
    label: '휴지통',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconStroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>`,
    menu: {
      title: '휴지통',
      sections: [
        {
          title: '삭제',
          items: [
            {
              id: 'trash-delete-drawings',
              label: '0 드로잉 없애기',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>`,
            },
            {
              id: 'trash-delete-indicators',
              label: '0 인디케이터 없애기',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round"><line x1="5" y1="17" x2="9" y2="11"></line><line x1="10" y1="14" x2="14" y2="8"></line><line x1="15" y1="12" x2="19" y2="6"></line></svg>`,
            },
            {
              id: 'trash-delete-all',
              label: '0 드로잉 & 0 인디케이터 없애기',
              icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path><line x1="6" y1="16" x2="18" y2="8"></line></svg>`,
            },
          ],
        },
      ],
    },
  },
];

export function createLeftToolbox(workspace: HTMLElement): void {
  if (!document.getElementById('toolbox-chevron-motion-style')) {
    const style = document.createElement('style');
    style.id = 'toolbox-chevron-motion-style';
    style.textContent = `
      @keyframes toolbox-chevron-wiggle {
        0% { transform: translateX(0); }
        100% { transform: translateX(2px); }
      }
    `;
    document.head.appendChild(style);
  }

  const DESKTOP_COLLAPSED_WIDTH = 56;
  const MOBILE_COLLAPSED_WIDTH = 50;

  const rail = document.createElement('div');
  rail.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'bottom:0',
    'width:56px',
    'z-index:1300',
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'padding:8px 6px',
    'background:rgba(20,28,45,0.95)',
    'border-right:1px solid #2a3a57',
    'backdrop-filter:blur(4px)',
    'box-sizing:border-box',
  ].join(';');
  workspace.appendChild(rail);

  const submenu = document.createElement('div');
  submenu.style.cssText = [
    'position:absolute',
    'left:56px',
    'top:0',
    'width:min(290px, calc(100vw - 96px))',
    'max-height:100%',
    'overflow:auto',
    'z-index:1299',
    'background:#d8d8d8',
    'color:#1d1d1f',
    'border:1px solid #8b8d92',
    'border-radius:10px',
    'box-shadow:0 10px 28px rgba(0,0,0,0.35)',
    'transform:translateX(-14px)',
    'opacity:0',
    'pointer-events:none',
    'transition:transform 180ms ease, opacity 180ms ease',
    'box-sizing:border-box',
  ].join(';');
  workspace.appendChild(submenu);

  const measureHint = document.createElement('div');
  measureHint.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'z-index:1400',
    'display:none',
    'pointer-events:none',
    'transform:translateX(6px)',
    'background:#24282f',
    'color:#f2f5fb',
    'border:1px solid #3b4250',
    'border-radius:6px',
    'padding:6px 8px',
    'font:600 12px Segoe UI, Arial, sans-serif',
    'white-space:nowrap',
    'box-shadow:0 8px 20px rgba(0,0,0,0.35)',
  ].join(';');
  measureHint.innerHTML = `<span>재기</span> <span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#4b515f;color:#ffffff;font-weight:700;margin:0 2px;">Shift</span> <span style="color:#d3d9e7;">+ 차트위 클릭</span>`;
  workspace.appendChild(measureHint);

  let activeToolId: string | null = null;
  let currentDockCollapsedWidth = DESKTOP_COLLAPSED_WIDTH;
  let autoCloseTimer = 0;
  let submenuPreferredTop = 8;
  let drawingsVisible = true;
  let patternBoxesVisible = true;
  let eraserModeActive = false;
  let magnetMode: 'off' | 'soft' | 'strong' = 'soft';
  let trashCounts = { drawings: 0, indicators: 0 };
  let trashDeleteLocked = false;
  let isMobileViewport = false;
  const toolButtonMap = new Map<string, HTMLButtonElement>();
  const toolIconWrapMap = new Map<string, HTMLSpanElement>();
  const selectedToolIconMap = new Map<string, string>();
  const toolChevronMap = new Map<string, HTMLSpanElement>();

  const emitLayoutWidth = () => {
    window.dispatchEvent(
      new CustomEvent('chart-toolbox-layout', {
        detail: { width: currentDockCollapsedWidth },
      }),
    );
  };

  const syncTrendToolIconForViewport = () => {
    const trendWrap = toolIconWrapMap.get('trend');
    if (!trendWrap) return;
    if (isMobileViewport) {
      trendWrap.innerHTML = mobileBottomDrawingIcon;
      return;
    }
    trendWrap.innerHTML = selectedToolIconMap.get('trend') ?? trendToolDefaultIcon;
  };

  const applyToolButtonActiveStyle = (btn: HTMLButtonElement, active: boolean) => {
    btn.style.background = active ? '#2b4470' : '#1a2336';
    btn.style.borderColor = active ? '#4f77bc' : '#304467';
    btn.style.transform = active ? 'translateX(1px)' : 'translateX(0)';
  };

  const syncEraserButtonStyle = () => {
    const eraserBtn = toolButtonMap.get('delete-selected-drawing');
    if (!eraserBtn) return;
    applyToolButtonActiveStyle(eraserBtn, eraserModeActive);
  };
  const getMagnetModeIcon = () => (magnetMode === 'off' ? magnetOffIcon : magnetOnIcon);
  const syncMagnetToolIcon = () => {
    const nextIcon = getMagnetModeIcon();
    selectedToolIconMap.set('magnet', nextIcon);
    const magnetIconWrap = toolIconWrapMap.get('magnet');
    if (magnetIconWrap) magnetIconWrap.innerHTML = nextIcon;
  };
  const syncMagnetButtonStyle = () => {
    const magnetBtn = toolButtonMap.get('magnet');
    if (!magnetBtn) return;
    applyToolButtonActiveStyle(magnetBtn, magnetMode !== 'off');
  };

  const clearActiveStyles = () => {
    tools.forEach((candidate) => {
      const candidateBtn = rail.querySelector<HTMLButtonElement>(`button[data-tool="${candidate.id}"]`);
      if (candidateBtn) {
        applyToolButtonActiveStyle(candidateBtn, false);
      }
      const chev = toolChevronMap.get(candidate.id);
      if (chev) {
        chev.style.opacity = (candidate.id === 'hide' || candidate.id === 'magnet') ? '1' : '0';
        chev.style.transform = 'rotate(0deg)';
      }
    });
    syncEraserButtonStyle();
    syncMagnetButtonStyle();
  };

  const getHideDrawingsAction = () => (
    drawingsVisible
      ? { label: '드로잉 감추기', icon: eyeHideIcon }
      : { label: '드로잉 보이기', icon: eyeShowIcon }
  );
  const getHidePatternsAction = () => (
    patternBoxesVisible
      ? { label: '패턴 감추기', icon: eyeHideIcon }
      : { label: '패턴 보이기', icon: eyeShowIcon }
  );
  const getHideToolStateIcon = () => (drawingsVisible ? eyeShowIcon : eyeHideIcon);

  const syncHideToolIcon = () => {
    const hideStateIcon = getHideToolStateIcon();
    selectedToolIconMap.set('hide', hideStateIcon);
    const hideIconWrap = toolIconWrapMap.get('hide');
    if (hideIconWrap) hideIconWrap.innerHTML = hideStateIcon;
  };
  const closeSubmenu = () => {
    activeToolId = null;
    clearActiveStyles();
    renderMenu(null);
  };

  const clearAutoCloseTimer = () => {
    if (!autoCloseTimer) return;
    window.clearTimeout(autoCloseTimer);
    autoCloseTimer = 0;
  };

  const scheduleAutoClose = () => {
    clearAutoCloseTimer();
    autoCloseTimer = window.setTimeout(() => {
      closeSubmenu();
      autoCloseTimer = 0;
    }, 260);
  };

  const positionSubmenu = (preferredTop?: number) => {
    if (Number.isFinite(preferredTop)) {
      submenuPreferredTop = Number(preferredTop);
    }
    const margin = 6;
    const menuH = Math.max(1, submenu.offsetHeight || 0);
    const hostH = Math.max(1, workspace.clientHeight || 0);
    const maxTop = Math.max(margin, hostH - menuH - margin);
    const top = Math.max(margin, Math.min(maxTop, submenuPreferredTop));
    submenu.style.top = `${Math.round(top)}px`;
  };

  const renderMenu = (tool: ToolboxTool | null) => {
    if (!tool?.menu) {
      submenu.innerHTML = '';
      submenu.style.opacity = '0';
      submenu.style.transform = 'translateX(-14px)';
      submenu.style.pointerEvents = 'none';
      emitLayoutWidth();
      return;
    }

    const menu = tool.menu;
    submenu.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:10px 10px 12px;';
    submenu.appendChild(wrap);

    const title = document.createElement('div');
    title.textContent = menu.title;
    title.style.cssText = 'font:700 15px Segoe UI, Arial, sans-serif;color:#2a2a2b;margin-bottom:8px;';
    wrap.appendChild(title);

    menu.sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:#c2c2c6;margin:10px 0 8px;';
        wrap.appendChild(divider);
      }

      const sectionTitle = document.createElement('div');
      sectionTitle.textContent = section.title;
      sectionTitle.style.cssText = 'font:600 12px Segoe UI, Arial, sans-serif;color:#6a6a6f;margin:0 0 6px 2px;';
      wrap.appendChild(sectionTitle);

      section.items.forEach((item) => {
        const resolvedLabel = (() => {
          if (tool.id === 'hide' && item.id === 'hide-drawings') return getHideDrawingsAction().label;
          if (tool.id === 'hide' && item.id === 'hide-patterns') return getHidePatternsAction().label;
          if (tool.id !== 'trash') return item.label;
          if (item.id === 'trash-delete-drawings') return `${trashCounts.drawings} 드로잉 없애기`;
          if (item.id === 'trash-delete-indicators') return `${trashCounts.indicators} 인디케이터 없애기`;
          if (item.id === 'trash-delete-all') return `${trashCounts.drawings} 드로잉 & ${trashCounts.indicators} 인디케이터 없애기`;
          return item.label;
        })();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = [
          'width:100%',
          'height:36px',
          'display:flex',
          'align-items:center',
          'gap:8px',
          'padding:0 12px',
          'margin-bottom:4px',
          'border:1px solid transparent',
          'border-radius:8px',
          'background:transparent',
          'color:#26272b',
          'font:600 15px/1 Segoe UI, Arial, sans-serif',
          'cursor:pointer',
          'text-align:left',
        ].join(';');
        btn.style.font = '600 15px Segoe UI, Arial, sans-serif';
        btn.style.lineHeight = '1';
        btn.style.height = '36px';
        btn.style.padding = '0 12px';
        btn.style.justifyContent = 'flex-start';
        const itemIcon = document.createElement('span');
        const resolvedIcon = tool.id === 'hide' && item.id === 'hide-drawings'
          ? getHideDrawingsAction().icon
          : tool.id === 'hide' && item.id === 'hide-patterns'
            ? getHidePatternsAction().icon
          : item.icon;
        const baseIcon = resolvedIcon ?? `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${iconStroke}" stroke-width="2"><circle cx="12" cy="12" r="2.2"></circle></svg>`;
        itemIcon.innerHTML = baseIcon.replaceAll(iconStroke, 'currentColor');
        itemIcon.style.cssText = 'width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#26272b;opacity:1;';
        const leftWrap = document.createElement('span');
        leftWrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px;min-width:0;';
        const itemLabel = document.createElement('span');
        itemLabel.textContent = resolvedLabel;
        leftWrap.appendChild(itemIcon);
        leftWrap.appendChild(itemLabel);
        btn.appendChild(leftWrap);
        const shortcut = document.createElement('span');
        shortcut.textContent = item.shortcut ?? '';
        shortcut.style.cssText = 'margin-left:auto;font-size:12px;color:#7a7d84;font-weight:600;white-space:nowrap;';
        if (item.shortcut) btn.appendChild(shortcut);

        btn.addEventListener('mouseenter', () => {
          btn.style.background = '#2b2b2e';
          btn.style.color = '#ffffff';
          itemIcon.style.color = '#ffffff';
          if (item.shortcut) shortcut.style.color = '#d5d7de';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
          btn.style.color = '#26272b';
          itemIcon.style.color = '#26272b';
          if (item.shortcut) shortcut.style.color = '#7a7d84';
        });
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          if (tool.id === 'magnet') {
            if (item.id === 'magnet-off') magnetMode = 'off';
            if (item.id === 'magnet-soft') magnetMode = 'soft';
            if (item.id === 'magnet-strong') magnetMode = 'strong';
            syncMagnetToolIcon();
            syncMagnetButtonStyle();
          }
          if (tool.id === 'hide' && item.id === 'hide-drawings') {
            drawingsVisible = !drawingsVisible;
            syncHideToolIcon();
          } else if (tool.id === 'hide' && item.id === 'hide-patterns') {
            patternBoxesVisible = !patternBoxesVisible;
            syncHideToolIcon();
          } else if (tool.id !== 'trash' && item.icon) {
            if (tool.id === 'trend' && isMobileViewport) {
              selectedToolIconMap.delete(tool.id);
              const iconWrap = toolIconWrapMap.get(tool.id);
              if (iconWrap) iconWrap.innerHTML = mobileBottomDrawingIcon;
            } else {
              selectedToolIconMap.set(tool.id, item.icon);
              const iconWrap = toolIconWrapMap.get(tool.id);
              if (iconWrap) iconWrap.innerHTML = item.icon;
            }
          }
          window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
            detail: {
              toolId: tool.id,
              itemId: item.id,
              label: resolvedLabel,
              includeLocked: trashDeleteLocked,
            },
          }));
          closeSubmenu();
        });
        wrap.appendChild(btn);
      });
    });

    if (tool.id === 'trash') {
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px;background:#c2c2c6;margin:10px 0 8px;';
      wrap.appendChild(divider);

      const lockedRow = document.createElement('div');
      lockedRow.style.cssText = 'height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-radius:8px;background:rgba(0,0,0,0.03);';
      const lockedLabel = document.createElement('span');
      lockedLabel.textContent = '잠긴 드로잉은 항상 제거해요.';
      lockedLabel.style.cssText = 'font:600 14px/1 Segoe UI, Arial, sans-serif;color:#2f3137;';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.style.cssText = [
        'position:relative',
        'width:48px',
        'height:28px',
        'border:1px solid #a4a7ad',
        'border-radius:999px',
        `background:${trashDeleteLocked ? '#5f636c' : '#b7b8bd'}`,
        'padding:0',
        'cursor:pointer',
      ].join(';');
      const thumb = document.createElement('span');
      thumb.style.cssText = [
        'position:absolute',
        'top:3px',
        `left:${trashDeleteLocked ? '24px' : '3px'}`,
        'width:20px',
        'height:20px',
        'border-radius:50%',
        'background:#ffffff',
        'box-shadow:0 1px 4px rgba(0,0,0,0.24)',
        'transition:left 140ms ease',
      ].join(';');
      toggle.appendChild(thumb);
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        trashDeleteLocked = !trashDeleteLocked;
        toggle.style.background = trashDeleteLocked ? '#5f636c' : '#b7b8bd';
        thumb.style.left = trashDeleteLocked ? '24px' : '3px';
      });
      lockedRow.appendChild(lockedLabel);
      lockedRow.appendChild(toggle);
      wrap.appendChild(lockedRow);
    }

    submenu.style.opacity = '1';
    submenu.style.transform = 'translateX(0)';
    submenu.style.pointerEvents = 'auto';
    positionSubmenu();
    emitLayoutWidth();
  };

  const updateRailVisibility = () => {
    rail.style.width = `${currentDockCollapsedWidth}px`;
    rail.style.padding = '8px 6px';
    rail.style.opacity = '1';
    const active = tools.find((t) => t.id === activeToolId) ?? null;
    renderMenu(active);
    syncTrendToolIconForViewport();
    if (active) positionSubmenu();
  };

  tools.forEach((tool) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = tool.label;
    const iconWrap = document.createElement('span');
    iconWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;pointer-events:none;';
    iconWrap.innerHTML = selectedToolIconMap.get(tool.id) ?? tool.icon;
    btn.style.cssText = [
      'width:34px',
      'height:34px',
      'border:1px solid #304467',
      'border-radius:8px',
      'background:#1a2336',
      'color:#d5deef',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'margin:0 auto',
      'position:relative',
      'transition:background 140ms ease, border-color 140ms ease, transform 140ms ease',
    ].join(';');
    btn.appendChild(iconWrap);
    const chevron = document.createElement('span');
    if (tool.menu) {
      chevron.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="${iconStroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
      chevron.className = 'toolbox-tool-chevron';
      chevron.style.cssText = [
        'position:absolute',
        'right:-11px',
        'top:50%',
        'width:10px',
        'height:10px',
        'margin-top:-5px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'line-height:1',
        'transform:rotate(0deg)',
        'transform-origin:50% 50%',
        'opacity:0',
        'transition:opacity 150ms ease, transform 180ms ease',
        'pointer-events:auto',
      ].join(';');
      if (tool.id === 'hide' || tool.id === 'magnet') {
        chevron.style.opacity = '1';
      }
      btn.appendChild(chevron);
      toolChevronMap.set(tool.id, chevron);
      const chevronSvg = chevron.querySelector('svg') as SVGElement | null;
      const startChevronWiggle = () => {
        if (!chevronSvg) return;
        chevronSvg.style.animation = 'toolbox-chevron-wiggle 360ms ease-in-out infinite alternate';
      };
      const stopChevronWiggle = () => {
        if (!chevronSvg) return;
        chevronSvg.style.animation = '';
      };
      chevron.addEventListener('mouseenter', (event) => {
        event.stopPropagation();
        startChevronWiggle();
      });
      chevron.addEventListener('mouseleave', stopChevronWiggle);
      btn.addEventListener('mouseleave', stopChevronWiggle);
    }

    const setActiveStyle = (active: boolean) => {
      applyToolButtonActiveStyle(btn, active);
    };

    btn.addEventListener('mouseenter', () => {
      const isPinnedActive = tool.id === 'delete-selected-drawing' && eraserModeActive;
      if (activeToolId !== tool.id && !isPinnedActive) {
        btn.style.background = '#25324c';
        btn.style.borderColor = '#42608f';
      }
      if (tool.menu) {
        const c = toolChevronMap.get(tool.id);
        if (c) c.style.opacity = '1';
      }
    });
    btn.addEventListener('mouseleave', () => {
      const isPinnedActive = tool.id === 'delete-selected-drawing' && eraserModeActive;
      if (activeToolId !== tool.id && !isPinnedActive) {
        applyToolButtonActiveStyle(btn, false);
        const c = toolChevronMap.get(tool.id);
        if (c) c.style.opacity = (tool.id === 'hide' || tool.id === 'magnet') ? '1' : '0';
      }
      if (tool.id === 'measure') {
        measureHint.style.display = 'none';
      }
    });

    if (tool.id === 'measure') {
      btn.addEventListener('mouseenter', () => {
        measureHint.style.display = 'block';
        measureHint.style.left = `${currentDockCollapsedWidth + 8}px`;
        measureHint.style.top = `${Math.max(6, btn.offsetTop - 1)}px`;
      });
    }

    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const targetEl = event.target as HTMLElement | null;
      const chevronEl = toolChevronMap.get(tool.id) ?? null;
      const clickedChevron = Boolean(targetEl && chevronEl && chevronEl.contains(targetEl));
      if (!tool.menu) {
        if (tool.id === 'delete-selected-drawing') {
          eraserModeActive = !eraserModeActive;
          syncEraserButtonStyle();
        } else {
          eraserModeActive = false;
        }
        activeToolId = null;
        clearActiveStyles();
        renderMenu(null);
        window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
          detail: { toolId: tool.id, itemId: tool.id, label: tool.label },
        }));
        updateRailVisibility();
        return;
      }
      if (tool.id === 'hide' && !clickedChevron) {
        drawingsVisible = !drawingsVisible;
        syncHideToolIcon();
        activeToolId = null;
        clearActiveStyles();
        renderMenu(null);
        window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
          detail: {
            toolId: tool.id,
            itemId: 'hide-drawings',
            label: getHideDrawingsAction().label,
            includeLocked: trashDeleteLocked,
          },
        }));
        updateRailVisibility();
        return;
      }
      if (tool.id === 'magnet' && !clickedChevron) {
        magnetMode = magnetMode === 'off' ? 'soft' : 'off';
        syncMagnetToolIcon();
        activeToolId = null;
        clearActiveStyles();
        renderMenu(null);
        window.dispatchEvent(new CustomEvent('chart-toolbox-select', {
          detail: {
            toolId: tool.id,
            itemId: magnetMode === 'off' ? 'magnet-off' : 'magnet-soft',
            label: magnetMode === 'off' ? '자석 끄기' : '자석 약하게',
            includeLocked: trashDeleteLocked,
          },
        }));
        updateRailVisibility();
        return;
      }
      activeToolId = activeToolId === tool.id ? null : tool.id;
      clearActiveStyles();
      setActiveStyle(activeToolId === tool.id);
      if (tool.menu) {
        const c = toolChevronMap.get(tool.id);
        if (c && activeToolId === tool.id) {
          c.style.opacity = '1';
          c.style.transform = 'rotate(180deg)';
        }
      }
      if (activeToolId === tool.id) {
        positionSubmenu(btn.offsetTop - 2);
        if (tool.id === 'trash') {
          window.dispatchEvent(new CustomEvent('chart-toolbox-trash-refresh'));
        }
      }
      renderMenu(tools.find((t) => t.id === activeToolId) ?? null);
      updateRailVisibility();
    });

    btn.dataset.tool = tool.id;
    rail.appendChild(btn);
    toolButtonMap.set(tool.id, btn);
    toolIconWrapMap.set(tool.id, iconWrap);
  });

  window.addEventListener('chart-toolbox-trash-counts', (event: Event) => {
    const customEvent = event as CustomEvent<{ drawings?: number; indicators?: number }>;
    const nextDrawings = Number(customEvent.detail?.drawings ?? 0);
    const nextIndicators = Number(customEvent.detail?.indicators ?? 0);
    trashCounts = {
      drawings: Number.isFinite(nextDrawings) ? Math.max(0, Math.round(nextDrawings)) : 0,
      indicators: Number.isFinite(nextIndicators) ? Math.max(0, Math.round(nextIndicators)) : 0,
    };
    if (activeToolId === 'trash') {
      renderMenu(tools.find((t) => t.id === 'trash') ?? null);
    }
  });

  window.addEventListener('chart-drawings-visibility-changed', (event: Event) => {
    const customEvent = event as CustomEvent<{ visible?: boolean }>;
    drawingsVisible = customEvent.detail?.visible !== false;
    syncHideToolIcon();
    if (activeToolId === 'hide') {
      renderMenu(tools.find((t) => t.id === 'hide') ?? null);
    }
  });
  window.addEventListener('chart-pattern-visibility-changed', (event: Event) => {
    const customEvent = event as CustomEvent<{ visible?: boolean }>;
    patternBoxesVisible = customEvent.detail?.visible !== false;
    syncHideToolIcon();
    if (activeToolId === 'hide') {
      renderMenu(tools.find((t) => t.id === 'hide') ?? null);
    }
  });

  window.addEventListener('chart-drawing-tool-changed', (event: Event) => {
    const customEvent = event as CustomEvent<{ toolId?: string | null }>;
    eraserModeActive = customEvent.detail?.toolId === 'eraser';
    syncEraserButtonStyle();
  });
  syncMagnetToolIcon();
  syncMagnetButtonStyle();

  workspace.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (rail.contains(target) || submenu.contains(target)) return;
    closeSubmenu();
  });

  rail.addEventListener('mouseenter', clearAutoCloseTimer);
  submenu.addEventListener('mouseenter', clearAutoCloseTimer);
  rail.addEventListener('mouseleave', scheduleAutoClose);
  submenu.addEventListener('mouseleave', scheduleAutoClose);

  const mq = window.matchMedia('(max-width: 900px)');
  const applyMobileLayout = () => {
    isMobileViewport = mq.matches;
    if (mq.matches) {
      currentDockCollapsedWidth = MOBILE_COLLAPSED_WIDTH;
      rail.style.left = '0';
      rail.style.top = '0';
      rail.style.bottom = '0';
      rail.style.width = `${currentDockCollapsedWidth}px`;
      submenu.style.left = `${currentDockCollapsedWidth}px`;
      submenu.style.width = 'min(250px, calc(100vw - 72px))';
    } else {
      currentDockCollapsedWidth = DESKTOP_COLLAPSED_WIDTH;
      rail.style.left = '0';
      rail.style.top = '0';
      rail.style.bottom = '0';
      rail.style.width = `${currentDockCollapsedWidth}px`;
      submenu.style.left = `${currentDockCollapsedWidth}px`;
      submenu.style.width = 'min(290px, calc(100vw - 96px))';
    }
    syncTrendToolIconForViewport();
    if (activeToolId) positionSubmenu();
    emitLayoutWidth();
  };
  mq.addEventListener('change', applyMobileLayout);
  applyMobileLayout();
  syncTrendToolIconForViewport();
  syncHideToolIcon();
  emitLayoutWidth();
}

