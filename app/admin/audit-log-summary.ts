import {
  formatPaymentStatusLabel,
  formatSubscriptionStatusLabel,
  formatSupportStatusLabel,
  formatUserAccountStatusLabel,
  formatUserRoleLabel,
} from './admin-status-labels.ts';

type AuditLogSummaryInput = {
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: unknown;
  afterJson: unknown;
};

type JsonRecord = Record<string, unknown>;

export function formatAuditLogSummary(entry: AuditLogSummaryInput): string[] {
  const summary: string[] = [];

  addChange(summary, '결제 상태', getString(entry.beforeJson, ['payment', 'status']), getString(entry.afterJson, ['payment', 'status']), formatPaymentStatusLabel);
  addChange(summary, '구독 상태', getString(entry.beforeJson, ['subscription', 'status']), getString(entry.afterJson, ['subscription', 'status']), formatSubscriptionStatusLabel);
  addChange(summary, '회원 역할', getString(entry.beforeJson, ['user', 'role']), getString(entry.afterJson, ['user', 'role']), formatUserRoleLabel);
  addChange(summary, '계정 상태', getString(entry.beforeJson, ['user', 'accountStatus']), getString(entry.afterJson, ['user', 'accountStatus']), formatUserAccountStatusLabel);
  addChange(summary, '문의 상태', getString(entry.beforeJson, ['thread', 'status']), getString(entry.afterJson, ['thread', 'status']), formatSupportStatusLabel);

  const adminNote = firstText(
    getString(entry.afterJson, ['adminNote']),
    getString(entry.afterJson, ['payment', 'adminNote']),
  );
  if (adminNote) summary.push(`관리자 메모: ${adminNote}`);

  const reason = getString(entry.afterJson, ['reason']);
  if (reason) summary.push(`처리 사유: ${reason}`);

  const replyBody = getString(entry.afterJson, ['message', 'body']);
  if (entry.action === 'support.reply.created' && replyBody) {
    summary.push(`답변 내용: ${replyBody}`);
  }

  return summary.length > 0 ? summary : ['상세 변경은 원본 JSON에서 확인하세요.'];
}

function addChange(
  summary: string[],
  label: string,
  beforeValue: string | null,
  afterValue: string | null,
  formatValue: (value: string) => string = (value) => value,
): void {
  if (!beforeValue || !afterValue || beforeValue === afterValue) return;
  summary.push(`${label}: ${formatValue(beforeValue)} -> ${formatValue(afterValue)}`);
}

function firstText(...values: Array<string | null>): string | null {
  return values.find((value) => typeof value === 'string' && value.trim()) ?? null;
}

function getString(value: unknown, path: string[]): string | null {
  let cursor = value;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
