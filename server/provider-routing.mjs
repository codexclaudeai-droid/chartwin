const KIS_PREFERRED_INDEX_SYMBOLS = ['KOSPI', 'KOSPI200', 'KOSDAQ'];

export function getPreferredSymbolProviders() {
  return {
    index: Object.fromEntries(KIS_PREFERRED_INDEX_SYMBOLS.map((symbol) => [symbol, 'kis'])),
  };
}

export function resolveProviderForSymbol({
  market,
  symbol,
  configuredProvider,
  hasKisCredentials,
}) {
  const normalizedMarket = String(market || '').trim().toLowerCase();
  const normalizedProvider = String(configuredProvider || '').trim().toLowerCase();
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (normalizedMarket === 'index' && normalizedProvider === 'kis' && !hasKisCredentials) {
    if (KIS_PREFERRED_INDEX_SYMBOLS.includes(normalizedSymbol)) return 'webhook';
  }
  return normalizedProvider;
}
