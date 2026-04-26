export type SymbolCatalogItem = { id: string; label: string; desc: string; category: string; iconUrl?: string };

const SYMBOL_STORAGE_KEY = 'my-chart-lib.symbol-registry.v1';

const DEFAULT_SYMBOL_CATALOG: Record<string, { id: string; label: string; desc: string; iconUrl?: string }[]> = {
  '지수': [
    { id: 'NAS100', label: 'NAS100', desc: 'NASDAQ 100' },
    { id: 'SPX500', label: 'SPX500', desc: 'S&P 500' },
    { id: 'HKG33', label: 'HKG33', desc: 'Hang Seng' },
  ],
  '암호화폐': [
    { id: 'BTCUSDT', label: 'BTCUSDT', desc: 'Bitcoin / USDT' },
    { id: 'ETHUSDT', label: 'ETHUSDT', desc: 'Ethereum / USDT' },
    { id: 'SOLUSDT', label: 'SOLUSDT', desc: 'Solana / USDT' },
  ],
  '원자재': [
    { id: 'XAUUSD', label: 'XAUUSD', desc: 'Gold / USD' },
    { id: 'USOUSD', label: 'USOUSD', desc: 'Crude Oil / USD' },
    { id: 'XAGUSD', label: 'XAGUSD', desc: 'Silver / USD' },
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
  NAS100: 'index', SPX500: 'index', HKG33: 'index',
  BTCUSDT: 'crypto', ETHUSDT: 'crypto', SOLUSDT: 'crypto',
  XRPUSDT: 'crypto', BNBUSDT: 'crypto', TRXUSDT: 'crypto',
  'BTCUSDT.P': 'crypto', 'ETHUSDT.P': 'crypto', 'XRPUSDT.P': 'crypto', 'BNBUSDT.P': 'crypto', 'SOLUSDT.P': 'crypto', 'TRXUSDT.P': 'crypto',
  XAUUSD: 'commodity', USOUSD: 'commodity', XAGUSD: 'commodity',
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
    id: v.id.toUpperCase(),
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
        const items = Array.isArray(values) ? values.filter(isValidBuiltinItem).map((item) => ({ ...item })) : [];
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
  const normalized = symbolId.toUpperCase();
  const fallbacks = normalized.endsWith('.P') ? [normalized, normalized.slice(0, -2)] : [normalized];
  const all = Object.values(getAllSymbolCatalog()).flat();
  for (const candidate of fallbacks) {
    const found = all.find((item) => item.id === candidate);
    if (found) return found;
  }
  return undefined;
}

export function getSymbolIconSvg(symbolId: string): string {
  const kind = SYMBOL_ICON_CATEGORY[symbolId] ??
    (symbolId.includes('USDT') ? 'crypto' :
      symbolId.startsWith('X') ? 'commodity' :
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
  return findSymbolItem(symbolId)?.iconUrl;
}

loadSymbolRegistry();
