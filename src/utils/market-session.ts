import type { DisplayCurrency } from '../types/market';

const KRW_INDEX_SYMBOLS = new Set(['KOSPI', 'KOSPI200', 'KOSDAQ']);
const USD_INDEX_SYMBOLS = new Set(['NQ1!', 'NAS100', 'NDX', 'NASDAQ', 'IXIC', 'SPX500', 'HKG33', 'HSI', '^GSPC', '^IXIC', '^DJI', '^FTSE']);
const USD_COMMODITY_SYMBOLS = new Set(['XAUUSD', 'XAGUSD']);

export function getChicagoWeekdayHourMinute(now: Date): { weekday: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { weekday, hour, minute };
}

export function isCmeEquityFuturesOpen(now: Date): boolean {
  const { weekday, hour, minute } = getChicagoWeekdayHourMinute(now);
  const minuteOfDay = hour * 60 + minute;
  const maintenanceStart = 16 * 60;
  const maintenanceEnd = 17 * 60;
  const isMaintenance = minuteOfDay >= maintenanceStart && minuteOfDay < maintenanceEnd;

  if (weekday === 'Sat') return false;
  if (weekday === 'Sun') return minuteOfDay >= maintenanceEnd;
  if (weekday === 'Fri') return minuteOfDay < maintenanceStart;
  return !isMaintenance;
}

function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function getCmeEquityFuturesSessionInfo(now: Date): {
  isOpen: boolean;
  title: string;
  message: string;
  progress: number;
  leftLabel: string;
  rightLabel: string;
  timezoneLabel: string;
} {
  const { weekday, hour, minute } = getChicagoWeekdayHourMinute(now);
  const minuteOfDay = hour * 60 + minute;
  const maintenanceStart = 16 * 60;
  const maintenanceEnd = 17 * 60;
  const weekdayLabel = ({ Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' } as Record<string, string>)[weekday] ?? weekday;
  const timezoneLabel = '거래소 시간대: 시카고 (UTC-5, 서머타임 기준)';
  const isOpen = isCmeEquityFuturesOpen(now);

  if (isOpen) {
    let elapsed = 0;
    let remaining = 0;
    if (weekday === 'Sun') {
      elapsed = minuteOfDay - maintenanceEnd;
      remaining = (24 * 60 - minuteOfDay) + maintenanceStart;
    } else if (minuteOfDay < maintenanceStart) {
      elapsed = (24 * 60 - maintenanceEnd) + minuteOfDay;
      remaining = maintenanceStart - minuteOfDay;
    } else {
      elapsed = minuteOfDay - maintenanceEnd;
      remaining = (24 * 60 - minuteOfDay) + maintenanceStart;
    }
    const total = Math.max(1, elapsed + remaining);
    return {
      isOpen: true,
      title: '마켓 오픈',
      message: `마켓이 오픈되었습니다. ${formatDurationMinutes(remaining)} 후 16:00에 마감합니다.`,
      progress: Math.max(0, Math.min(1, elapsed / total)),
      leftLabel: weekdayLabel,
      rightLabel: '16:00',
      timezoneLabel,
    };
  }

  if (weekday !== 'Sat' && weekday !== 'Sun' && minuteOfDay >= maintenanceStart && minuteOfDay < maintenanceEnd) {
    const elapsed = minuteOfDay - maintenanceStart;
    const remaining = maintenanceEnd - minuteOfDay;
    return {
      isOpen: false,
      title: '마켓 마감',
      message: `정산/점검 시간입니다. ${formatDurationMinutes(remaining)} 후 17:00에 다시 열립니다.`,
      progress: Math.max(0, Math.min(1, elapsed / 60)),
      leftLabel: weekdayLabel,
      rightLabel: '17:00',
      timezoneLabel,
    };
  }

  let remainingToOpen = 0;
  if (weekday === 'Fri') remainingToOpen = (24 * 60 - minuteOfDay) + 24 * 60 + maintenanceEnd;
  else if (weekday === 'Sat') remainingToOpen = (24 * 60 - minuteOfDay) + maintenanceEnd;
  else if (weekday === 'Sun') remainingToOpen = maintenanceEnd - minuteOfDay;
  else remainingToOpen = maintenanceEnd - minuteOfDay;

  return {
    isOpen: false,
    title: '마켓 마감',
    message: `마켓이 마감되었습니다. ${formatDurationMinutes(remainingToOpen)} 후 17:00에 다시 열립니다.`,
    progress: 0,
    leftLabel: weekdayLabel,
    rightLabel: '17:00',
    timezoneLabel,
  };
}

export function getSeoulWeekdayHourMinute(now: Date): { weekday: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { weekday, hour, minute };
}

export function isKrxEquityMarketOpen(now: Date): boolean {
  const { weekday, hour, minute } = getSeoulWeekdayHourMinute(now);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const minuteOfDay = hour * 60 + minute;
  return minuteOfDay >= 9 * 60 && minuteOfDay < 15 * 60 + 30;
}

export function isKrxIndexLikeSymbol(symbol: string): boolean {
  const normalized = canonicalizeUiSymbol(symbol).replace(/\.P$/, '');
  return KRW_INDEX_SYMBOLS.has(normalized);
}

export function isNasdaqFuturesLikeSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  return upper === 'NAS100' || upper === 'NQ1!' || upper === 'NQ';
}

export function canonicalizeUiSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === 'NAS100' || upper === 'NQ') return 'NQ1!';
  if (upper === '^IXIC') return 'NASDAQ';
  return upper;
}

export function getDefaultQuoteCurrencyForSymbol(symbol: string): DisplayCurrency {
  const normalized = canonicalizeUiSymbol(symbol).replace(/\.P$/, '');
  if (KRW_INDEX_SYMBOLS.has(normalized)) return 'KRW';
  if (USD_INDEX_SYMBOLS.has(normalized) || USD_COMMODITY_SYMBOLS.has(normalized)) return 'USD';
  return 'USDT';
}
