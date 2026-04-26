import type { CandleData } from '../types';
import type { TimeframeKey } from '../catalog/time';
import type { DisplayCurrency } from '../types/market';
import { getBucketStartSec, shiftBucketSec } from '../chart/axis-utils';

export interface MarketDataAPI {
  fetchHistoricalData(symbol: string, timeframe: string, limit: number): Promise<CandleData[]>;
  fetchRealTimeData?(symbol: string): Promise<Partial<CandleData>>;
}

export class FinnhubAPI implements MarketDataAPI {
  private apiKey: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  async fetchHistoricalData(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
    if (!this.apiKey) {
      console.warn('Finnhub API key not set. Using dummy data. Get free key: https://finnhub.io');
      return generateDummyData(limit, timeframe as TimeframeKey);
    }

    try {
      const resolution = this.mapTimeframeToResolution(timeframe);
      const to = Math.floor(Date.now() / 1000);
      const from = to - this.getSecondsBack(timeframe, limit);

      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${this.apiKey}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (!data.o || data.o.length === 0) {
        console.warn(`No data for ${symbol}, using dummy data`);
        return generateDummyData(limit, timeframe as TimeframeKey);
      }

      const candles: CandleData[] = [];
      for (let i = 0; i < data.o.length && candles.length < limit; i++) {
        candles.push({
          time: Math.floor(data.t[i]),
          open: data.o[i],
          high: data.h[i],
          low: data.l[i],
          close: data.c[i],
          volume: data.v[i] || 0,
        });
      }

      return candles.sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error(`Finnhub API error for ${symbol}:`, error);
      return generateDummyData(limit, timeframe as TimeframeKey);
    }
  }

  private mapTimeframeToResolution(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '1d': 'D', '1w': 'W', '1M': 'M',
    };
    return map[timeframe] || 'D';
  }

  private getSecondsBack(timeframe: string, limit: number): number {
    const timeInSeconds: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '1d': 86400, '1w': 604800, '1M': 2592000,
    };
    const frameSeconds = timeInSeconds[timeframe] || 86400;
    return frameSeconds * limit;
  }
}

export class YahooFinanceAPI implements MarketDataAPI {
  async fetchHistoricalData(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
    console.warn('Yahoo Finance has CORS issues. Using Finnhub instead.');
    return generateDummyData(limit, timeframe as TimeframeKey);
  }
}

export class LocalDataAPI implements MarketDataAPI {
  private dataCache: Map<string, CandleData[]> = new Map();

  async fetchHistoricalData(symbol: string, timeframe: string, limit: number): Promise<CandleData[]> {
    const cacheKey = `${symbol}_${timeframe}`;

    if (this.dataCache.has(cacheKey)) {
      return this.dataCache.get(cacheKey)!.slice(-limit);
    }

    try {
      const response = await fetch(`/data/${symbol}_${timeframe}.json`);
      if (response.ok) {
        const data = await response.json();
        this.dataCache.set(cacheKey, data);
        return data.slice(-limit);
      }
    } catch {
      console.warn(`Local data file not found for ${symbol}, using dummy data`);
    }

    return generateDummyData(limit, timeframe as TimeframeKey);
  }
}

const DATA_SOURCES: Record<string, MarketDataAPI | null> = {
  binance: null,
  finnhub: new FinnhubAPI(''),
  local: new LocalDataAPI(),
  dummy: null,
};

let currentDataSource: keyof typeof DATA_SOURCES = 'dummy';

export function setFinnhubApiKey(apiKey: string): void {
  if (apiKey && apiKey.trim()) {
    DATA_SOURCES.finnhub = new FinnhubAPI(apiKey.trim());
    currentDataSource = 'finnhub';
    localStorage.setItem('finnhub-api-key', apiKey.trim());
    console.log('Finnhub API key set successfully');
  } else {
    console.warn('Finnhub API key is empty');
  }
}

export function loadSavedApiKeys(): void {
  const savedKey = localStorage.getItem('finnhub-api-key');
  if (savedKey) {
    setFinnhubApiKey(savedKey);
  }
}

export function setDataSource(source: keyof typeof DATA_SOURCES): void {
  currentDataSource = source;
  console.log(`Data source changed to: ${source}`);
}

const SYMBOL_DATA_SOURCES: Record<string, keyof typeof DATA_SOURCES> = {
  BTCUSDT: 'binance',
  ETHUSDT: 'binance',
  SOLUSDT: 'binance',
  AAPL: 'finnhub',
  MSFT: 'finnhub',
  GOOGL: 'finnhub',
  TSLA: 'finnhub',
  AMZN: 'finnhub',
  NVDA: 'finnhub',
  META: 'finnhub',
  '^GSPC': 'finnhub',
  '^IXIC': 'finnhub',
  '^DJI': 'finnhub',
  '^FTSE': 'finnhub',
  XAUUSD: 'finnhub',
  XAGUSD: 'finnhub',
  XPDUSD: 'finnhub',
};

export async function loadSymbolData(symbol: string, timeframe: TimeframeKey, limit = 300): Promise<CandleData[]> {
  const sourceKey = SYMBOL_DATA_SOURCES[symbol] || currentDataSource;
  const source = DATA_SOURCES[sourceKey];

  if (!source) {
    if (symbol.endsWith('USDT')) {
      return generateDummyData(limit, timeframe);
    }
    return generateDummyData(limit, timeframe);
  }

  try {
    return await source.fetchHistoricalData(symbol, timeframe, limit);
  } catch (error) {
    console.error(`Failed to load data for ${symbol}:`, error);
    return generateDummyData(limit, timeframe);
  }
}

export function generateDummyData(count: number, timeframe: TimeframeKey): CandleData[] {
  const data: CandleData[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  let baseTime = getBucketStartSec(nowSec, timeframe);
  const times: number[] = [baseTime];
  while (times.length < count) {
    baseTime = shiftBucketSec(baseTime, timeframe, -1);
    times.unshift(baseTime);
  }

  let price = 50000 + Math.random() * 10000;
  const vol = price * 0.01;
  for (let i = 0; i < times.length; i++) {
    const open = price;
    const close = price + (Math.random() - 0.49) * vol;
    data.push({
      time: times[i],
      open,
      close,
      high: Math.max(open, close) + Math.random() * vol * 0.4,
      low: Math.min(open, close) - Math.random() * vol * 0.4,
      volume: Math.floor(Math.random() * 1000) + 200,
    });
    price = close;
  }
  return data;
}

export function getSymbolPricePrecision(symbol: string, quoteCurrency: DisplayCurrency = 'USDT'): number {
  if (quoteCurrency === 'JPY' || quoteCurrency === 'KRW') return 0;
  if (quoteCurrency === 'EUR' || quoteCurrency === 'USD' || quoteCurrency === 'USDT') {
    const normalized = symbol.trim().toUpperCase().replace(/\.P$/, '');
    if (normalized === 'XRPUSDT') return 4;
    if (
      normalized === 'BTCUSDT' ||
      normalized === 'ETHUSDT' ||
      normalized === 'SOLUSDT' ||
      normalized === 'BNBUSDT' ||
      normalized === 'TRXUSDT'
    ) {
      return 2;
    }
    return 1;
  }
  if (quoteCurrency === 'BTC') return 6;
  const normalized = symbol.trim().toUpperCase().replace(/\.P$/, '');
  if (normalized === 'XRPUSDT') return 4;
  if (
    normalized === 'BTCUSDT' ||
    normalized === 'ETHUSDT' ||
    normalized === 'SOLUSDT' ||
    normalized === 'BNBUSDT' ||
    normalized === 'TRXUSDT'
  ) {
    return 2;
  }
  return 1;
}
