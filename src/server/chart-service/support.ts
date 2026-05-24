import {
  assertAdminActor,
  createAuditLogDraft,
  USER_ROLES,
  type Actor,
  type SupportCategory,
  type SupportMessageRecord,
  type SupportThreadRecord,
  type SupportVisibility,
} from '../../domain/chart-service/index.ts';
import type { ChartServiceRepository, ServiceUserRecord } from './repository.ts';
import { createUserNotification } from './notifications.ts';
import { createSupportThreadLink } from './notification-links.ts';
import { notifyAdminsAboutSupportRequest } from './support-admin-notifications.ts';

export type SupportThreadListItem = {
  thread: SupportThreadRecord;
  author: ServiceUserRecord | null;
  messages: SupportMessageRecord[];
};

export function createSupportThread(
  repository: ChartServiceRepository,
  input: {
    actor: Actor;
    category: SupportCategory;
    title: string;
    body: string;
    visibility: SupportVisibility;
    createdAt: string;
  },
): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  const author = repository.getUserById(input.actor.id);
  if (!author) throw new Error(`User not found: ${input.actor.id}`);
  if (!input.title.trim()) throw new Error('Support title required');
  if (!input.body.trim()) throw new Error('Support message required');

  const thread: SupportThreadRecord = {
    id: repository.nextId('support'),
    authorUserId: input.actor.id,
    category: input.category,
    title: input.title.trim(),
    visibility: input.visibility,
    status: 'waiting',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  const message: SupportMessageRecord = {
    id: repository.nextId('support_msg'),
    threadId: thread.id,
    authorUserId: input.actor.id,
    body: input.body.trim(),
    isAdminReply: false,
    createdAt: input.createdAt,
  };

  repository.saveSupportThread(thread);
  repository.saveSupportMessage(message);
  notifyAdminsAboutSupportRequest(repository, {
    thread,
    message,
    author,
    createdAt: input.createdAt,
  });
  return { thread, message };
}

export function listVisibleSupportThreads(
  repository: ChartServiceRepository,
  input: { actor: Actor | null },
): SupportThreadListItem[] {
  return repository
    .listSupportThreads()
    .filter((thread) => canViewSupportThread(thread, input.actor))
    .map((thread) => ({
      thread,
      author: repository.getUserById(thread.authorUserId),
      messages: repository.listSupportMessagesByThreadId(thread.id),
    }))
    .sort((a, b) => new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime());
}

export function replyToSupportThreadAsAdmin(
  repository: ChartServiceRepository,
  input: { admin: Actor; threadId: string; body: string; createdAt: string },
): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  assertAdminActor(input.admin);
  const thread = repository.getSupportThreadById(input.threadId);
  if (!thread) throw new Error(`Support thread not found: ${input.threadId}`);
  if (!input.body.trim()) throw new Error('Support reply required');

  const answeredThread: SupportThreadRecord = {
    ...thread,
    status: 'answered',
    updatedAt: input.createdAt,
  };
  const message: SupportMessageRecord = {
    id: repository.nextId('support_msg'),
    threadId: thread.id,
    authorUserId: input.admin.id,
    body: input.body.trim(),
    isAdminReply: true,
    createdAt: input.createdAt,
  };

  repository.saveSupportThread(answeredThread);
  repository.saveSupportMessage(message);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.created',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread },
    afterJson: { thread: answeredThread, message },
  }));
  createUserNotification(repository, {
    userId: thread.authorUserId,
    category: 'support_reply',
    title: '고객센터 답변이 등록되었습니다',
    body: input.body.trim(),
    linkUrl: createSupportThreadLink(thread.id),
    createdAt: input.createdAt,
  });

  return { thread: answeredThread, message };
}

function canViewSupportThread(thread: SupportThreadRecord, actor: Actor | null): boolean {
  if (thread.visibility === 'public') return true;
  if (!actor) return false;
  if (actor.id === thread.authorUserId) return true;
  return actor.role === USER_ROLES.admin || actor.role === USER_ROLES.superAdmin;
}
