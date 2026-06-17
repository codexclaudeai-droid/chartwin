export type GatewayMarket = 'futures' | 'index' | 'commodity' | 'fx';
export type GatewayReportMarket = 'crypto' | GatewayMarket;

const FX_QUOTES = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'KRW', 'CNH', 'HKD', 'SGD'];
const NASDAQ_INDEX_FUTURES_SYMBOLS = new Set(['NQ1!', 'NAS100', 'NQ', 'NAS100FT', 'NAS100.FT', 'NAS100FUTURES']);

export function normalizeSymbol(symbol: string): string {
  const normalized = symbol.replace(/\s+/g, '').toUpperCase();
  if (NASDAQ_INDEX_FUTURES_SYMBOLS.has(normalized)) return 'NQ1!';
  if (normalized === '^IXIC') return 'NASDAQ';
  return normalized;
}

function stripCryptoFuturesSuffix(symbol: string): string {
  return symbol.endsWith('.P') ? symbol.slice(0, -2) : symbol;
}

function isCryptoLikeSymbol(symbol: string): boolean {
  const base = stripCryptoFuturesSuffix(normalizeSymbol(symbol));
  return base.endsWith('USDT') || base.endsWith('BUSD') || base.endsWith('USDC');
}

function isFxLikeSymbol(symbol: string): boolean {
  const upper = normalizeSymbol(symbol);
  if (!/^[A-Z]{6}$/.test(upper)) return false;
  const base = upper.slice(0, 3);
  const quote = upper.slice(3);
  return FX_QUOTES.includes(base) && FX_QUOTES.includes(quote);
}

function isCommodityLikeSymbol(symbol: string): boolean {
  const upper = normalizeSymbol(symbol);
  return upper.startsWith('XAU') || upper.startsWith('XAG') || upper.startsWith('XPT') || upper.startsWith('USO') || upper.startsWith('WTI') || upper.startsWith('BRENT');
}

function isIndexFuturesSymbol(symbol: string): boolean {
  return NASDAQ_INDEX_FUTURES_SYMBOLS.has(symbol.replace(/\s+/g, '').toUpperCase());
}

export function shouldUseBinanceDirect(symbol: string): boolean {
  return isCryptoLikeSymbol(symbol);
}

export function inferGatewayMarket(symbol: string): GatewayMarket {
  if (isCommodityLikeSymbol(symbol)) return 'commodity';
  if (isFxLikeSymbol(symbol)) return 'fx';
  if (isIndexFuturesSymbol(symbol)) return 'futures';
  if (/^([A-Z]{2,5}\d{2,4}|SPX500|NDX|NASDAQ|IXIC|HSI|DAX|NIKKEI|KOSPI|KOSDAQ|KOSPI200)$/.test(normalizeSymbol(symbol))) {
    return 'index';
  }
  return 'futures';
}

export function inferGatewayReportMarket(symbol: string): GatewayReportMarket {
  return isCryptoLikeSymbol(symbol) ? 'crypto' : inferGatewayMarket(symbol);
}
