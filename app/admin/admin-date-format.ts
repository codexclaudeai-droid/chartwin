export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatAdminDateTimeParts(value: string): [string, string] {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ['-', '-'];
  return [
    new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    }).format(date),
    new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  ];
}
