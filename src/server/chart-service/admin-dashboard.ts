import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository } from './repository.ts';
import { listAdminPaymentQueue, listAdminSubscriptionQueue } from './service.ts';

export type AdminDashboardSummary = {
  payments: {
    totalCount: number;
    queueCount: number;
    pendingCount: number;
    confirmedCount: number;
    refundedCount: number;
    rejectedCount: number;
  };
  subscriptions: {
    totalCount: number;
    queueCount: number;
    activeCount: number;
    trialActiveCount: number;
    paymentPendingCount: number;
    cancelRequestedCount: number;
    refundRequestedCount: number;
  };
  support: {
    totalCount: number;
    waitingCount: number;
    answeredCount: number;
    privateCount: number;
  };
  users: {
    totalCount: number;
    activeCount: number;
    suspendedCount: number;
    adminCount: number;
  };
  audit: {
    totalCount: number;
  };
};

export function getAdminDashboardSummary(repository: ChartServiceRepository): AdminDashboardSummary {
  const payments = repository.listPayments();
  const subscriptions = repository.listSubscriptions();
  const supportThreads = repository.listSupportThreads();
  const users = repository.listUsers();

  return {
    users: {
      totalCount: users.length,
      activeCount: users.filter((user) => user.accountStatus === USER_ACCOUNT_STATUSES.active).length,
      suspendedCount: users.filter((user) => user.accountStatus === USER_ACCOUNT_STATUSES.suspended).length,
      adminCount: users.filter((user) => user.role === USER_ROLES.admin || user.role === USER_ROLES.superAdmin).length,
    },
    payments: {
      totalCount: payments.length,
      queueCount: listAdminPaymentQueue(repository).length,
      pendingCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.pending).length,
      confirmedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.confirmed).length,
      refundedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.refunded).length,
      rejectedCount: payments.filter((payment) => payment.status === PAYMENT_STATUSES.rejected).length,
    },
    subscriptions: {
      totalCount: subscriptions.length,
      queueCount: listAdminSubscriptionQueue(repository).length,
      activeCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.active).length,
      trialActiveCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.trialActive).length,
      paymentPendingCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.paymentPending).length,
      cancelRequestedCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.cancelRequested).length,
      refundRequestedCount: subscriptions.filter((subscription) => subscription.status === SUBSCRIPTION_STATUSES.refundRequested).length,
    },
    support: {
      totalCount: supportThreads.length,
      waitingCount: supportThreads.filter((thread) => thread.status === 'waiting').length,
      answeredCount: supportThreads.filter((thread) => thread.status === 'answered').length,
      privateCount: supportThreads.filter((thread) => thread.visibility === 'private').length,
    },
    audit: {
      totalCount: repository.listAuditLogs().length,
    },
  };
}
