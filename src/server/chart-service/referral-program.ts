import {
  REFERRAL_LEDGER_STATUSES,
  assertSuperAdminActor,
  confirmReferralLedger,
  createAuditLogDraft,
  type Actor,
  type PaymentRequestRecord,
  type ReferralLedgerRecord,
} from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type {
  ChartServiceRepository,
  PublicServiceUserRecord,
  ReferralProgramSettingsRecord,
  ServiceUserRecord,
} from './repository.ts';
import { toPublicServiceUserRecord } from './user-serialization.ts';

export const DEFAULT_REFERRAL_REWARD_PERCENT = 10;
export const DEFAULT_SUBSCRIBER_CASHBACK_PERCENT = 3;
export const DEFAULT_SALESPERSON_REWARD_PERCENT = 30;
const DEFAULT_REFERRAL_SETTINGS_ID = 'default';
const REFERRAL_CONFIRM_WINDOW_DAYS = 7;

type ReferralProgramSettingsInput = {
  admin: Actor;
  subscriberCashbackPercent?: number;
  rewardPercent: number;
  salespersonRewardPercent?: number;
  updatedAt: string;
};

export type UserReferralListItem = {
  user: PublicServiceUserRecord;
  ledgerCount: number;
  pendingPoints: number;
  confirmedPoints: number;
  reversedPoints: number;
  totalPoints: number;
  latestLedger: ReferralLedgerRecord | null;
  latestPayment: PaymentRequestRecord | null;
};

export type UserReferralSummary = {
  rewardPercent: number;
  referredUserCount: number;
  pendingPoints: number;
  confirmedPoints: number;
  reversedPoints: number;
  totalPoints: number;
  referredUsers: UserReferralListItem[];
};

export type UserReferralSummaryOptions = {
  nowIso?: string;
  autoConfirm?: boolean;
};

export type ReferralAutoConfirmResult = {
  confirmedCount: number;
  confirmedLedgers: ReferralLedgerRecord[];
};

export function getReferralProgramSettings(
  repository: ChartServiceRepository,
): ReferralProgramSettingsRecord {
  return readReferralProgramSettings(repository) ?? createDefaultReferralProgramSettings();
}

export async function getAsyncReferralProgramSettings(
  repository: AsyncChartServiceRepository,
): Promise<ReferralProgramSettingsRecord> {
  return await readAsyncReferralProgramSettings(repository) ?? createDefaultReferralProgramSettings();
}

export function updateReferralProgramSettings(
  repository: ChartServiceRepository,
  input: ReferralProgramSettingsInput,
): ReferralProgramSettingsRecord {
  assertSuperAdminActor(input.admin);
  const before = readReferralProgramSettings(repository) ?? createDefaultReferralProgramSettings();
  const settings = createReferralProgramSettingsFromInput(before, input);

  saveReferralProgramSettings(repository, settings);
  appendPointSettingsAuditLog(repository, input.admin, before, settings);

  return settings;
}

export function updatePointProgramSettings(
  repository: ChartServiceRepository,
  input: ReferralProgramSettingsInput,
): ReferralProgramSettingsRecord {
  return updateReferralProgramSettings(repository, input);
}

export async function updateAsyncPointProgramSettings(
  repository: AsyncChartServiceRepository,
  input: ReferralProgramSettingsInput,
): Promise<ReferralProgramSettingsRecord> {
  return updateAsyncReferralProgramSettings(repository, input);
}

export function getPointProgramSettings(
  repository: ChartServiceRepository,
): ReferralProgramSettingsRecord {
  return getReferralProgramSettings(repository);
}

export async function getAsyncPointProgramSettings(
  repository: AsyncChartServiceRepository,
): Promise<ReferralProgramSettingsRecord> {
  return getAsyncReferralProgramSettings(repository);
}

function createReferralProgramSettingsFromInput(
  before: ReferralProgramSettingsRecord,
  input: ReferralProgramSettingsInput,
): ReferralProgramSettingsRecord {
  const settings: ReferralProgramSettingsRecord = {
    id: DEFAULT_REFERRAL_SETTINGS_ID,
    subscriberCashbackPercent: normalizeRewardPercent(
      input.subscriberCashbackPercent ?? before.subscriberCashbackPercent,
      'Subscriber cashback percent',
    ),
    rewardPercent: normalizeRewardPercent(input.rewardPercent, 'Referral reward percent'),
    salespersonRewardPercent: normalizeRewardPercent(
      input.salespersonRewardPercent ?? before.salespersonRewardPercent,
      'Salesperson reward percent',
    ),
    updatedByAdminId: input.admin.id,
    updatedAt: input.updatedAt,
  };

  return settings;
}

function appendPointSettingsAuditLog(
  repository: Pick<ChartServiceRepository, 'appendAuditLog'>,
  admin: Actor,
  before: ReferralProgramSettingsRecord,
  settings: ReferralProgramSettingsRecord,
): void {
  repository.appendAuditLog(createAuditLogDraft({
    actor: admin,
    action: 'admin.points.settings.update',
    targetType: 'referral_program_settings',
    targetId: settings.id,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));
}

export async function updateAsyncReferralProgramSettings(
  repository: AsyncChartServiceRepository,
  input: ReferralProgramSettingsInput,
): Promise<ReferralProgramSettingsRecord> {
  assertSuperAdminActor(input.admin);
  const before = await readAsyncReferralProgramSettings(repository) ?? createDefaultReferralProgramSettings();
  const settings = createReferralProgramSettingsFromInput(before, input);

  await saveAsyncReferralProgramSettings(repository, settings);
  await repository.appendAuditLog(createAuditLogDraft({
    actor: input.admin,
    action: 'admin.points.settings.update',
    targetType: 'referral_program_settings',
    targetId: settings.id,
    beforeJson: { settings: before },
    afterJson: { settings },
  }));

  return settings;
}

export function createReferralLedgerForPayment(
  repository: ChartServiceRepository,
  input: { user: ServiceUserRecord; payment: PaymentRequestRecord; createdAt: string },
): ReferralLedgerRecord | null {
  const referrer = input.user.referredByUserId
    ? repository.getUserById(input.user.referredByUserId)
    : null;
  if (!referrer || referrer.id === input.user.id) return null;

  const rewardPercent = getReferralProgramSettings(repository).rewardPercent;
  if (rewardPercent <= 0) return null;

  return createReferralLedgerDraft({
    id: repository.nextId('ref_ledger'),
    referrerUserId: referrer.id,
    referredUserId: input.user.id,
    payment: input.payment,
    rewardPercent,
    createdAt: input.createdAt,
  });
}

export async function createAsyncReferralLedgerForPayment(
  repository: AsyncChartServiceRepository,
  input: { user: ServiceUserRecord; payment: PaymentRequestRecord; createdAt: string },
): Promise<ReferralLedgerRecord | null> {
  const referrer = input.user.referredByUserId
    ? await repository.getUserById(input.user.referredByUserId)
    : null;
  if (!referrer || referrer.id === input.user.id) return null;

  const rewardPercent = (await getAsyncReferralProgramSettings(repository)).rewardPercent;
  if (rewardPercent <= 0) return null;

  return createReferralLedgerDraft({
    id: await repository.nextId('ref_ledger'),
    referrerUserId: referrer.id,
    referredUserId: input.user.id,
    payment: input.payment,
    rewardPercent,
    createdAt: input.createdAt,
  });
}

export function getUserReferralSummary(
  repository: ChartServiceRepository,
  userId: string,
  options: UserReferralSummaryOptions = {},
): UserReferralSummary {
  if (options.autoConfirm !== false) {
    confirmMaturedReferralLedgers(repository, options.nowIso ?? new Date().toISOString());
  }

  return buildUserReferralSummary({
    settings: getReferralProgramSettings(repository),
    users: repository.listUsers(),
    payments: repository.listPayments(),
    ledgers: repository
      .listPayments()
      .flatMap((payment) => repository.listReferralLedgersByPaymentId(payment.id)),
    userId,
  });
}

export async function getAsyncUserReferralSummary(
  repository: AsyncChartServiceRepository,
  userId: string,
  options: UserReferralSummaryOptions = {},
): Promise<UserReferralSummary> {
  if (options.autoConfirm !== false) {
    await confirmAsyncMaturedReferralLedgers(repository, options.nowIso ?? new Date().toISOString());
  }

  const [settings, users, payments] = await Promise.all([
    getAsyncReferralProgramSettings(repository),
    repository.listUsers(),
    repository.listPayments(),
  ]);
  const ledgers = (await Promise.all(
    payments.map((payment) => repository.listReferralLedgersByPaymentId(payment.id)),
  )).flat();

  return buildUserReferralSummary({ settings, users, payments, ledgers, userId });
}

export function confirmMaturedReferralLedgers(
  repository: ChartServiceRepository,
  nowIso: string,
): ReferralAutoConfirmResult {
  const confirmedLedgers = repository
    .listPayments()
    .flatMap((payment) => repository.listReferralLedgersByPaymentId(payment.id))
    .filter((ledger) => shouldConfirmReferralLedger(ledger, nowIso))
    .map((ledger) => confirmReferralLedger(ledger, nowIso));

  confirmedLedgers.forEach((ledger) => repository.saveReferralLedger(ledger));

  return {
    confirmedCount: confirmedLedgers.length,
    confirmedLedgers,
  };
}

export async function confirmAsyncMaturedReferralLedgers(
  repository: AsyncChartServiceRepository,
  nowIso: string,
): Promise<ReferralAutoConfirmResult> {
  const payments = await repository.listPayments();
  const ledgers = (await Promise.all(
    payments.map((payment) => repository.listReferralLedgersByPaymentId(payment.id)),
  )).flat();
  const confirmedLedgers = ledgers
    .filter((ledger) => shouldConfirmReferralLedger(ledger, nowIso))
    .map((ledger) => confirmReferralLedger(ledger, nowIso));

  await Promise.all(confirmedLedgers.map((ledger) => repository.saveReferralLedger(ledger)));

  return {
    confirmedCount: confirmedLedgers.length,
    confirmedLedgers,
  };
}

function createDefaultReferralProgramSettings(): ReferralProgramSettingsRecord {
  return {
    id: DEFAULT_REFERRAL_SETTINGS_ID,
    subscriberCashbackPercent: DEFAULT_SUBSCRIBER_CASHBACK_PERCENT,
    rewardPercent: DEFAULT_REFERRAL_REWARD_PERCENT,
    salespersonRewardPercent: DEFAULT_SALESPERSON_REWARD_PERCENT,
    updatedByAdminId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function shouldConfirmReferralLedger(ledger: ReferralLedgerRecord, nowIso: string): boolean {
  return ledger.status === REFERRAL_LEDGER_STATUSES.pending &&
    new Date(ledger.confirmAfter).getTime() <= new Date(nowIso).getTime();
}

function readReferralProgramSettings(
  repository: ChartServiceRepository,
): ReferralProgramSettingsRecord | null {
  const getter = (repository as Partial<ChartServiceRepository>).getReferralProgramSettings;
  if (typeof getter === 'function') return getter.call(repository);

  return getLegacyReferralProgramSettingsStore(repository).settings;
}

async function readAsyncReferralProgramSettings(
  repository: AsyncChartServiceRepository,
): Promise<ReferralProgramSettingsRecord | null> {
  const getter = (repository as Partial<AsyncChartServiceRepository>).getReferralProgramSettings;
  if (typeof getter === 'function') return await getter.call(repository);

  return getLegacyReferralProgramSettingsStore(repository).settings;
}

function saveReferralProgramSettings(
  repository: ChartServiceRepository,
  settings: ReferralProgramSettingsRecord,
): void {
  const saver = (repository as Partial<ChartServiceRepository>).saveReferralProgramSettings;
  if (typeof saver === 'function') {
    saver.call(repository, settings);
    return;
  }

  getLegacyReferralProgramSettingsStore(repository).settings = { ...settings };
}

async function saveAsyncReferralProgramSettings(
  repository: AsyncChartServiceRepository,
  settings: ReferralProgramSettingsRecord,
): Promise<void> {
  const saver = (repository as Partial<AsyncChartServiceRepository>).saveReferralProgramSettings;
  if (typeof saver === 'function') {
    await saver.call(repository, settings);
    return;
  }

  getLegacyReferralProgramSettingsStore(repository).settings = { ...settings };
}

function getLegacyReferralProgramSettingsStore(
  repository: object,
): { settings: ReferralProgramSettingsRecord | null } {
  const legacyRepository = repository as {
    __referralProgramSettingsFallback?: { settings: ReferralProgramSettingsRecord | null };
  };
  legacyRepository.__referralProgramSettingsFallback ??= { settings: null };
  return legacyRepository.__referralProgramSettingsFallback;
}

function createReferralLedgerDraft(input: {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  payment: PaymentRequestRecord;
  rewardPercent: number;
  createdAt: string;
}): ReferralLedgerRecord | null {
  const points = roundPoints(input.payment.amountUsd * input.rewardPercent / 100);
  if (points <= 0) return null;

  return {
    id: input.id,
    referrerUserId: input.referrerUserId,
    referredUserId: input.referredUserId,
    paymentRequestId: input.payment.id,
    amountUsd: input.payment.amountUsd,
    percent: input.rewardPercent,
    points,
    status: REFERRAL_LEDGER_STATUSES.pending,
    confirmAfter: addDaysIso(input.createdAt, REFERRAL_CONFIRM_WINDOW_DAYS),
    confirmedAt: null,
    reversedAt: null,
    createdAt: input.createdAt,
  };
}

function buildUserReferralSummary(input: {
  settings: ReferralProgramSettingsRecord;
  users: ServiceUserRecord[];
  payments: PaymentRequestRecord[];
  ledgers: ReferralLedgerRecord[];
  userId: string;
}): UserReferralSummary {
  const ledgers = input.ledgers.filter((ledger) => ledger.referrerUserId === input.userId);
  const referredUserIds = new Set<string>([
    ...input.users
      .filter((user) => user.referredByUserId === input.userId)
      .map((user) => user.id),
    ...ledgers.map((ledger) => ledger.referredUserId),
  ]);
  const paymentById = new Map(input.payments.map((payment) => [payment.id, payment]));
  const referredUsers = [...referredUserIds]
    .map((referredUserId) => {
      const user = input.users.find((candidate) => candidate.id === referredUserId);
      if (!user) return null;
      const userLedgers = ledgers
        .filter((ledger) => ledger.referredUserId === referredUserId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestLedger = userLedgers[0] ?? null;

      return {
        user: toPublicServiceUserRecord(user),
        ledgerCount: userLedgers.length,
        pendingPoints: sumPointsByStatus(userLedgers, REFERRAL_LEDGER_STATUSES.pending),
        confirmedPoints: sumPointsByStatus(userLedgers, REFERRAL_LEDGER_STATUSES.confirmed),
        reversedPoints: sumPointsByStatus(userLedgers, REFERRAL_LEDGER_STATUSES.reversed),
        totalPoints: sumActivePoints(userLedgers),
        latestLedger,
        latestPayment: latestLedger ? paymentById.get(latestLedger.paymentRequestId) ?? null : null,
      };
    })
    .filter((item): item is UserReferralListItem => item !== null)
    .sort((a, b) => {
      const aTime = new Date(a.latestLedger?.createdAt ?? a.user.createdAt).getTime();
      const bTime = new Date(b.latestLedger?.createdAt ?? b.user.createdAt).getTime();
      return bTime - aTime;
    });

  return {
    rewardPercent: input.settings.rewardPercent,
    referredUserCount: referredUsers.length,
    pendingPoints: sumReferralItems(referredUsers, 'pendingPoints'),
    confirmedPoints: sumReferralItems(referredUsers, 'confirmedPoints'),
    reversedPoints: sumReferralItems(referredUsers, 'reversedPoints'),
    totalPoints: sumReferralItems(referredUsers, 'totalPoints'),
    referredUsers,
  };
}

function normalizeRewardPercent(value: number, label = 'Referral reward percent'): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number`);
  if (value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100`);
  return Math.round(value * 100) / 100;
}

function addDaysIso(value: string, days: number): string {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function sumPointsByStatus(
  ledgers: ReferralLedgerRecord[],
  status: ReferralLedgerRecord['status'],
): number {
  return roundPoints(ledgers
    .filter((ledger) => ledger.status === status)
    .reduce((total, ledger) => total + ledger.points, 0));
}

function sumActivePoints(ledgers: ReferralLedgerRecord[]): number {
  return roundPoints(ledgers
    .filter((ledger) => ledger.status !== REFERRAL_LEDGER_STATUSES.reversed)
    .reduce((total, ledger) => total + ledger.points, 0));
}

function sumReferralItems(
  items: UserReferralListItem[],
  key: 'pendingPoints' | 'confirmedPoints' | 'reversedPoints' | 'totalPoints',
): number {
  return roundPoints(items.reduce((total, item) => total + item[key], 0));
}

function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}
