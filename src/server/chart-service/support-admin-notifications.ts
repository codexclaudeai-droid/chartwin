import {
  USER_ROLES,
  type NotificationRecord,
  type SupportMessageRecord,
  type SupportThreadRecord,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, EmailOutboxRecord, ServiceUserRecord } from './repository.ts';
import { createAdminSupportThreadPath } from './support-links.ts';

const SUPPORT_REQUEST_ADMIN_EMAIL_TEMPLATE = 'support_request_admin';
const ADMIN_SUPPORT_REQUEST_SUBJECT_PREFIX = '[Chart Service] New support request';

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
    await repository.saveNotification(await createAsyncSupportRequestAdminNotification(repository, admin, input));
    await repository.saveEmailOutboxRecord(await createAsyncSupportRequestAdminEmail(repository, admin, input));
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
