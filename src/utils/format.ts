import { formatWithComma } from '../chart/axis-utils';

export function formatKUnit(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '-';
  const k = value / 1000;
  const absK = Math.abs(k);
  const digits = absK >= 100 ? 0 : absK >= 10 ? 1 : maxFractionDigits;
  return `${k.toFixed(digits)}K`;
}

export function formatThousandAdaptive(value: number, fractionDigitsBelow1000 = 0): string {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) < 1000) return formatWithComma(value, fractionDigitsBelow1000);
  return formatKUnit(value);
}
