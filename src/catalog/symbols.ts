export type SymbolCatalogItem = { id: string; label: string; desc: string; category: string; iconUrl?: string };

const SYMBOL_STORAGE_KEY = 'my-chart-lib.symbol-registry.v1';
const NASDAQ_FUTURES_CANONICAL_SYMBOL = 'NQ1!';

function normalizeCatalogSymbolId(id: string): string {
  const normalized = String(id || '').trim().toUpperCase();
  if (normalized === 'NAS100' || normalized === 'NQ') return NASDAQ_FUTURES_CANONICAL_SYMBOL;
  return normalized;
}

const DEFAULT_SYMBOL_CATALOG: Record<string, { id: string; label: string; desc: string; iconUrl?: string }[]> = {
  index: [
    { id: NASDAQ_FUTURES_CANONICAL_SYMBOL, label: 'E-mini Nasdaq-100 Futures', desc: 'E-mini Nasdaq-100 Futures' },
    { id: 'SPX500', label: 'SPX500', desc: 'S&P 500' },
    { id: 'HSI', label: 'HSI', desc: 'Hang Seng' },
    { id: 'KOSPI', label: 'KOSPI', desc: 'Korea Composite Stock Price Index' },
    { id: 'KOSPI200', label: 'KOSPI200', desc: 'KOSPI 200' },
    { id: 'KOSDAQ', label: 'KOSDAQ', desc: 'Korea Securities Dealers Automated Quotations' },
  ],
  crypto: [
    { id: 'BTCUSDT', label: 'BTCUSDT', desc: 'Bitcoin / USDT' },
    { id: 'ETHUSDT', label: 'ETHUSDT', desc: 'Ethereum / USDT' },
    { id: 'SOLUSDT', label: 'SOLUSDT', desc: 'Solana / USDT' },
  ],
  commodity: [
    { id: 'XAUUSD', label: 'XAUUSD', desc: 'Gold / USD' },
    { id: 'WTI1!', label: 'WTI', desc: 'WTI Crude Oil Futures' },
    { id: 'XAGUSD', label: 'XAGUSD', desc: 'Silver / USD' },
    { id: 'XAUUSDT.P', label: 'XAUUSDT.P', desc: 'Gold Perpetual Futures / USDT' },
    { id: 'XAGUSDT.P', label: 'XAGUSDT.P', desc: 'Silver Perpetual Futures / USDT' },
  ],
};

const SPOT_ADDITIONAL_SYMBOLS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'XRPUSDT', label: 'XRPUSDT', desc: 'XRP / USDT' },
  { id: 'BNBUSDT', label: 'BNBUSDT', desc: 'BNB / USDT' },
  { id: 'TRXUSDT', label: 'TRXUSDT', desc: 'TRX / USDT' },
];

const FUTURES_SYMBOLS: Array<{ id: string; label: string; desc: string }> = [
  { id: 'BTCUSDT.P', label: 'BTCUSDT.P', desc: 'BTCUSDT Perpetual Futures' },
  { id: 'ETHUSDT.P', label: 'ETHUSDT.P', desc: 'ETHUSDT Perpetual Futures' },
  { id: 'XRPUSDT.P', label: 'XRPUSDT.P', desc: 'XRPUSDT Perpetual Futures' },
  { id: 'BNBUSDT.P', label: 'BNBUSDT.P', desc: 'BNBUSDT Perpetual Futures' },
  { id: 'SOLUSDT.P', label: 'SOLUSDT.P', desc: 'SOLUSDT Perpetual Futures' },
  { id: 'TRXUSDT.P', label: 'TRXUSDT.P', desc: 'TRXUSDT Perpetual Futures' },
];

{
  const cryptoCategory = Object.keys(DEFAULT_SYMBOL_CATALOG).find((category) =>
    DEFAULT_SYMBOL_CATALOG[category]?.some((item) => item.id === 'BTCUSDT'),
  );
  if (cryptoCategory) {
    const exists = new Set(DEFAULT_SYMBOL_CATALOG[cryptoCategory].map((item) => item.id));
    SPOT_ADDITIONAL_SYMBOLS.forEach((symbol) => {
      if (!exists.has(symbol.id)) {
        DEFAULT_SYMBOL_CATALOG[cryptoCategory].push(symbol);
      }
    });
  }

  const futuresCategory = 'Crypto Futures';
  const futuresList = DEFAULT_SYMBOL_CATALOG[futuresCategory] ?? (DEFAULT_SYMBOL_CATALOG[futuresCategory] = []);
  const futuresExists = new Set(futuresList.map((item) => item.id));
  FUTURES_SYMBOLS.forEach((symbol) => {
    if (!futuresExists.has(symbol.id)) {
      futuresList.push(symbol);
    }
  });
}

export const SYMBOL_CATALOG: Record<string, { id: string; label: string; desc: string; iconUrl?: string }[]> = Object.fromEntries(
  Object.entries(DEFAULT_SYMBOL_CATALOG).map(([category, items]) => [category, items.map((item) => ({ ...item }))]),
);

export const CUSTOM_SYMBOLS: SymbolCatalogItem[] = [];

const SYMBOL_ICON_CATEGORY: Record<string, string> = {
  'NQ1!': 'index', NAS100: 'index', SPX500: 'index', HKG33: 'index', HSI: 'index',
  KOSPI: 'index', KOSPI200: 'index', KOSDAQ: 'index',
  BTCUSDT: 'crypto', ETHUSDT: 'crypto', SOLUSDT: 'crypto',
  XRPUSDT: 'crypto', BNBUSDT: 'crypto', TRXUSDT: 'crypto',
  'BTCUSDT.P': 'crypto', 'ETHUSDT.P': 'crypto', 'XRPUSDT.P': 'crypto', 'BNBUSDT.P': 'crypto', 'SOLUSDT.P': 'crypto', 'TRXUSDT.P': 'crypto',
  XAUUSD: 'commodity', USOUSD: 'commodity', XAGUSD: 'commodity', 'WTI1!': 'commodity',
  'XAUUSDT.P': 'commodity', 'XAGUSDT.P': 'commodity',
};

function isValidBuiltinItem(value: unknown): value is { id: string; label: string; desc: string; iconUrl?: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.label === 'string' && typeof v.desc === 'string';
}

function normalizeCustomItem(value: unknown): SymbolCatalogItem | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.label !== 'string' || typeof v.desc !== 'string' || typeof v.category !== 'string') {
    return null;
  }
  const iconUrl = typeof v.iconUrl === 'string' && v.iconUrl.trim() ? v.iconUrl.trim() : undefined;
  return {
    id: normalizeCatalogSymbolId(v.id),
    label: v.label,
    desc: v.desc,
    category: v.category,
    iconUrl,
  };
}

function restoreDefaultCatalog(): void {
  Object.keys(SYMBOL_CATALOG).forEach((key) => delete SYMBOL_CATALOG[key]);
  for (const [category, items] of Object.entries(DEFAULT_SYMBOL_CATALOG)) {
    SYMBOL_CATALOG[category] = items.map((item) => ({ ...item }));
  }
}

function applyBuiltinLabelOverrides(): void {
  for (const items of Object.values(SYMBOL_CATALOG)) {
    for (const item of items) {
      const normalizedId = normalizeCatalogSymbolId(item.id);
      if (normalizedId !== item.id) item.id = normalizedId;
      if (normalizedId === NASDAQ_FUTURES_CANONICAL_SYMBOL) {
        item.label = 'E-mini Nasdaq-100 Futures';
        item.desc = 'E-mini Nasdaq-100 Futures';
      }
    }
  }
}

function ensureBuiltinSymbolsPresent(): void {
  const commodityCategory = Object.keys(SYMBOL_CATALOG).find((category) =>
    SYMBOL_CATALOG[category]?.some((item) => item.id.toUpperCase() === 'XAUUSD'),
  ) ?? 'commodity';

  const required: Array<{ id: string; label: string; desc: string }> = [
    { id: 'XAUUSDT.P', label: 'XAUUSDT.P', desc: 'Gold Perpetual Futures / USDT' },
    { id: 'XAGUSDT.P', label: 'XAGUSDT.P', desc: 'Silver Perpetual Futures / USDT' },
    { id: 'WTI1!', label: 'WTI', desc: 'WTI Crude Oil Futures' },
  ];

  for (const item of required) {
    if (!SYMBOL_CATALOG[commodityCategory]) SYMBOL_CATALOG[commodityCategory] = [];
    const exists = SYMBOL_CATALOG[commodityCategory].some((row) => row.id.toUpperCase() === item.id);
    if (!exists) {
      SYMBOL_CATALOG[commodityCategory].push({
        id: item.id,
        label: item.label,
        desc: item.desc,
      });
    }
  }

  const indexCategory = Object.keys(SYMBOL_CATALOG).find((category) =>
    SYMBOL_CATALOG[category]?.some((item) => ['NAS100', NASDAQ_FUTURES_CANONICAL_SYMBOL].includes(item.id.toUpperCase())),
  ) ?? 'index';
  if (!SYMBOL_CATALOG[indexCategory]) SYMBOL_CATALOG[indexCategory] = [];
  const hasCanonicalNasdaq = SYMBOL_CATALOG[indexCategory].some(
    (row) => normalizeCatalogSymbolId(row.id) === NASDAQ_FUTURES_CANONICAL_SYMBOL,
  );
  if (!hasCanonicalNasdaq) {
    SYMBOL_CATALOG[indexCategory].unshift({
      id: NASDAQ_FUTURES_CANONICAL_SYMBOL,
      label: 'E-mini Nasdaq-100 Futures',
      desc: 'E-mini Nasdaq-100 Futures',
    });
  }
}

function loadSymbolRegistry(): void {
  restoreDefaultCatalog();
  CUSTOM_SYMBOLS.length = 0;
  try {
    const raw = localStorage.getItem(SYMBOL_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      catalog?: Record<string, unknown[]>;
      custom?: unknown[];
    };

    if (parsed.catalog && typeof parsed.catalog === 'object') {
      Object.keys(SYMBOL_CATALOG).forEach((key) => delete SYMBOL_CATALOG[key]);
      for (const [category, values] of Object.entries(parsed.catalog)) {
        const items = Array.isArray(values)
          ? values
            .filter(isValidBuiltinItem)
            .map((item) => ({ ...item, id: normalizeCatalogSymbolId(item.id) }))
          : [];
        if (items.length) SYMBOL_CATALOG[category] = items;
      }
      if (!Object.keys(SYMBOL_CATALOG).length) {
        restoreDefaultCatalog();
      }
    }

    if (Array.isArray(parsed.custom)) {
      parsed.custom.forEach((item) => {
        const normalized = normalizeCustomItem(item);
        if (normalized) CUSTOM_SYMBOLS.push(normalized);
      });
    }
  } catch {
    restoreDefaultCatalog();
    CUSTOM_SYMBOLS.length = 0;
  }
  ensureBuiltinSymbolsPresent();
  applyBuiltinLabelOverrides();
}

export function persistSymbolRegistry(): void {
  try {
    const payload = {
      catalog: SYMBOL_CATALOG,
      custom: CUSTOM_SYMBOLS,
    };
    localStorage.setItem(SYMBOL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/security errors.
  }
}

export function getAllSymbolCatalog(): Record<string, SymbolCatalogItem[]> {
  const catalog: Record<string, SymbolCatalogItem[]> = {};
  for (const [category, items] of Object.entries(SYMBOL_CATALOG)) {
    catalog[category] = items.map((item) => ({ ...item, category }));
  }
  for (const item of CUSTOM_SYMBOLS) {
    if (!catalog[item.category]) catalog[item.category] = [];
    catalog[item.category].push(item);
  }
  return catalog;
}

export function findSymbolItem(symbolId: string): SymbolCatalogItem | undefined {
  const normalized = normalizeCatalogSymbolId(symbolId);
  const fallbacks = normalized.endsWith('.P') ? [normalized, normalized.slice(0, -2)] : [normalized];
  const all = Object.values(getAllSymbolCatalog()).flat();
  for (const candidate of fallbacks) {
    const found = all.find((item) => item.id === candidate);
    if (found) return found;
  }
  return undefined;
}

export function getSymbolIconSvg(symbolId: string): string {
  const normalized = normalizeCatalogSymbolId(symbolId);
  const kind = SYMBOL_ICON_CATEGORY[normalized] ??
    (normalized.includes('USDT') ? 'crypto' :
      normalized.startsWith('X') ? 'commodity' :
        'index');
  switch (kind) {
    case 'crypto':
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6" stroke="#4caf50" stroke-width="1.5" />
        <path d="M8 4.5V11.5" stroke="#4caf50" stroke-width="1.5" stroke-linecap="round" />
        <path d="M5 7H11" stroke="#4caf50" stroke-width="1.5" stroke-linecap="round" />
      </svg>`;
    case 'commodity':
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 11L8 5L12 11H4Z" fill="#ffb300" />
        <path d="M8 5V11" stroke="#8d6e00" stroke-width="1.2" />
      </svg>`;
    case 'index':
    default:
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="2" height="5" rx="1" fill="#42a5f5" />
        <rect x="7" y="4" width="2" height="7" rx="1" fill="#42a5f5" />
        <rect x="11" y="8" width="2" height="3" rx="1" fill="#42a5f5" />
      </svg>`;
  }
}

export function createSymbolIconElement(symbolId: string, iconUrl?: string): HTMLElement {
  const icon = document.createElement('span');
  icon.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;border-radius:50%;overflow:hidden;background:#0f1420;';
  if (iconUrl) {
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = symbolId;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
    icon.appendChild(img);
  } else {
    icon.innerHTML = getSymbolIconSvg(symbolId);
  }
  return icon;
}

export function getSymbolIconUrl(symbolId: string): string | undefined {
  // ?섎뱶肄붾뵫 留??곗꽑 (?ㅼ젙 遺덊븘??
  const BUILTIN_ICON_MAP: Record<string, string> = {
    'KOSPI':        'https://s3-symbol-logo.tradingview.com/indices/korea-composite-index.svg',
    'KOSPI200':     'https://s3-symbol-logo.tradingview.com/indices/kospi-200.svg',
    'KOSDAQ':       'https://s3-symbol-logo.tradingview.com/indices/kosdaq.svg',
    'SPX500':       'https://s3-symbol-logo.tradingview.com/indices/s-and-p-500.svg',
    'NQ1!':         'https://s3-symbol-logo.tradingview.com/indices/nasdaq-100.svg',
    'NAS100':       'https://s3-symbol-logo.tradingview.com/indices/nasdaq-100.svg',
    'HSI':          'https://s3-symbol-logo.tradingview.com/indices/hang-seng.svg',
    'BTCUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg',
    'BTCUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg',
    'ETHUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCETH.svg',
    'ETHUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCETH.svg',
    'TRXUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCTRX.svg',
    'TRXUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCTRX.svg',
    'XRPUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCXRP.svg',
    'XRPUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCXRP.svg',
    'SOLUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCSOL.svg',
    'SOLUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCSOL.svg',
    'BNBUSDT':      'https://s3-symbol-logo.tradingview.com/crypto/XTVCBNB.svg',
    'BNBUSDT.P':    'https://s3-symbol-logo.tradingview.com/crypto/XTVCBNB.svg',
    'USOUSD':       'https://s3-symbol-logo.tradingview.com/crude-oil.svg',
    'WTI1!':        'https://s3-symbol-logo.tradingview.com/crude-oil.svg',
    'XAUUSD':       'https://s3-symbol-logo.tradingview.com/metal/gold.svg',
    'XAGUSD':       'https://s3-symbol-logo.tradingview.com/metal/silver.svg',
    'XAUUSDT.P':    'https://s3-symbol-logo.tradingview.com/metal/gold.svg',
    'XAGUSDT.P':    'https://s3-symbol-logo.tradingview.com/metal/silver.svg',
    'COPPER':       'https://s3-symbol-logo.tradingview.com/metal/copper.svg',
  };
  const upper = normalizeCatalogSymbolId(symbolId);
  return BUILTIN_ICON_MAP[upper] ?? findSymbolItem(symbolId)?.iconUrl;
}

loadSymbolRegistry();

