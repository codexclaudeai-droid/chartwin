export type TimeframeKey = '1s' | '1m' | '3m' | '5m' | '10m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d' | '1w' | '1M';

export const TIMEFRAME_SECONDS: Record<TimeframeKey, number> = {
  '1s': 1,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '10m': 600,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
};

export type TimezoneOption = { id: string; label: string; display: string; category: string };

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'local', label: 'local', display: '표준시', category: '표준시' },
  // Asia/Seoul is intentionally omitted to avoid duplicate with UTC+9.
  { id: 'America/New_York', label: 'America/New_York', display: 'America/New_York (뉴욕)', category: '거래소' },
  { id: 'Europe/London', label: 'Europe/London', display: 'Europe/London (런던)', category: '거래소' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo', display: 'Asia/Tokyo (도쿄)', category: '거래소' },
];

function buildUtcOffsetOptions(): TimezoneOption[] {
  const cityByOffset: Record<string, string> = {
    'UTC-12': '베이커섬',
    'UTC-11': '파고파고',
    'UTC-10': '호놀룰루',
    'UTC-9': '앵커리지',
    'UTC-8': '로스앤젤레스',
    'UTC-7': '덴버',
    'UTC-6': '시카고',
    'UTC-5': '뉴욕, 보고타',
    'UTC-4': '카라카스, 산티아고',
    UTC: '레이캬비크',
    'UTC+1': '런던, 리스본',
    'UTC+2': '파리, 베를린, 카이로',
    'UTC+3': '모스크바, 이스탄불, 나이로비',
    'UTC+4': '두바이',
    'UTC+5': '카라치, 타슈켄트',
    'UTC+5:30': '콜카타',
    'UTC+5:45': '카트만두',
    'UTC+6': '다카',
    'UTC+6:30': '양곤',
    'UTC+7': '방콕, 자카르타',
    'UTC+8': '싱가포르, 상하이, 타이베이',
    'UTC+9': '서울, 도쿄',
    'UTC+9:30': '애들레이드',
    'UTC+10': '시드니, 브리즈번',
    'UTC+11': '누메아',
    'UTC+12': '오클랜드',
    'UTC+12:45': '채텀제도',
    'UTC+13': '누쿠알로파',
    'UTC+14': '키리티마티',
  };

  const order = [
    'UTC-12', 'UTC-11', 'UTC-10', 'UTC-9', 'UTC-8', 'UTC-7', 'UTC-6', 'UTC-5', 'UTC-4',
    'UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+4', 'UTC+5', 'UTC+5:30', 'UTC+5:45', 'UTC+6',
    'UTC+6:30', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC+9:30', 'UTC+10', 'UTC+11', 'UTC+12',
    'UTC+12:45', 'UTC+13', 'UTC+14',
  ];

  return order.map((id) => ({
    id,
    label: id,
    display: `(${id}) ${cityByOffset[id] ?? ''}`.trim(),
    category: 'UTC 오프셋',
  }));
}

export const UTC_OFFSET_OPTIONS = buildUtcOffsetOptions();

export function formatTimezoneLabel(timezone: string): string {
  if (timezone === 'Asia/Seoul') return 'UTC+9';
  if (timezone === 'local') return '표준시';
  return timezone;
}

function parseUtcOffset(timezone: string): number | null {
  if (timezone === 'UTC') return 0;
  const m = timezone.match(/^UTC([+-]\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1][0] === '-' ? -1 : 1;
  const hours = Number(m[1].slice(1));
  const minutes = m[2] ? Number(m[2]) : 0;
  return sign * (hours + minutes / 60);
}

export function formatDateWithTimezone(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  const normalizedTz = timezone === 'Asia/Seoul' ? 'UTC+9' : timezone;

  if (normalizedTz === 'local') {
    return new Intl.DateTimeFormat('ko-KR', options).format(date);
  }

  const offset = parseUtcOffset(normalizedTz);
  if (offset !== null) {
    const adjusted = new Date(date.getTime() + offset * 3600_000);
    // Format against UTC after shifting to avoid applying the local timezone offset twice.
    return new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: 'UTC' }).format(adjusted);
  }

  return new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: normalizedTz }).format(date);
}
