import {
  USER_ROLES,
  type NotificationRecord,
  type PaymentRequestRecord,
  type SubscriptionRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, EmailOutboxRecord, ServiceUserRecord } from './repository.ts';
import { createAdminSupportThreadPath } from './support-links.ts';
import { notifyUserPushSubscriptions } from './web-push.ts';

const SUPPORT_REQUEST_ADMIN_EMAIL_TEMPLATE = 'support_request_admin';
const ADMIN_SUPPORT_REQUEST_SUBJECT_PREFIX = '[Chart Service] New support request';
const SUPPORT_EMAIL_SENDER = 'support@tradingcore.co';

export function notifyAdminsAboutSupportRequest(
  repository: ChartServiceRepository,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): void {
  for (const admin of getSupportAdminUsers(repository.listUsers())) {
    repository.saveNotification(createSupportRequestAdminNotification(repository, admin, input));
    repository.saveEmailOutboxRecord(createSupportRequestAdminEmail(repository, admin, input));
  }
}

export async function notifyAsyncAdminsAboutSupportRequest(
  repository: AsyncChartServiceRepository,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): Promise<void> {
  const admins = getSupportAdminUsers(await repository.listUsers());
  for (const admin of admins) {
    const notification = await createAsyncSupportRequestAdminNotification(repository, admin, input);
    await repository.saveNotification(notification);
    void notifyUserPushSubscriptions(repository, notification).catch(() => {});
    await repository.saveEmailOutboxRecord(await createAsyncSupportRequestAdminEmail(repository, admin, input));
  }
}

export async function notifyAsyncAdminsAboutSubscriptionApprovalRequest(
  repository: AsyncChartServiceRepository,
  input: {
    subscription: SubscriptionRecord;
    payment: PaymentRequestRecord;
    user: ServiceUserRecord;
    createdAt: string;
  },
): Promise<void> {
  const admins = getSupportAdminUsers(await repository.listUsers());
  for (const admin of admins) {
    const notification = await createAsyncSubscriptionApprovalAdminNotification(repository, admin, input);
    await repository.saveNotification(notification);
    void notifyUserPushSubscriptions(repository, notification).catch(() => {});
  }
}

function getSupportAdminUsers(users: ServiceUserRecord[]): ServiceUserRecord[] {
  return users.filter((user) => user.role === USER_ROLES.admin || user.role === USER_ROLES.superAdmin);
}

function createSupportRequestAdminNotification(
  repository: ChartServiceRepository,
  admin: ServiceUserRecord,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): NotificationRecord {
  return {
    id: repository.nextId('notification'),
    userId: admin.id,
    category: 'support_request',
    title: input.thread.title,
    body: formatSupportRequestSummary(input),
    linkUrl: createAdminSupportThreadPath(input.thread.id),
    readAt: null,
    archivedAt: null,
    createdAt: input.createdAt,
  };
}

async function createAsyncSupportRequestAdminNotification(
  repository: AsyncChartServiceRepository,
  admin: ServiceUserRecord,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): Promise<NotificationRecord> {
  return {
    id: await repository.nextId('notification'),
    userId: admin.id,
    category: 'support_request',
    title: input.thread.title,
    body: formatSupportRequestSummary(input),
    linkUrl: createAdminSupportThreadPath(input.thread.id),
    readAt: null,
    archivedAt: null,
    createdAt: input.createdAt,
  };
}

function createSupportRequestAdminEmail(
  repository: ChartServiceRepository,
  admin: ServiceUserRecord,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): EmailOutboxRecord {
  return {
    id: repository.nextId('email'),
    senderEmail: SUPPORT_EMAIL_SENDER,
    recipientEmail: admin.email,
    template: SUPPORT_REQUEST_ADMIN_EMAIL_TEMPLATE,
    subject: `${ADMIN_SUPPORT_REQUEST_SUBJECT_PREFIX}: ${input.thread.title}`,
    body: formatSupportRequestAdminEmailBody(input),
    status: 'queued',
    createdAt: input.createdAt,
    sentAt: null,
    lastError: null,
  };
}

async function createAsyncSupportRequestAdminEmail(
  repository: AsyncChartServiceRepository,
  admin: ServiceUserRecord,
  input: {
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
    author: ServiceUserRecord;
    createdAt: string;
  },
): Promise<EmailOutboxRecord> {
  return {
    id: await repository.nextId('email'),
    senderEmail: SUPPORT_EMAIL_SENDER,
    recipientEmail: admin.email,
    template: SUPPORT_REQUEST_ADMIN_EMAIL_TEMPLATE,
    subject: `${ADMIN_SUPPORT_REQUEST_SUBJECT_PREFIX}: ${input.thread.title}`,
    body: formatSupportRequestAdminEmailBody(input),
    status: 'queued',
    createdAt: input.createdAt,
    sentAt: null,
    lastError: null,
  };
}

async function createAsyncSubscriptionApprovalAdminNotification(
  repository: AsyncChartServiceRepository,
  admin: ServiceUserRecord,
  input: {
    subscription: SubscriptionRecord;
    payment: PaymentRequestRecord;
    user: ServiceUserRecord;
    createdAt: string;
  },
): Promise<NotificationRecord> {
  return {
    id: await repository.nextId('notification'),
    userId: admin.id,
    category: 'subscription',
    title: '구독승인 요청이 접수되었습니다',
    body: `${formatPaymentUserLabel(input)} 결제 확인이 완료되어 구독승인 처리가 필요합니다.`,
    linkUrl: createAdminSubscriptionPath(input.subscription.id),
    readAt: null,
    archivedAt: null,
    createdAt: input.createdAt,
  };
}

function formatSupportRequestSummary(input: {
  thread: SupportThreadRecord;
  message: SupportMessageRecord;
  author: ServiceUserRecord;
}): string {
  return `${input.author.email} opened a ${input.thread.category} request: ${input.message.body}`;
}

function formatSupportRequestAdminEmailBody(input: {
  thread: SupportThreadRecord;
  message: SupportMessageRecord;
  author: ServiceUserRecord;
}): string {
  return [
    'A new customer support request is waiting for an admin reply.',
    `Customer: ${input.author.name} <${input.author.email}>`,
    `Category: ${input.thread.category}`,
    `Visibility: ${input.thread.visibility}`,
    `Title: ${input.thread.title}`,
    `Message: ${input.message.body}`,
    `Reply link: ${createAdminSupportThreadPath(input.thread.id)}`,
  ].join('\n');
}

function createAdminSubscriptionPath(subscriptionId: string): string {
  return `/admin#admin-subscription-${encodeURIComponent(subscriptionId)}`;
}

function formatPaymentUserLabel(input: { payment: PaymentRequestRecord; user: ServiceUserRecord }): string {
  const depositorName = input.payment.depositorName?.trim();
  const displayName = depositorName || input.user.name;
  return `${displayName} <${input.user.email}>`;
}
