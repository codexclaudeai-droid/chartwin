type TimeframeOption<TKey extends string> = {
  key: TKey;
  label: string;
};

type ChartConfigLike<TKey extends string> = {
  symbol: string;
  timeframe: TKey;
};

type CreatePaneChromeArgs<TKey extends string> = {
  host: HTMLDivElement;
  chartConfig: ChartConfigLike<TKey>;
  timeframes: readonly TimeframeOption<TKey>[];
  createSymbolIconElement: (symbol: string, iconUrl?: string) => HTMLElement;
  getSymbolIconUrl: (symbol: string) => string | undefined;
  getSymbolDisplayLabel?: (symbol: string) => string;
  showStrategyButton?: boolean;
};

export type PaneChrome = {
  paneRoot: HTMLDivElement;
  paneHeader: HTMLDivElement;
  chartArea: HTMLDivElement;
  tfSelect: HTMLSelectElement;
  currencySelect: HTMLSelectElement;
  symBtn: HTMLButtonElement;
  symIcon: HTMLElement;
  symLabel: HTMLSpanElement;
  marketPriceWrap: HTMLDivElement;
  symPriceLabel: HTMLSpanElement;
  symChangeLabel: HTMLSpanElement;
  symChangeMetaLabel: HTMLSpanElement;
  indBtn: HTMLButtonElement;
  strategyBtn: HTMLButtonElement;
  marketSessionBadge: HTMLSpanElement;
  headerTitle: HTMLDivElement;
  ohlcHeaderDisplay: HTMLDivElement;
  winCtrlWrap: HTMLDivElement;
  minBtn: HTMLButtonElement;
  maxBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  refreshSymbolVisual: (symbol: string) => void;
};

const makeHeaderCtrlBtn = (label: string, title: string): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.title = title;
  btn.style.cssText = 'width:18px;height:18px;border:1px solid #3a4155;border-radius:4px;background:#22293a;color:#b5bece;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;';
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#314060';
    btn.style.color = '#ffffff';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#22293a';
    btn.style.color = '#b5bece';
  });
  return btn;
};

const signalIconFilter = 'brightness(0) invert(1)';
const headerActionBg = '#1f2533';
const headerActionHoverBg = '#2b3448';
const LIVE_STATUS_STYLE_ID = 'tc-live-status-style';

const bindHeaderActionHover = (btn: HTMLButtonElement) => {
  btn.addEventListener('mouseenter', () => {
    btn.style.background = headerActionHoverBg;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = headerActionBg;
  });
};

const ensureLiveStatusStyle = () => {
  if (document.getElementById(LIVE_STATUS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LIVE_STATUS_STYLE_ID;
  style.textContent = `
    .tc-live-status-badge.tc-live-status-on {
      border-color:#34d399 !important;
      color:#8fffd2 !important;
      background:radial-gradient(circle at 50% 45%, #245f49 0%, #14382d 70%) !important;
      box-shadow:0 0 0 1px rgba(52,211,153,0.2), 0 0 8px rgba(52,211,153,0.44), inset 0 0 6px rgba(52,211,153,0.16);
      text-shadow:0 0 6px rgba(143,255,210,0.66);
      animation:tcLiveStatusGlow 1.45s ease-in-out infinite;
    }
    @keyframes tcLiveStatusGlow {
      0%, 100% {
        box-shadow:0 0 0 1px rgba(52,211,153,0.17), 0 0 6px rgba(52,211,153,0.32), inset 0 0 5px rgba(52,211,153,0.13);
        filter:brightness(1);
      }
      50% {
        box-shadow:0 0 0 1px rgba(52,211,153,0.29), 0 0 11px rgba(52,211,153,0.57), inset 0 0 7px rgba(52,211,153,0.24);
        filter:brightness(1.11);
      }
    }
  `;
  document.head.appendChild(style);
};

export function createPaneChrome<TKey extends string>({
  host,
  chartConfig,
  timeframes,
  createSymbolIconElement,
  getSymbolIconUrl,
  getSymbolDisplayLabel,
  showStrategyButton = true,
}: CreatePaneChromeArgs<TKey>): PaneChrome {
  ensureLiveStatusStyle();
  host.innerHTML = '';
  host.style.border = '1px solid #2a2e3e';

  const paneRoot = document.createElement('div');
  paneRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  host.appendChild(paneRoot);

  const paneHeader = document.createElement('div');
  paneHeader.style.cssText = `position:absolute;left:0;right:0;top:0;height:30px;display:flex;
    align-items:center;gap:6px;padding:0 7px;background:#171c2a;border-bottom:1px solid #242a3a;
    color:#d1d4dc;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;z-index:60;overflow:hidden;`;
  paneRoot.appendChild(paneHeader);

  const chartArea = document.createElement('div');
  chartArea.style.cssText = 'position:absolute;left:0;right:0;top:30px;bottom:0;overflow:hidden;';
  paneRoot.appendChild(chartArea);

  // Hidden native select — keeps API/event contract intact (init.ts, pane-events.ts unchanged)
  const tfSelect = document.createElement('select');
  tfSelect.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;';
  timeframes.forEach(({ key, label }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    tfSelect.appendChild(opt);
  });

  // Track current key separately so we can intercept value get/set
  let _tfKey: string = chartConfig.timeframe;
  const TF_DROPDOWN_LABEL_KR: Record<string, string> = {
    '1s': '1초',
    '3m': '3분',
    '5m': '5분',
    '15m': '15분',
    '30m': '30분',
    '1m': '1분',
    '1h': '1시간',
    '2h': '2시간',
    '4h': '4시간',
    '1d': '1일',
    '1w': '1주',
    '1M': '1달',
  };
  const _getTfLabel = (k: string) => timeframes.find((t) => t.key === k)?.label ?? k;
  const _getTfDropdownLabel = (k: string) => TF_DROPDOWN_LABEL_KR[k] ?? _getTfLabel(k);
  const _getTfSelectedLabelLower = (k: string) => {
    if (k === '1M') return '1mo';
    return k.toLowerCase();
  };
  Object.defineProperty(tfSelect, 'value', {
    get: () => _tfKey,
    set: (v: string) => {
      _tfKey = v;
      tfBtn.textContent = _getTfSelectedLabelLower(v);
      _syncTfSelection(v);
    },
    configurable: true,
  });

  // Visible button
  const tfBtn = document.createElement('button');
  tfBtn.type = 'button';
  tfBtn.style.cssText = `background:${headerActionBg};color:#d1d4dc;border:none;border-radius:4px;font-size:11px;padding:0 8px;height:22px;flex-shrink:0;cursor:pointer;white-space:nowrap;line-height:1;min-width:32px;transition:background 0.15s;`;
  tfBtn.textContent = _getTfSelectedLabelLower(_tfKey);
  bindHeaderActionHover(tfBtn);

  // ── Dropdown panel ───────────────────────────────────────────────────
  if (!document.getElementById('tf-dd-style')) {
    const s = document.createElement('style');
    s.id = 'tf-dd-style';
    s.textContent = '.tf-dd::-webkit-scrollbar{width:3px}.tf-dd::-webkit-scrollbar-track{background:transparent}.tf-dd::-webkit-scrollbar-thumb{background:#c5ccd8;border-radius:2px}';
    document.head.appendChild(s);
  }

  const tfDropdown = document.createElement('div');
  tfDropdown.className = 'tf-dd';
  tfDropdown.style.cssText = 'position:fixed;background:#ffffff;border-radius:6px;overflow-y:auto;max-height:72vh;min-width:128px;display:none;z-index:9000;padding:4px 0;scrollbar-width:thin;scrollbar-color:#c5ccd8 transparent;box-shadow:0 4px 16px rgba(0,0,0,0.18);';
  document.body.appendChild(tfDropdown);

  const _getCatName = (key: string): string => {
    if (/tick/i.test(key)) return '틱';
    if (key.endsWith('s')) return '초';
    if (/\d+m$/.test(key)) return '분';
    if (key.endsWith('h')) return '시간';
    return '날';
  };
  const _catOrder = ['틱', '초', '분', '시간', '날'];
  const _catMap = new Map<string, string[]>();
  _catOrder.forEach((c) => _catMap.set(c, []));
  timeframes.forEach(({ key }) => {
    const cat = _getCatName(key);
    if (!_catMap.has(cat)) _catMap.set(cat, []);
    _catMap.get(cat)!.push(key);
  });

  const _collapseState = new Map<string, boolean>();
  const _itemEls = new Map<string, HTMLElement>();

  const _syncTfSelection = (key: string) => {
    _itemEls.forEach((el, k) => {
      const sel = k === key;
      el.style.background = sel ? '#1e2d42' : 'transparent';
      el.style.color = sel ? '#ffffff' : '#1e2a3c';
      el.style.fontWeight = sel ? '600' : '400';
    });
  };

  const _renderDropdown = () => {
    tfDropdown.innerHTML = '';
    _itemEls.clear();
    _catMap.forEach((keys, catName) => {
      if (!keys.length) return;
      const collapsed = _collapseState.get(catName) ?? false;

      const catHdr = document.createElement('div');
      catHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px 4px;color:#8a96a8;font-size:10px;font-weight:700;letter-spacing:0.06em;cursor:pointer;user-select:none;';
      const cLabel = document.createElement('span');
      cLabel.textContent = catName;
      const cArrow = document.createElement('span');
      cArrow.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;opacity:0.6;transition:transform 0.15s;';
      cArrow.innerHTML = collapsed
        ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,4 5,7 8,4"></polyline></svg>'
        : '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,3 8,6"></polyline></svg>';
      catHdr.appendChild(cLabel);
      catHdr.appendChild(cArrow);
      catHdr.addEventListener('click', () => { _collapseState.set(catName, !collapsed); _renderDropdown(); });
      tfDropdown.appendChild(catHdr);

      if (!collapsed) {
        keys.forEach((key) => {
          const tf = timeframes.find((t) => t.key === key);
          if (!tf) return;
          const sel = key === _tfKey;
          const item = document.createElement('div');
          item.style.cssText = `padding:9px 14px;font-size:13px;color:${sel ? '#ffffff' : '#1e2a3c'};background:${sel ? '#1e2d42' : 'transparent'};cursor:pointer;font-weight:${sel ? '600' : '400'};border-radius:4px;margin:0 4px;white-space:nowrap;line-height:1;`;
          item.textContent = _getTfDropdownLabel(key);
          item.addEventListener('mouseenter', () => { if (key !== _tfKey) { item.style.background = '#eef1f7'; item.style.color = '#1a2438'; } });
          item.addEventListener('mouseleave', () => { item.style.background = key === _tfKey ? '#1e2d42' : 'transparent'; item.style.color = key === _tfKey ? '#ffffff' : '#1e2a3c'; });
          item.addEventListener('click', () => {
            _tfKey = key;
            tfBtn.textContent = _getTfSelectedLabelLower(key);
            _syncTfSelection(key);
            tfSelect.dispatchEvent(new Event('change'));
            _closeDd();
          });
          _itemEls.set(key, item);
          tfDropdown.appendChild(item);
        });
      }
    });
  };

  const _openDd = () => {
    _renderDropdown();
    const r = tfBtn.getBoundingClientRect();
    tfDropdown.style.display = 'block';
    tfDropdown.style.left = `${r.left}px`;
    tfDropdown.style.top = `${r.bottom + 2}px`;
    requestAnimationFrame(() => {
      const dr = tfDropdown.getBoundingClientRect();
      if (dr.right > window.innerWidth - 4) tfDropdown.style.left = `${r.right - dr.width}px`;
      if (dr.bottom > window.innerHeight - 4) tfDropdown.style.top = `${r.top - dr.height - 2}px`;
    });
  };
  const _closeDd = () => { tfDropdown.style.display = 'none'; };

  tfBtn.addEventListener('click', (e) => { e.stopPropagation(); tfDropdown.style.display === 'none' ? _openDd() : _closeDd(); });
  document.addEventListener('click', _closeDd);
  tfDropdown.addEventListener('click', (e) => e.stopPropagation());

  const symBtn = document.createElement('button');
  symBtn.type = 'button';
  symBtn.style.cssText = 'display:flex;align-items:center;gap:6px;background:transparent;border:none;color:#d1d4dc;border-radius:0;padding:0;cursor:pointer;height:26px;min-width:0;max-width:44%;';
  const symIcon = createSymbolIconElement(chartConfig.symbol, getSymbolIconUrl(chartConfig.symbol));
  const symLabel = document.createElement('span');
  symLabel.style.cssText = 'font-weight:700;white-space:nowrap;font-size:13px;line-height:1;';
  symBtn.appendChild(symIcon);
  symBtn.appendChild(symLabel);
  paneHeader.appendChild(symBtn);

  const marketPriceWrap = document.createElement('div');
  marketPriceWrap.style.cssText = 'display:flex;align-items:center;gap:0;min-width:0;flex-shrink:0;width:146px;justify-content:flex-start;';
  const symPriceLabel = document.createElement('span');
  symPriceLabel.style.cssText = "font-size:13px;font-weight:600;color:#9aa7c1;white-space:nowrap;line-height:1;font-variant-numeric:tabular-nums;font-family:-apple-system,BlinkMacSystemFont,'Trebuchet MS',Roboto,Ubuntu,sans-serif;flex-shrink:0;margin-right:4px;";
  symPriceLabel.textContent = '--';
  const symChangeWrap = document.createElement('span');
  symChangeWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;justify-content:center;line-height:1;gap:1px;width:58px;flex-shrink:0;';
  const symChangeMetaLabel = document.createElement('span');
  symChangeMetaLabel.style.cssText = "font-size:9px;color:#7f889a;font-weight:500;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Trebuchet MS',Roboto,Ubuntu,sans-serif;";
  symChangeMetaLabel.textContent = '24h';
  const symChangeLabel = document.createElement('span');
  symChangeLabel.style.cssText = "font-size:12px;font-weight:500;color:#9aa7c1;white-space:nowrap;line-height:1;font-variant-numeric:tabular-nums;font-family:-apple-system,BlinkMacSystemFont,'Trebuchet MS',Roboto,Ubuntu,sans-serif;";
  symChangeLabel.textContent = '--';
  symChangeWrap.appendChild(symChangeMetaLabel);
  symChangeWrap.appendChild(symChangeLabel);
  marketPriceWrap.appendChild(symPriceLabel);
  marketPriceWrap.appendChild(symChangeWrap);
  paneHeader.appendChild(marketPriceWrap);

  paneHeader.appendChild(tfSelect);   // hidden reference node (kept for insertBefore compat)
  paneHeader.appendChild(tfBtn);

  const currencySelect = document.createElement('select');
  currencySelect.style.cssText = 'background:#1f2533;color:#d1d4dc;border:1px solid #2f3648;border-radius:4px;font-size:11px;padding:1px 4px;flex-shrink:0;width:58px;text-align:center;appearance:none;-webkit-appearance:none;cursor:pointer;';
  const quoteOptions: Array<{ value: string; label: string }> = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EURO' },
    { value: 'JPY', label: 'JPN' },
    { value: 'USDT', label: 'USDT' },
    { value: 'KRW', label: 'KRW' },
    { value: 'BTC', label: 'BTC' },
  ];
  quoteOptions.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    currencySelect.appendChild(opt);
  });
  currencySelect.value = 'USDT';

  const indBtn = document.createElement('button');
  indBtn.type = 'button';
  indBtn.title = '보조지표';
  indBtn.setAttribute('aria-label', '보조지표');
  indBtn.style.cssText = `height:22px;background:${headerActionBg};color:#d1d4dc;border:none;border-radius:4px;padding:0 8px;cursor:pointer;font-size:11px;white-space:nowrap;line-height:1;flex-shrink:0;transition:background 0.15s;display:inline-flex;align-items:center;justify-content:center;`;
  const setIndicatorButtonIcon = (size: number) => {
    indBtn.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">
      <path d="M3 21V16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M9 21V17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M15 21V12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M21 21V10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M2.2 8.2C4.8 11.4 7.2 11.4 9.8 8.2C12.4 5 14.8 1.8 17.4 1.8C18.8 1.8 20 2.5 21.2 3.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
  };
  setIndicatorButtonIcon(17);
  bindHeaderActionHover(indBtn);
  paneHeader.appendChild(indBtn);

  const strategyBtn = document.createElement('button');
  strategyBtn.type = 'button';
  strategyBtn.title = '전략시그널';
  strategyBtn.setAttribute('aria-label', '전략시그널');
  strategyBtn.style.cssText = `height:22px;background:${headerActionBg};color:#fff;border:none;border-radius:4px;padding:0 7px;cursor:pointer;font-size:11px;white-space:nowrap;line-height:1;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;transition:background 0.15s;`;
  bindHeaderActionHover(strategyBtn);
  const setStrategyButtonIcon = (size: number) => {
    strategyBtn.innerHTML = `<img src="/icon-signal.svg" alt="" aria-hidden="true" style="width:${size}px;height:${size}px;display:block;filter:${signalIconFilter};">`;
  };
  setStrategyButtonIcon(18);
  paneHeader.appendChild(strategyBtn);

  const headerTitle = document.createElement('div');
  headerTitle.className = 'tc-live-status-badge';
  headerTitle.style.cssText = 'display:none;';
  paneHeader.appendChild(headerTitle);

  const marketSessionBadge = document.createElement('span');
  marketSessionBadge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:10px;height:10px;border-radius:50%;border:1px solid #3a4155;background:#3a4155;flex-shrink:0;';
  marketSessionBadge.title = '장상태';
  paneHeader.appendChild(marketSessionBadge);

  const ohlcHeaderDisplay = document.createElement('div');
  ohlcHeaderDisplay.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:auto;font-size:11px;font-family:"Segoe UI",Arial,sans-serif;white-space:nowrap;flex-shrink:0;line-height:1;';
  paneHeader.appendChild(ohlcHeaderDisplay);

  paneHeader.appendChild(currencySelect);

  const winCtrlWrap = document.createElement('div');
  winCtrlWrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:6px;';
  paneHeader.appendChild(winCtrlWrap);

  const minBtn = makeHeaderCtrlBtn('−', '최소화');
  const maxBtn = makeHeaderCtrlBtn('□', '최대화/복원');
  const closeBtn = makeHeaderCtrlBtn('×', '닫기');
  winCtrlWrap.appendChild(minBtn);
  winCtrlWrap.appendChild(maxBtn);
  winCtrlWrap.appendChild(closeBtn);

  const refreshSymbolVisual = (symbol: string) => {
    const iconUrl = getSymbolIconUrl(symbol);
    const nextIcon = createSymbolIconElement(symbol, iconUrl);
    symIcon.innerHTML = '';
    symIcon.append(...Array.from(nextIcon.childNodes));
    symLabel.textContent = getSymbolDisplayLabel ? getSymbolDisplayLabel(symbol) : symbol;
  };

  const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const applyResponsive = () => {
    const w = window.innerWidth;
    const isMobilePhone = w < 768 && (
      /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent) || isTouchDevice || w < 600
    );
    indBtn.style.display = isMobilePhone ? 'none' : '';
    strategyBtn.style.display = (isMobilePhone || !showStrategyButton) ? 'none' : '';
    const width = host.clientWidth;
    if (width < 560) {
      paneHeader.style.gap = '3px';
      paneHeader.style.padding = '0 4px';
      symBtn.style.maxWidth = '38%';
      marketPriceWrap.style.width = '110px';
      symPriceLabel.style.width = '';
      symPriceLabel.style.fontSize = '12px';
      symPriceLabel.style.display = '';
      symChangeWrap.style.display = '';
      symChangeMetaLabel.style.display = 'none';
      symChangeLabel.style.fontSize = '11px';
      tfBtn.style.fontSize = '10px';
      tfBtn.style.padding = '0 5px';
      currencySelect.style.fontSize = '10px';
      currencySelect.style.padding = '1px 3px';
      currencySelect.style.width = '48px';
      setIndicatorButtonIcon(16);
      setStrategyButtonIcon(17);
      indBtn.style.padding = '0 6px';
      strategyBtn.style.padding = '0 5px';
      indBtn.style.fontSize = '10px';
      strategyBtn.style.fontSize = '10px';
    } else if (width < 700) {
      paneHeader.style.gap = '5px';
      paneHeader.style.padding = '0 5px';
      symBtn.style.maxWidth = '50%';
      marketPriceWrap.style.width = '142px';
      symPriceLabel.style.width = '';
      symPriceLabel.style.fontSize = '';
      symPriceLabel.style.display = '';
      symChangeWrap.style.display = '';
      symChangeMetaLabel.style.display = '';
      symChangeLabel.style.fontSize = '';
      tfBtn.style.fontSize = '10px';
      tfBtn.style.padding = '0 6px';
      currencySelect.style.fontSize = '10px';
      currencySelect.style.width = '55px';
      setIndicatorButtonIcon(17);
      setStrategyButtonIcon(18);
      indBtn.style.padding = '0 7px';
      strategyBtn.style.padding = '0 6px';
      indBtn.style.fontSize = '10px';
      strategyBtn.style.fontSize = '10px';
    } else {
      paneHeader.style.gap = '6px';
      paneHeader.style.padding = '0 7px';
      symBtn.style.maxWidth = '44%';
      marketPriceWrap.style.width = '146px';
      symPriceLabel.style.width = '';
      symPriceLabel.style.fontSize = '';
      symPriceLabel.style.display = '';
      symChangeWrap.style.display = '';
      symChangeMetaLabel.style.display = '';
      symChangeLabel.style.fontSize = '';
      tfBtn.style.fontSize = '11px';
      tfBtn.style.padding = '0 8px';
      currencySelect.style.fontSize = '11px';
      currencySelect.style.width = '58px';
      setIndicatorButtonIcon(18);
      setStrategyButtonIcon(19);
      indBtn.style.padding = '0 8px';
      strategyBtn.style.padding = '0 7px';
      indBtn.style.fontSize = '11px';
      strategyBtn.style.fontSize = '11px';
    }
  };

  const resizeObserver = new ResizeObserver(() => applyResponsive());
  resizeObserver.observe(host);
  applyResponsive();

  return {
    paneRoot,
    paneHeader,
    chartArea,
    tfSelect,
    currencySelect,
    symBtn,
    symIcon,
    symLabel,
    marketPriceWrap,
    symPriceLabel,
    symChangeLabel,
    symChangeMetaLabel,
    indBtn,
    strategyBtn,
    marketSessionBadge,
    headerTitle,
    ohlcHeaderDisplay,
    winCtrlWrap,
    minBtn,
    maxBtn,
    closeBtn,
    refreshSymbolVisual,
  };
}
