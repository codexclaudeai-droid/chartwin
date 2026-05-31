const ADMIN_DISPLAY_ID_MIN_DIGITS = 4;

export type AdminDisplayIdLabel = '결제' | '구독' | '문의' | '회원' | '작업';

export function formatAdminDisplayId(label: AdminDisplayIdLabel, sequence: number): string {
  const safeSequence = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 0;
  return `${label}-${String(safeSequence).padStart(ADMIN_DISPLAY_ID_MIN_DIGITS, '0')}`;
}

export function getAdminDisplaySequence<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): number {
  const index = items.findIndex(predicate);
  return index >= 0 ? items.length - index : 0;
}
