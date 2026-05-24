import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIT_LOG_FILTER_PRESETS,
  getAuditLogFilterPreset,
} from '../app/admin/audit-log-filters.ts';

test('audit log filter presets cover common admin investigation areas', () => {
  assert.deepEqual(AUDIT_LOG_FILTER_PRESETS.map((preset) => preset.label), [
    '전체',
    '결제',
    '구독',
    '고객센터',
    '회원',
  ]);

  assert.deepEqual(getAuditLogFilterPreset('payment'), {
    key: 'payment',
    label: '결제',
    action: 'payment',
    targetType: 'payment_request',
  });
  assert.deepEqual(getAuditLogFilterPreset('support'), {
    key: 'support',
    label: '고객센터',
    action: 'support',
    targetType: 'support_thread',
  });
});

test('unknown audit log filter preset falls back to the all filter', () => {
  assert.deepEqual(getAuditLogFilterPreset('missing'), {
    key: 'all',
    label: '전체',
    action: '',
    targetType: '',
  });
});
