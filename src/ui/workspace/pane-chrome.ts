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
  strategyReportBtn: HTMLButtonElement;
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

export function createPaneChrome<TKey extends string>({
  host,
  chartConfig,
  timeframes,
  createSymbolIconElement,
  getSymbolIconUrl,
  getSymbolDisplayLabel,
}: CreatePaneChromeArgs<TKey>): PaneChrome {
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

  const tfSelect = document.createElement('select');
  tfSelect.style.cssText = 'background:#1f2533;color:#d1d4dc;border:1px solid #2f3648;border-radius:4px;font-size:11px;padding:1px 4px;flex-shrink:0;';
  timeframes.forEach(({ key, label }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    tfSelect.appendChild(opt);
  });
  tfSelect.value = chartConfig.timeframe;

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
  marketPriceWrap.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;flex-shrink:0;';
  const symPriceLabel = document.createElement('span');
  symPriceLabel.style.cssText = 'font-size:15px;font-weight:800;color:#9aa7c1;white-space:nowrap;line-height:1;';
  symPriceLabel.textContent = '--';
  const symChangeWrap = document.createElement('span');
  symChangeWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;justify-content:center;line-height:1;gap:1px;min-width:40px;';
  const symChangeMetaLabel = document.createElement('span');
  symChangeMetaLabel.style.cssText = 'font-size:9px;color:#7f889a;font-weight:600;line-height:1;';
  symChangeMetaLabel.textContent = '24h';
  const symChangeLabel = document.createElement('span');
  symChangeLabel.style.cssText = 'font-size:13px;font-weight:800;color:#9aa7c1;white-space:nowrap;line-height:1;';
  symChangeLabel.textContent = '--';
  symChangeWrap.appendChild(symChangeMetaLabel);
  symChangeWrap.appendChild(symChangeLabel);
  marketPriceWrap.appendChild(symPriceLabel);
  marketPriceWrap.appendChild(symChangeWrap);
  paneHeader.appendChild(marketPriceWrap);

  paneHeader.appendChild(tfSelect);

  const currencySelect = document.createElement('select');
  currencySelect.style.cssText = 'background:#1f2533;color:#d1d4dc;border:1px solid #2f3648;border-radius:4px;font-size:11px;padding:1px 4px;flex-shrink:0;min-width:58px;';
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
  indBtn.textContent = '보조지표';
  indBtn.style.cssText = 'height:22px;background:#1f2533;color:#d1d4dc;border:1px solid #2f3648;border-radius:4px;padding:0 8px;cursor:pointer;font-size:11px;white-space:nowrap;line-height:1;flex-shrink:0;';
  paneHeader.appendChild(indBtn);

  const strategyBtn = document.createElement('button');
  strategyBtn.type = 'button';
  strategyBtn.textContent = '전략시그널';
  strategyBtn.style.cssText = 'height:22px;background:#1f2533;color:#d1d4dc;border:1px solid #2f3648;border-radius:4px;padding:0 8px;cursor:pointer;font-size:11px;white-space:nowrap;line-height:1;flex-shrink:0;';
  paneHeader.appendChild(strategyBtn);

  const strategyReportBtn = document.createElement('button');
  strategyReportBtn.type = 'button';
  strategyReportBtn.className = 'strategy-report-open-btn';
  strategyReportBtn.title = '전략 리포트 열기';
  strategyReportBtn.style.cssText = 'width:20px;height:17px;border:1px solid #3a4158;border-radius:4px;background:#ffffff;color:#0f1218;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease,color 0.15s ease;flex-shrink:0;';
  strategyReportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <polyline class="sr-chart-line" points="4 16 9 11 13 13 19 7"></polyline>
    <path class="sr-arrow-down" d="M5 4v4"></path>
    <path class="sr-arrow-down" d="M3 7l2 2 2-2"></path>
    <path class="sr-arrow-up" d="M19 17v-4"></path>
    <path class="sr-arrow-up" d="M17 15l2-2 2 2"></path>
  </svg>`;
  strategyReportBtn.addEventListener('mouseenter', () => {
    strategyReportBtn.style.background = '#ffffff';
    strategyReportBtn.style.borderColor = '#9aa3b3';
    strategyReportBtn.style.color = '#000000';
  });
  strategyReportBtn.addEventListener('mouseleave', () => {
    strategyReportBtn.style.background = '#ffffff';
    strategyReportBtn.style.borderColor = '#3a4158';
    strategyReportBtn.style.color = '#0f1218';
  });
  paneHeader.appendChild(strategyReportBtn);

  const headerTitle = document.createElement('div');
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

  const applyResponsive = () => {
    const width = host.clientWidth;
    if (width < 560) {
      paneHeader.style.gap = '4px';
      paneHeader.style.padding = '0 4px';
      symBtn.style.maxWidth = '54%';
      symPriceLabel.style.display = 'none';
      symChangeWrap.style.display = 'none';
      tfSelect.style.fontSize = '10px';
      tfSelect.style.padding = '1px 3px';
      currencySelect.style.fontSize = '10px';
      currencySelect.style.padding = '1px 3px';
      currencySelect.style.minWidth = '52px';
      indBtn.textContent = '보조지표';
      strategyBtn.textContent = '전략시그널';
      indBtn.style.padding = '0 6px';
      strategyBtn.style.padding = '0 6px';
      indBtn.style.fontSize = '10px';
      strategyBtn.style.fontSize = '10px';
      strategyReportBtn.style.width = '18px';
      strategyReportBtn.style.height = '16px';
    } else if (width < 700) {
      paneHeader.style.gap = '5px';
      paneHeader.style.padding = '0 5px';
      symBtn.style.maxWidth = '50%';
      symPriceLabel.style.display = '';
      symChangeWrap.style.display = '';
      tfSelect.style.fontSize = '10px';
      currencySelect.style.fontSize = '10px';
      currencySelect.style.minWidth = '55px';
      indBtn.textContent = '보조지표';
      strategyBtn.textContent = '전략시그널';
      indBtn.style.padding = '0 7px';
      strategyBtn.style.padding = '0 7px';
      indBtn.style.fontSize = '10px';
      strategyBtn.style.fontSize = '10px';
      strategyReportBtn.style.width = '19px';
      strategyReportBtn.style.height = '16px';
    } else {
      paneHeader.style.gap = '6px';
      paneHeader.style.padding = '0 7px';
      symBtn.style.maxWidth = '44%';
      symPriceLabel.style.display = '';
      symChangeWrap.style.display = '';
      tfSelect.style.fontSize = '11px';
      tfSelect.style.padding = '1px 4px';
      currencySelect.style.fontSize = '11px';
      currencySelect.style.minWidth = '58px';
      indBtn.textContent = '보조지표';
      strategyBtn.textContent = '전략시그널';
      indBtn.style.padding = '0 8px';
      strategyBtn.style.padding = '0 8px';
      indBtn.style.fontSize = '11px';
      strategyBtn.style.fontSize = '11px';
      strategyReportBtn.style.width = '20px';
      strategyReportBtn.style.height = '17px';
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
    strategyReportBtn,
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

