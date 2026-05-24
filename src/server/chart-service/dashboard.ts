import type {
  Actor,
  PaymentRequestRecord,
  SubscriptionRecord,
} from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository, PublicServiceUserRecord, ServiceUserRecord } from './repository.ts';
import { getChartAccessSnapshot, type ChartAccessSnapshot } from './service.ts';
import { getNotificationSummaryForUser } from './notifications.ts';
import { listVisibleSupportThreads } from './support.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export type DashboardUserSummary = PublicServiceUserRecord;

export type UserDashboardSummary = {
  user: DashboardUserSummary;
  access: ChartAccessSnapshot;
  subscription: SubscriptionRecord | null;
  payments: PaymentRequestRecord[];
  notifications: {
    totalCount: number;
    unreadCount: number;
  };
  support: {
    visibleThreadCount: number;
    waitingThreadCount: number;
  };
};

export function toDashboardUserSummary(user: ServiceUserRecord): DashboardUserSummary {
  return toPublicServiceUserRecord(user);
}

export function getUserDashboardSummary(
  repository: ChartServiceRepository,
  input: { actor: Actor },
): UserDashboardSummary {
  const user = repository.getUserById(input.actor.id);
  if (!user) throw new Error(`User not found: ${input.actor.id}`);

  const visibleSupportThreads = listVisibleSupportThreads(repository, { actor: input.actor });
  const payments = repository
    .listPayments()
    .filter((payment) => payment.userId === input.actor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    user: toDashboardUserSummary(user),
    access: getChartAccessSnapshot(repository, input.actor.id),
    subscription: repository.getSubscriptionByUserId(input.actor.id),
    payments,
    notifications: getNotificationSummaryForUser(repository, input),
    support: {
      visibleThreadCount: visibleSupportThreads.length,
      waitingThreadCount: visibleSupportThreads.filter((item) => item.thread.status === 'waiting').length,
    },
  };
}
