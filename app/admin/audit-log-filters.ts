export type AuditLogFilterPreset = {
  key: string;
  label: string;
  action: string;
  targetType: string;
};

export const AUDIT_LOG_FILTER_PRESETS: AuditLogFilterPreset[] = [
  { key: 'all', label: '전체', action: '', targetType: '' },
  { key: 'payment', label: '결제', action: 'payment', targetType: 'payment_request' },
  { key: 'subscription', label: '구독', action: 'subscription', targetType: 'subscription' },
  { key: 'support', label: '고객센터', action: 'support', targetType: 'support_thread' },
  { key: 'user', label: '회원', action: 'admin.user', targetType: 'user' },
];

export function getAuditLogFilterPreset(key: string): AuditLogFilterPreset {
  return AUDIT_LOG_FILTER_PRESETS.find((preset) => preset.key === key) ?? AUDIT_LOG_FILTER_PRESETS[0];
}
