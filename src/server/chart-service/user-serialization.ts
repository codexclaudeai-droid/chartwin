import type { AuditLogDraft } from '../../domain/chart-service/index.ts';
import type { PublicServiceUserRecord, ServiceUserRecord } from './repository.ts';

export function toPublicServiceUserRecord(user: ServiceUserRecord): PublicServiceUserRecord {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export function redactAuditLogSensitiveFields(log: AuditLogDraft): AuditLogDraft {
  return {
    ...log,
    beforeJson: redactSensitiveJson(log.beforeJson),
    afterJson: redactSensitiveJson(log.afterJson),
  };
}

function redactSensitiveJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveJson(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'passwordHash')
        .map(([key, item]) => [key, redactSensitiveJson(item)]),
    );
  }

  return value;
}
