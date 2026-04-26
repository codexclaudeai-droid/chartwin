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

export function isNasdaqFuturesLikeSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  return upper === 'NAS100' || upper === 'NQ1!' || upper === 'NQ';
}

export function canonicalizeUiSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === 'NAS100' || upper === 'NQ') return 'NQ1!';
  return upper;
}
