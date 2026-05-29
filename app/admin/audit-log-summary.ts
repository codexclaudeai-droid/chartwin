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
  addChange(summary, '로그인 이메일', getString(entry.beforeJson, ['user', 'email']), getString(entry.afterJson, ['user', 'email']));
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

  if (entry.action === 'admin.web_info.settings.update') {
    addWebInfoSettingsSummary(summary, entry.beforeJson, entry.afterJson);
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

function addWebInfoSettingsSummary(summary: string[], beforeJson: unknown, afterJson: unknown): void {
  const beforeTerms = getString(beforeJson, ['settings', 'termsContent']);
  const afterTerms = getString(afterJson, ['settings', 'termsContent']);
  if (beforeTerms && afterTerms && beforeTerms !== afterTerms) {
    summary.push('가입약관 내용 변경');
  }

  const beforePrivacy = getString(beforeJson, ['settings', 'privacyContent']);
  const afterPrivacy = getString(afterJson, ['settings', 'privacyContent']);
  if (beforePrivacy && afterPrivacy && beforePrivacy !== afterPrivacy) {
    summary.push('개인정보보호정책 내용 변경');
  }

  const changedPlanServiceCount = countChangedPlanServices(
    getRecord(beforeJson, ['settings', 'planServices']),
    getRecord(afterJson, ['settings', 'planServices']),
  );
  if (changedPlanServiceCount > 0) {
    summary.push(`플랜 제공서비스 변경: ${changedPlanServiceCount}개 플랜`);
  }
}

function countChangedPlanServices(beforeServices: JsonRecord | null, afterServices: JsonRecord | null): number {
  if (!beforeServices || !afterServices) return 0;
  const planIds = new Set([...Object.keys(beforeServices), ...Object.keys(afterServices)]);
  return [...planIds].filter((planId) => (
    JSON.stringify(beforeServices[planId] ?? null) !== JSON.stringify(afterServices[planId] ?? null)
  )).length;
}

function getString(value: unknown, path: string[]): string | null {
  let cursor = value;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : null;
}

function getRecord(value: unknown, path: string[]): JsonRecord | null {
  let cursor = value;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  return isRecord(cursor) ? cursor : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
