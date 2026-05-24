import type { AuditLogDraft } from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository, PublicServiceUserRecord } from './repository.ts';
import { redactAuditLogSensitiveFields, toPublicServiceUserRecord } from './user-serialization.ts';

export type AdminAuditLogEntry = {
  sequence: number;
  log: AuditLogDraft;
  actor: PublicServiceUserRecord | null;
};

export type AdminAuditLogFilter = {
  action?: string;
  targetType?: string;
};

export function getAdminAuditLogEntries(
  repository: ChartServiceRepository,
  filter: AdminAuditLogFilter = {},
): AdminAuditLogEntry[] {
  const actionQuery = filter.action?.trim().toLowerCase() ?? '';
  const targetType = filter.targetType?.trim().toLowerCase() ?? '';

  return repository
    .listAuditLogs()
    .map((log, index) => ({
      sequence: index + 1,
      log: redactAuditLogSensitiveFields(log),
      actor: toPublicActor(repository.getUserById(log.actorAdminId)),
    }))
    .filter((entry) => !actionQuery || entry.log.action.toLowerCase().includes(actionQuery))
    .filter((entry) => !targetType || entry.log.targetType.toLowerCase() === targetType)
    .reverse();
}

function toPublicActor(user: ReturnType<ChartServiceRepository['getUserById']>): PublicServiceUserRecord | null {
  return user ? toPublicServiceUserRecord(user) : null;
}
