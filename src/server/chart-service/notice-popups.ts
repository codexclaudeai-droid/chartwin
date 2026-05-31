import { assertAdminActor, type Actor } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, NoticePopupRecord } from './repository.ts';

type NoticePopupInput = {
  id?: string;
  title: string;
  bodyHtml: string;
  isActive: boolean;
  sortOrder: number;
  startAt?: string | null;
  endAt?: string | null;
};

type NoticePopupMutationInput = {
  admin: Actor;
  popup: NoticePopupInput;
  updatedAt: string;
};

type NoticePopupDeleteInput = {
  admin: Actor;
  popupId: string;
};

export function listPublishedNoticePopups(
  repository: Pick<ChartServiceRepository, 'listNoticePopups'>,
  nowIso = new Date().toISOString(),
): NoticePopupRecord[] {
  return sortNoticePopups(repository.listNoticePopups())
    .filter((popup) => popup.isActive)
    .filter((popup) => isNoticePopupWithinSchedule(popup, nowIso))
    .map((popup) => structuredClone(popup));
}

export async function listAsyncPublishedNoticePopups(
  repository: Pick<AsyncChartServiceRepository, 'listNoticePopups'>,
  nowIso = new Date().toISOString(),
): Promise<NoticePopupRecord[]> {
  return sortNoticePopups(await repository.listNoticePopups())
    .filter((popup) => popup.isActive)
    .filter((popup) => isNoticePopupWithinSchedule(popup, nowIso))
    .map((popup) => structuredClone(popup));
}

export function sortNoticePopups(popups: NoticePopupRecord[]): NoticePopupRecord[] {
  return [...popups].sort((left, right) => (
    left.sortOrder - right.sortOrder ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.title.localeCompare(right.title)
  ));
}

export function upsertNoticePopup(
  repository: Pick<ChartServiceRepository, 'appendAuditLog' | 'listNoticePopups' | 'nextId' | 'saveNoticePopup'>,
  input: NoticePopupMutationInput,
): NoticePopupRecord {
  assertAdminActor(input.admin);
  const before = repository.listNoticePopups().find((popup) => popup.id === input.popup.id) ?? null;
  const popup = createNoticePopupRecord({
    popup: input.popup,
    existingPopup: before ?? undefined,
    id: input.popup.id || repository.nextId('notice_popup'),
    updatedAt: input.updatedAt,
    updatedByAdminId: input.admin.id,
  });

  repository.saveNoticePopup(popup);
  repository.appendAuditLog({
    actorAdminId: input.admin.id,
    action: 'admin.notice_popup.upsert',
    targetType: 'notice_popups',
    targetId: popup.id,
    beforeJson: before,
    afterJson: popup,
  });

  return popup;
}

export async function upsertAsyncNoticePopup(
  repository: Pick<AsyncChartServiceRepository, 'appendAuditLog' | 'listNoticePopups' | 'nextId' | 'saveNoticePopup'>,
  input: NoticePopupMutationInput,
): Promise<NoticePopupRecord> {
  assertAdminActor(input.admin);
  const before = (await repository.listNoticePopups()).find((popup) => popup.id === input.popup.id) ?? null;
  const popup = createNoticePopupRecord({
    popup: input.popup,
    existingPopup: before ?? undefined,
    id: input.popup.id || await repository.nextId('notice_popup'),
    updatedAt: input.updatedAt,
    updatedByAdminId: input.admin.id,
  });

  await repository.saveNoticePopup(popup);
  await repository.appendAuditLog({
    actorAdminId: input.admin.id,
    action: 'admin.notice_popup.upsert',
    targetType: 'notice_popups',
    targetId: popup.id,
    beforeJson: before,
    afterJson: popup,
  });

  return popup;
}

export async function deleteAsyncNoticePopup(
  repository: Pick<AsyncChartServiceRepository, 'appendAuditLog' | 'deleteNoticePopup' | 'listNoticePopups'>,
  input: NoticePopupDeleteInput,
): Promise<string> {
  assertAdminActor(input.admin);
  const popupId = input.popupId.trim();
  if (!popupId) throw new Error('Notice popup id is required');

  const before = (await repository.listNoticePopups()).find((popup) => popup.id === popupId) ?? null;
  if (!before) throw new Error('Notice popup not found');

  await repository.deleteNoticePopup(popupId);
  await repository.appendAuditLog({
    actorAdminId: input.admin.id,
    action: 'admin.notice_popup.delete',
    targetType: 'notice_popups',
    targetId: popupId,
    beforeJson: before,
    afterJson: null,
  });

  return popupId;
}

export function sanitizeNoticePopupHtml(html: string): string {
  return String(html ?? '')
    .replace(/<\s*(script|style|object|embed|form|input|button|textarea|select)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|object|embed|form|input|button|textarea|select)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*(data:(?!image\/(?:png|jpeg|webp|gif);base64,))[\s\S]*?\2/gi, '')
    .trim();
}

export function isNoticePopupWithinSchedule(popup: Pick<NoticePopupRecord, 'endAt' | 'startAt'>, nowIso = new Date().toISOString()): boolean {
  const nowTime = Date.parse(nowIso);
  if (!Number.isFinite(nowTime)) return false;
  if (popup.startAt && Date.parse(popup.startAt) > nowTime) return false;
  if (popup.endAt && Date.parse(popup.endAt) < nowTime) return false;
  return true;
}

function createNoticePopupRecord(input: {
  popup: NoticePopupInput;
  existingPopup?: NoticePopupRecord;
  id: string;
  updatedAt: string;
  updatedByAdminId: string;
}): NoticePopupRecord {
  const title = input.popup.title.trim();
  const bodyHtml = sanitizeNoticePopupHtml(input.popup.bodyHtml);
  const plainBody = bodyHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  const hasMedia = /<(img|iframe|video)\b/i.test(bodyHtml);
  const startAt = normalizeNullableIsoString(input.popup.startAt);
  const endAt = normalizeNullableIsoString(input.popup.endAt);
  if (!title) throw new Error('Notice popup title is required');
  if (!plainBody && !hasMedia) throw new Error('Notice popup content is required');
  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    throw new Error('Notice popup end time must be after start time');
  }

  return {
    id: input.id,
    title,
    bodyHtml,
    isActive: Boolean(input.popup.isActive),
    sortOrder: Number.isFinite(input.popup.sortOrder) ? input.popup.sortOrder : 0,
    startAt,
    endAt,
    createdAt: input.existingPopup?.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    updatedByAdminId: input.updatedByAdminId,
  };
}

function normalizeNullableIsoString(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Notice popup schedule is invalid');
  return date.toISOString();
}
