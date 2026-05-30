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
  if (input.category === 'trial' && input.actor.role !== USER_ROLES.member) {
    throw new Error('Trial request requires a member account');
  }
  if (!input.title.trim()) throw new Error('Support title required');
  if (!input.body.trim()) throw new Error('Support message required');

  const thread: SupportThreadRecord = {
    id: repository.nextId('support'),
    authorUserId: input.actor.id,
    category: input.category,
    title: input.title.trim(),
    visibility: getSupportThreadVisibility(input.category, input.visibility),
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

function getSupportThreadVisibility(
  category: SupportCategory,
  requestedVisibility: SupportVisibility,
): SupportVisibility {
  return category === 'deposit' ? 'private' : requestedVisibility;
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
    .sort((a, b) => (
      new Date(b.thread.createdAt).getTime() - new Date(a.thread.createdAt).getTime() ||
      new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime()
    ));
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

export function updateSupportThread(
  repository: ChartServiceRepository,
  input: { actor: Actor; threadId: string; title: string; body: string; updatedAt: string },
): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  const thread = requireSupportThread(repository, input.threadId);
  assertCanManageSupportThread(input.actor, thread, 'update');
  if (!input.title.trim()) throw new Error('Support title required');
  if (!input.body.trim()) throw new Error('Support message required');

  const message = requireEditableSupportThreadMessage(repository, thread);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    title: input.title.trim(),
    updatedAt: input.updatedAt,
  };
  const updatedMessage: SupportMessageRecord = {
    ...message,
    body: input.body.trim(),
  };

  repository.saveSupportThread(updatedThread);
  repository.saveSupportMessage(updatedMessage);
  if (isAdminActor(input.actor)) {
    repository.appendAuditLog(createAuditLogDraft({
      actor: input.actor,
      action: 'support.thread.updated',
      targetType: 'support_thread',
      targetId: thread.id,
      beforeJson: { thread, message },
      afterJson: { thread: updatedThread, message: updatedMessage },
    }));
  }

  return { thread: updatedThread, message: updatedMessage };
}

export function deleteSupportThread(
  repository: ChartServiceRepository,
  input: { actor: Actor; threadId: string; deletedAt: string },
): { thread: SupportThreadRecord; messages: SupportMessageRecord[]; detachedPaymentIds: string[] } {
  const thread = requireSupportThread(repository, input.threadId);
  assertCanManageSupportThread(input.actor, thread, 'delete');
  const messages = repository.listSupportMessagesByThreadId(thread.id);
  const detachedPaymentIds = detachPaymentsFromSupportThread(repository, thread.id, input.deletedAt);

  if (isAdminActor(input.actor)) {
    repository.appendAuditLog(createAuditLogDraft({
      actor: input.actor,
      action: 'support.thread.deleted',
      targetType: 'support_thread',
      targetId: thread.id,
      beforeJson: { thread, messages, detachedPaymentIds },
      afterJson: {
        thread: null,
        deletedAt: input.deletedAt,
        detachedPaymentIds,
      },
    }));
  }

  repository.deleteSupportMessagesByThreadId(thread.id);
  repository.deleteSupportThread(thread.id);
  return { thread, messages, detachedPaymentIds };
}

export function updateSupportMessageAsAdmin(
  repository: ChartServiceRepository,
  input: { admin: Actor; messageId: string; body: string; updatedAt: string },
): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  assertAdminActor(input.admin);
  const message = requireSupportMessage(repository, input.messageId);
  if (!message.isAdminReply) throw new Error('Only admin replies can be updated');
  if (!input.body.trim()) throw new Error('Support reply required');
  const thread = requireSupportThread(repository, message.threadId);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    updatedAt: input.updatedAt,
  };
  const updatedMessage: SupportMessageRecord = {
    ...message,
    body: input.body.trim(),
  };

  repository.saveSupportThread(updatedThread);
  repository.saveSupportMessage(updatedMessage);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.updated',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread, message },
    afterJson: { thread: updatedThread, message: updatedMessage },
  }));

  return { thread: updatedThread, message: updatedMessage };
}

export function deleteSupportMessageAsAdmin(
  repository: ChartServiceRepository,
  input: { admin: Actor; messageId: string; deletedAt: string },
): { thread: SupportThreadRecord; message: SupportMessageRecord } {
  assertAdminActor(input.admin);
  const message = requireSupportMessage(repository, input.messageId);
  if (!message.isAdminReply) throw new Error('Only admin replies can be deleted');
  const thread = requireSupportThread(repository, message.threadId);
  const remainingMessages = repository
    .listSupportMessagesByThreadId(thread.id)
    .filter((item) => item.id !== message.id);
  const updatedThread: SupportThreadRecord = {
    ...thread,
    status: remainingMessages.some((item) => item.isAdminReply) ? 'answered' : 'waiting',
    updatedAt: input.deletedAt,
  };

  repository.deleteSupportMessage(message.id);
  repository.saveSupportThread(updatedThread);
  repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'support.reply.deleted',
    targetType: 'support_thread',
    targetId: thread.id,
    beforeJson: { thread, message },
    afterJson: { thread: updatedThread },
  }));

  return { thread: updatedThread, message };
}

function canViewSupportThread(thread: SupportThreadRecord, actor: Actor | null): boolean {
  if (thread.visibility === 'public') return true;
  if (!actor) return false;
  if (actor.id === thread.authorUserId) return true;
  return actor.role === USER_ROLES.admin || actor.role === USER_ROLES.superAdmin;
}

function requireSupportThread(repository: ChartServiceRepository, threadId: string): SupportThreadRecord {
  const thread = repository.getSupportThreadById(threadId);
  if (!thread) throw new Error(`Support thread not found: ${threadId}`);
  return thread;
}

function requireSupportMessage(repository: ChartServiceRepository, messageId: string): SupportMessageRecord {
  const message = repository.getSupportMessageById(messageId);
  if (!message) throw new Error(`Support message not found: ${messageId}`);
  return message;
}

function requireEditableSupportThreadMessage(
  repository: ChartServiceRepository,
  thread: SupportThreadRecord,
): SupportMessageRecord {
  const messages = repository.listSupportMessagesByThreadId(thread.id);
  const message = messages.find((item) => item.authorUserId === thread.authorUserId)
    ?? messages.find((item) => !item.isAdminReply);
  if (!message) throw new Error(`Support editable message not found: ${thread.id}`);
  return message;
}

function assertCanManageSupportThread(actor: Actor, thread: SupportThreadRecord, operation: 'update' | 'delete'): void {
  if (actor.id === thread.authorUserId || isAdminActor(actor)) return;
  throw new Error(`Support thread ${operation} not allowed`);
}

function isAdminActor(actor: Actor): boolean {
  return actor.role === USER_ROLES.admin || actor.role === USER_ROLES.superAdmin;
}

function detachPaymentsFromSupportThread(
  repository: ChartServiceRepository,
  threadId: string,
  updatedAt: string,
): string[] {
  const linkedPayments = repository.listPayments().filter((payment) => payment.supportThreadId === threadId);
  linkedPayments.forEach((payment) => repository.savePayment({
    ...payment,
    supportThreadId: null,
    updatedAt,
  }));
  return linkedPayments.map((payment) => payment.id);
}
