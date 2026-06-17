import {
  createAsyncChartServicePersistenceFromConfig,
  createChartServiceRepositoryFromConfig,
  getChartServiceRepositoryConfigFromEnv,
  getChartServiceRepositoryConfigSignature,
  resolveChartServiceRepositoryAdapter,
  type ChartServiceRepositoryRuntimeEnv,
} from './repository-adapter.ts';
import {
  createAsyncChartServicePersistence,
  type AsyncChartServicePersistence,
} from './async-repository.ts';
import type {
  ChartUserSettingsRecord,
  ChartServiceRepository,
  FreeTrialPolicySettingsRecord,
  FreeTrialUsageRecord,
  FreeTrialUserAllowanceRecord,
  NoticePopupRecord,
  PaymentTransferSettingsRecord,
  PublicBoardPostRecord,
  SalesTeamRecord,
  SignupAgreementRecord,
  SignalAdminSettingsRecord,
  SignalEventRecord,
  TelegramBotProfileRecord,
  TelegramDeliveryLogRecord,
  TelegramSignalWatchStateRecord,
} from './repository.ts';
import { getDefaultPublicBoardPosts } from './public-board.ts';

const globalForChartService = globalThis as typeof globalThis & {
  __chartServiceRepository?: ChartServiceRepository;
  __chartServiceRepositorySignature?: string;
  __asyncChartServicePersistence?: AsyncChartServicePersistence;
  __asyncChartServicePersistenceSignature?: string;
};

export function getChartServiceRepository(env?: ChartServiceRepositoryRuntimeEnv) {
  const config = getChartServiceRepositoryConfigFromEnv(env);
  const signature = getChartServiceRepositoryConfigSignature(config);
  if (
    !globalForChartService.__chartServiceRepository ||
    globalForChartService.__chartServiceRepositorySignature !== signature
  ) {
    globalForChartService.__chartServiceRepository = createChartServiceRepositoryFromConfig(config);
    globalForChartService.__chartServiceRepositorySignature = signature;
  }

  ensureMemoryRepositoryCapabilities(globalForChartService.__chartServiceRepository);
  if (!hasMemoryRepositoryCapabilities(globalForChartService.__chartServiceRepository)) {
    const staleRepository = globalForChartService.__chartServiceRepository;
    const replacementRepository = createChartServiceRepositoryFromConfig(config);
    copyRecoverableMemoryRepositoryRecords(staleRepository, replacementRepository);
    ensureMemoryRepositoryCapabilities(replacementRepository);
    globalForChartService.__chartServiceRepository = replacementRepository;
    globalForChartService.__chartServiceRepositorySignature = signature;
  }

  return globalForChartService.__chartServiceRepository;
}

export function getAsyncChartServicePersistence(env?: ChartServiceRepositoryRuntimeEnv) {
  const config = getChartServiceRepositoryConfigFromEnv(env);
  const signature = `async:${getChartServiceRepositoryConfigSignature(config)}`;
  if (
    !globalForChartService.__asyncChartServicePersistence ||
    globalForChartService.__asyncChartServicePersistenceSignature !== signature ||
    !hasAsyncRepositoryCapabilities(globalForChartService.__asyncChartServicePersistence)
  ) {
    const adapter = resolveChartServiceRepositoryAdapter(config);
    globalForChartService.__asyncChartServicePersistence = adapter.kind === 'memory'
      ? createAsyncChartServicePersistence(getChartServiceRepository(env))
      : createAsyncChartServicePersistenceFromConfig(config);
    globalForChartService.__asyncChartServicePersistenceSignature = signature;
  }

  return globalForChartService.__asyncChartServicePersistence;
}

function hasAsyncRepositoryCapabilities(persistence: AsyncChartServicePersistence): boolean {
  return typeof persistence.repository.listSalesTeams === 'function' &&
    typeof persistence.repository.saveSalesTeam === 'function' &&
    typeof persistence.repository.getFreeTrialPolicySettings === 'function' &&
    typeof persistence.repository.saveFreeTrialPolicySettings === 'function' &&
    typeof persistence.repository.getFreeTrialUserAllowanceByUserId === 'function' &&
    typeof persistence.repository.saveFreeTrialUserAllowance === 'function' &&
    typeof persistence.repository.listFreeTrialUsageRecordsByUserId === 'function' &&
    typeof persistence.repository.saveFreeTrialUsageRecord === 'function' &&
    typeof persistence.repository.getPaymentTransferSettings === 'function' &&
    typeof persistence.repository.savePaymentTransferSettings === 'function' &&
    typeof persistence.repository.listPublicBoardPosts === 'function' &&
    typeof persistence.repository.savePublicBoardPost === 'function' &&
    typeof persistence.repository.listNoticePopups === 'function' &&
    typeof persistence.repository.saveNoticePopup === 'function' &&
    typeof persistence.repository.deleteNoticePopup === 'function' &&
    typeof persistence.repository.listSignupAgreementsByUserId === 'function' &&
    typeof persistence.repository.saveSignupAgreement === 'function' &&
    typeof persistence.repository.getChartUserSettings === 'function' &&
    typeof persistence.repository.saveChartUserSettings === 'function' &&
    typeof persistence.repository.getSignalAdminSettings === 'function' &&
    typeof persistence.repository.saveSignalAdminSettings === 'function' &&
    typeof persistence.repository.listTelegramBotProfiles === 'function' &&
    typeof persistence.repository.getTelegramBotProfileById === 'function' &&
    typeof persistence.repository.saveTelegramBotProfile === 'function' &&
    typeof persistence.repository.deleteTelegramBotProfile === 'function' &&
    typeof persistence.repository.listTelegramDeliveryLogs === 'function' &&
    typeof persistence.repository.saveTelegramDeliveryLog === 'function' &&
    typeof persistence.repository.getTelegramSignalWatchState === 'function' &&
    typeof persistence.repository.saveTelegramSignalWatchState === 'function' &&
    typeof persistence.repository.listSignalEvents === 'function' &&
    typeof persistence.repository.saveSignalEvent === 'function' &&
    typeof persistence.repository.getSupportMessageById === 'function' &&
    typeof persistence.repository.listSupportMessagesByThreadId === 'function' &&
    typeof persistence.repository.deleteSupportMessage === 'function' &&
    typeof persistence.repository.deleteSupportMessagesByThreadId === 'function';
}

function hasMemoryRepositoryCapabilities(repository: ChartServiceRepository): boolean {
  return typeof repository.getSupportMessageById === 'function' &&
    typeof repository.listNoticePopups === 'function' &&
    typeof repository.saveNoticePopup === 'function' &&
    typeof repository.deleteNoticePopup === 'function' &&
    typeof repository.getFreeTrialPolicySettings === 'function' &&
    typeof repository.saveFreeTrialPolicySettings === 'function' &&
    typeof repository.getFreeTrialUserAllowanceByUserId === 'function' &&
    typeof repository.saveFreeTrialUserAllowance === 'function' &&
    typeof repository.listFreeTrialUsageRecordsByUserId === 'function' &&
    typeof repository.saveFreeTrialUsageRecord === 'function' &&
    typeof repository.getChartUserSettings === 'function' &&
    typeof repository.saveChartUserSettings === 'function' &&
    typeof repository.getSignalAdminSettings === 'function' &&
    typeof repository.saveSignalAdminSettings === 'function' &&
    typeof repository.listTelegramBotProfiles === 'function' &&
    typeof repository.getTelegramBotProfileById === 'function' &&
    typeof repository.saveTelegramBotProfile === 'function' &&
    typeof repository.deleteTelegramBotProfile === 'function' &&
    typeof repository.listTelegramDeliveryLogs === 'function' &&
    typeof repository.saveTelegramDeliveryLog === 'function' &&
    typeof repository.getTelegramSignalWatchState === 'function' &&
    typeof repository.saveTelegramSignalWatchState === 'function' &&
    typeof repository.listSignalEvents === 'function' &&
    typeof repository.saveSignalEvent === 'function' &&
    typeof repository.listSupportMessagesByThreadId === 'function' &&
    typeof repository.deleteSupportMessage === 'function' &&
    typeof repository.deleteSupportMessagesByThreadId === 'function';
}

function copyRecoverableMemoryRepositoryRecords(
  source: Partial<ChartServiceRepository>,
  target: ChartServiceRepository,
): void {
  copyRecords(source.listPlans, target.savePlan);
  copyRecords(source.listUsers, target.saveUser);
  copyRecords(source.listSubscriptions, target.saveSubscription);
  copyRecords(source.listPayments, target.savePayment);
  copyRecords(source.listSalesTeams, target.saveSalesTeam);
  copyRecords(source.listPublicBoardPosts, target.savePublicBoardPost);
  copyRecords(source.listNoticePopups, target.saveNoticePopup);
  copyRecords(source.listSupportThreads, target.saveSupportThread);
  copyRecords(source.listAuditLogs, target.appendAuditLog);
  copyRecords(() => source.listEmailOutboxRecords?.() ?? [], target.saveEmailOutboxRecord);

  const users = readRecords(source.listUsers);
  users.forEach((user) => {
    copyRecords(() => source.listSessionsByUserId?.(user.id) ?? [], target.saveSession);
    copyRecords(() => source.listNotificationsByUserId?.(user.id) ?? [], target.saveNotification);
    copyRecords(() => source.listSignupAgreementsByUserId?.(user.id) ?? [], target.saveSignupAgreement);
    copyRecords(() => source.listFreeTrialUsageRecordsByUserId?.(user.id) ?? [], target.saveFreeTrialUsageRecord);
    const freeTrialAllowance = readOptionalRecord(() => source.getFreeTrialUserAllowanceByUserId?.(user.id) ?? null);
    if (freeTrialAllowance) target.saveFreeTrialUserAllowance(freeTrialAllowance);
    const chartSettings = readOptionalRecord(() => source.getChartUserSettings?.(user.id) ?? null);
    if (chartSettings) target.saveChartUserSettings(chartSettings);
  });

  readRecords(source.listPayments).forEach((payment) => {
    copyRecords(() => source.listReferralLedgersByPaymentId?.(payment.id) ?? [], target.saveReferralLedger);
  });

  readRecords(source.listSupportThreads).forEach((thread) => {
    copyRecords(() => source.listSupportMessagesByThreadId?.(thread.id) ?? [], target.saveSupportMessage);
  });

  const referralSettings = readOptionalRecord(source.getReferralProgramSettings);
  if (referralSettings) target.saveReferralProgramSettings(referralSettings);
  const freeTrialPolicySettings = readOptionalRecord(source.getFreeTrialPolicySettings);
  if (freeTrialPolicySettings) target.saveFreeTrialPolicySettings(freeTrialPolicySettings);
  const paymentSettings = readOptionalRecord(source.getPaymentTransferSettings);
  if (paymentSettings) target.savePaymentTransferSettings(paymentSettings);
  const webInfoSettings = readOptionalRecord(source.getWebInfoSettings);
  if (webInfoSettings) target.saveWebInfoSettings(webInfoSettings);
  const signalAdminSettings = readOptionalRecord(() => source.getSignalAdminSettings?.('default') ?? null);
  if (signalAdminSettings) target.saveSignalAdminSettings(signalAdminSettings);
  copyRecords(() => source.listTelegramBotProfiles?.() ?? [], target.saveTelegramBotProfile);
  copyRecords(() => source.listTelegramDeliveryLogs?.(1000) ?? [], target.saveTelegramDeliveryLog);
  const fallbackSource = source as Partial<ChartServiceRepository> & {
    __fallbackTelegramSignalWatchStates?: TelegramSignalWatchStateRecord[];
  };
  copyRecords(() => fallbackSource.__fallbackTelegramSignalWatchStates ?? [], target.saveTelegramSignalWatchState);
  copyRecords(() => source.listSignalEvents?.(1000) ?? [], target.saveSignalEvent);
}

function copyRecords<RecordType>(
  read: (() => RecordType[]) | undefined,
  write: ((record: RecordType) => void) | undefined,
): void {
  if (!read || !write) return;
  readRecords(read).forEach((record) => write(record));
}

function readRecords<RecordType>(read: (() => RecordType[]) | undefined): RecordType[] {
  if (!read) return [];
  try {
    return read();
  } catch {
    return [];
  }
}

function readOptionalRecord<RecordType>(read: (() => RecordType | null) | undefined): RecordType | null {
  if (!read) return null;
  try {
    return read();
  } catch {
    return null;
  }
}

function ensureMemoryRepositoryCapabilities(repository: ChartServiceRepository): void {
  const mutableRepository = repository as ChartServiceRepository & {
    __fallbackSalesTeams?: SalesTeamRecord[];
    __fallbackFreeTrialPolicySettings?: FreeTrialPolicySettingsRecord | null;
    __fallbackFreeTrialUserAllowances?: FreeTrialUserAllowanceRecord[];
    __fallbackFreeTrialUsageRecords?: FreeTrialUsageRecord[];
    __fallbackChartUserSettings?: ChartUserSettingsRecord[];
    __fallbackSignalAdminSettings?: SignalAdminSettingsRecord[];
    __fallbackTelegramBotProfiles?: TelegramBotProfileRecord[];
    __fallbackTelegramDeliveryLogs?: TelegramDeliveryLogRecord[];
    __fallbackTelegramSignalWatchStates?: TelegramSignalWatchStateRecord[];
    __fallbackSignalEvents?: SignalEventRecord[];
    __fallbackPaymentTransferSettings?: PaymentTransferSettingsRecord | null;
    __fallbackPublicBoardPosts?: PublicBoardPostRecord[];
    __fallbackNoticePopups?: NoticePopupRecord[];
    __fallbackSignupAgreements?: SignupAgreementRecord[];
  };

  mutableRepository.__fallbackSalesTeams ??= [];
  mutableRepository.__fallbackFreeTrialPolicySettings ??= null;
  mutableRepository.__fallbackFreeTrialUserAllowances ??= [];
  mutableRepository.__fallbackFreeTrialUsageRecords ??= [];
  mutableRepository.__fallbackChartUserSettings ??= [];
  mutableRepository.__fallbackSignalAdminSettings ??= [];
  mutableRepository.__fallbackTelegramBotProfiles ??= [];
  mutableRepository.__fallbackTelegramDeliveryLogs ??= [];
  mutableRepository.__fallbackTelegramSignalWatchStates ??= [];
  mutableRepository.__fallbackSignalEvents ??= [];
  mutableRepository.__fallbackPaymentTransferSettings ??= null;
  mutableRepository.__fallbackPublicBoardPosts ??= getDefaultPublicBoardPosts();
  mutableRepository.__fallbackNoticePopups ??= [];
  mutableRepository.__fallbackSignupAgreements ??= [];

  if (typeof mutableRepository.listSalesTeams !== 'function') {
    mutableRepository.listSalesTeams = () => (
      mutableRepository.__fallbackSalesTeams ?? []
    ).map((team) => structuredClone(team));
  }

  if (typeof mutableRepository.saveSalesTeam !== 'function') {
    mutableRepository.saveSalesTeam = (team) => {
      const salesTeams = mutableRepository.__fallbackSalesTeams ?? [];
      const index = salesTeams.findIndex((item) => item.id === team.id);
      if (index >= 0) {
        salesTeams[index] = structuredClone(team);
      } else {
        salesTeams.push(structuredClone(team));
      }
      mutableRepository.__fallbackSalesTeams = salesTeams;
    };
  }

  if (typeof mutableRepository.getFreeTrialPolicySettings !== 'function') {
    mutableRepository.getFreeTrialPolicySettings = () => (
      mutableRepository.__fallbackFreeTrialPolicySettings
        ? structuredClone(mutableRepository.__fallbackFreeTrialPolicySettings)
        : null
    );
  }

  if (typeof mutableRepository.saveFreeTrialPolicySettings !== 'function') {
    mutableRepository.saveFreeTrialPolicySettings = (settings) => {
      mutableRepository.__fallbackFreeTrialPolicySettings = structuredClone(settings);
    };
  }

  if (typeof mutableRepository.getFreeTrialUserAllowanceByUserId !== 'function') {
    mutableRepository.getFreeTrialUserAllowanceByUserId = (userId) => {
      const allowance = (mutableRepository.__fallbackFreeTrialUserAllowances ?? [])
        .find((item) => item.userId === userId);
      return allowance ? structuredClone(allowance) : null;
    };
  }

  if (typeof mutableRepository.saveFreeTrialUserAllowance !== 'function') {
    mutableRepository.saveFreeTrialUserAllowance = (allowance) => {
      const rows = mutableRepository.__fallbackFreeTrialUserAllowances ?? [];
      const index = rows.findIndex((item) => item.userId === allowance.userId);
      if (index >= 0) {
        rows[index] = structuredClone(allowance);
      } else {
        rows.push(structuredClone(allowance));
      }
      mutableRepository.__fallbackFreeTrialUserAllowances = rows;
    };
  }

  if (typeof mutableRepository.listFreeTrialUsageRecordsByUserId !== 'function') {
    mutableRepository.listFreeTrialUsageRecordsByUserId = (userId) => (
      mutableRepository.__fallbackFreeTrialUsageRecords ?? []
    )
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => structuredClone(record));
  }

  if (typeof mutableRepository.saveFreeTrialUsageRecord !== 'function') {
    mutableRepository.saveFreeTrialUsageRecord = (record) => {
      const records = mutableRepository.__fallbackFreeTrialUsageRecords ?? [];
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        records[index] = structuredClone(record);
      } else {
        records.push(structuredClone(record));
      }
      mutableRepository.__fallbackFreeTrialUsageRecords = records;
    };
  }

  if (typeof mutableRepository.getPaymentTransferSettings !== 'function') {
    mutableRepository.getPaymentTransferSettings = () => (
      mutableRepository.__fallbackPaymentTransferSettings
        ? structuredClone(mutableRepository.__fallbackPaymentTransferSettings)
        : null
    );
  }

  if (typeof mutableRepository.savePaymentTransferSettings !== 'function') {
    mutableRepository.savePaymentTransferSettings = (settings) => {
      mutableRepository.__fallbackPaymentTransferSettings = structuredClone(settings);
    };
  }

  if (typeof mutableRepository.listPublicBoardPosts !== 'function') {
    mutableRepository.listPublicBoardPosts = () => (
      mutableRepository.__fallbackPublicBoardPosts ?? []
    ).map((post) => structuredClone(post));
  }

  if (typeof mutableRepository.savePublicBoardPost !== 'function') {
    mutableRepository.savePublicBoardPost = (post) => {
      const posts = mutableRepository.__fallbackPublicBoardPosts ?? [];
      const index = posts.findIndex((item) => item.id === post.id);
      if (index >= 0) {
        posts[index] = structuredClone(post);
      } else {
        posts.push(structuredClone(post));
      }
      mutableRepository.__fallbackPublicBoardPosts = posts;
    };
  }

  if (typeof mutableRepository.listNoticePopups !== 'function') {
    mutableRepository.listNoticePopups = () => (
      mutableRepository.__fallbackNoticePopups ?? []
    ).map((popup) => structuredClone(popup));
  }

  if (typeof mutableRepository.saveNoticePopup !== 'function') {
    mutableRepository.saveNoticePopup = (popup) => {
      const popups = mutableRepository.__fallbackNoticePopups ?? [];
      const index = popups.findIndex((item) => item.id === popup.id);
      if (index >= 0) {
        popups[index] = structuredClone(popup);
      } else {
        popups.push(structuredClone(popup));
      }
      mutableRepository.__fallbackNoticePopups = popups;
    };
  }

  if (typeof mutableRepository.deleteNoticePopup !== 'function') {
    mutableRepository.deleteNoticePopup = (id) => {
      mutableRepository.__fallbackNoticePopups = (mutableRepository.__fallbackNoticePopups ?? [])
        .filter((popup) => popup.id !== id);
    };
  }

  if (typeof mutableRepository.listSignupAgreementsByUserId !== 'function') {
    mutableRepository.listSignupAgreementsByUserId = (userId) => (
      mutableRepository.__fallbackSignupAgreements ?? []
    )
      .filter((agreement) => agreement.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((agreement) => structuredClone(agreement));
  }

  if (typeof mutableRepository.saveSignupAgreement !== 'function') {
    mutableRepository.saveSignupAgreement = (agreement) => {
      const agreements = mutableRepository.__fallbackSignupAgreements ?? [];
      const index = agreements.findIndex((item) => item.id === agreement.id);
      if (index >= 0) {
        agreements[index] = structuredClone(agreement);
      } else {
        agreements.push(structuredClone(agreement));
      }
      mutableRepository.__fallbackSignupAgreements = agreements;
    };
  }

  if (typeof mutableRepository.getChartUserSettings !== 'function') {
    mutableRepository.getChartUserSettings = (userId) => {
      const settings = (mutableRepository.__fallbackChartUserSettings ?? [])
        .find((item) => item.userId === userId);
      return settings ? structuredClone(settings) : null;
    };
  }

  if (typeof mutableRepository.saveChartUserSettings !== 'function') {
    mutableRepository.saveChartUserSettings = (settings) => {
      const rows = mutableRepository.__fallbackChartUserSettings ?? [];
      const index = rows.findIndex((item) => item.userId === settings.userId);
      if (index >= 0) {
        rows[index] = structuredClone(settings);
      } else {
        rows.push(structuredClone(settings));
      }
      mutableRepository.__fallbackChartUserSettings = rows;
    };
  }

  if (typeof mutableRepository.getSignalAdminSettings !== 'function') {
    mutableRepository.getSignalAdminSettings = (id) => {
      const settings = (mutableRepository.__fallbackSignalAdminSettings ?? [])
        .find((item) => item.id === id);
      return settings ? structuredClone(settings) : null;
    };
  }

  if (typeof mutableRepository.saveSignalAdminSettings !== 'function') {
    mutableRepository.saveSignalAdminSettings = (settings) => {
      const rows = mutableRepository.__fallbackSignalAdminSettings ?? [];
      const index = rows.findIndex((item) => item.id === settings.id);
      if (index >= 0) {
        rows[index] = structuredClone(settings);
      } else {
        rows.push(structuredClone(settings));
      }
      mutableRepository.__fallbackSignalAdminSettings = rows;
    };
  }

  if (typeof mutableRepository.listTelegramBotProfiles !== 'function') {
    mutableRepository.listTelegramBotProfiles = () => (
      mutableRepository.__fallbackTelegramBotProfiles ?? []
    )
      .slice()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((profile) => structuredClone(profile));
  }

  if (typeof mutableRepository.getTelegramBotProfileById !== 'function') {
    mutableRepository.getTelegramBotProfileById = (id) => {
      const profile = (mutableRepository.__fallbackTelegramBotProfiles ?? [])
        .find((item) => item.id === id);
      return profile ? structuredClone(profile) : null;
    };
  }

  if (typeof mutableRepository.saveTelegramBotProfile !== 'function') {
    mutableRepository.saveTelegramBotProfile = (profile) => {
      const rows = mutableRepository.__fallbackTelegramBotProfiles ?? [];
      const index = rows.findIndex((item) => item.id === profile.id);
      if (index >= 0) {
        rows[index] = structuredClone(profile);
      } else {
        rows.push(structuredClone(profile));
      }
      mutableRepository.__fallbackTelegramBotProfiles = rows;
    };
  }

  if (typeof mutableRepository.deleteTelegramBotProfile !== 'function') {
    mutableRepository.deleteTelegramBotProfile = (id) => {
      mutableRepository.__fallbackTelegramBotProfiles = (mutableRepository.__fallbackTelegramBotProfiles ?? [])
        .filter((profile) => profile.id !== id);
    };
  }

  if (typeof mutableRepository.listTelegramDeliveryLogs !== 'function') {
    mutableRepository.listTelegramDeliveryLogs = (limit = 50) => (
      mutableRepository.__fallbackTelegramDeliveryLogs ?? []
    )
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, Math.floor(limit)))
      .map((log) => structuredClone(log));
  }

  if (typeof mutableRepository.saveTelegramDeliveryLog !== 'function') {
    mutableRepository.saveTelegramDeliveryLog = (log) => {
      const rows = mutableRepository.__fallbackTelegramDeliveryLogs ?? [];
      const index = rows.findIndex((item) => item.id === log.id);
      if (index >= 0) {
        rows[index] = structuredClone(log);
      } else {
        rows.push(structuredClone(log));
      }
      mutableRepository.__fallbackTelegramDeliveryLogs = rows;
    };
  }

  if (typeof mutableRepository.getTelegramSignalWatchState !== 'function') {
    mutableRepository.getTelegramSignalWatchState = (key) => {
      const watchState = (mutableRepository.__fallbackTelegramSignalWatchStates ?? [])
        .find((item) => item.key === key);
      return watchState ? structuredClone(watchState) : null;
    };
  }

  if (typeof mutableRepository.saveTelegramSignalWatchState !== 'function') {
    mutableRepository.saveTelegramSignalWatchState = (watchState) => {
      const rows = mutableRepository.__fallbackTelegramSignalWatchStates ?? [];
      const index = rows.findIndex((item) => item.key === watchState.key);
      if (index >= 0) {
        rows[index] = structuredClone(watchState);
      } else {
        rows.push(structuredClone(watchState));
      }
      mutableRepository.__fallbackTelegramSignalWatchStates = rows;
    };
  }

  if (typeof mutableRepository.listSignalEvents !== 'function') {
    mutableRepository.listSignalEvents = (limit = 100) => (
      mutableRepository.__fallbackSignalEvents ?? []
    )
      .slice()
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, Math.floor(limit)))
      .map((event) => structuredClone(event));
  }

  if (typeof mutableRepository.saveSignalEvent !== 'function') {
    mutableRepository.saveSignalEvent = (event) => {
      const rows = mutableRepository.__fallbackSignalEvents ?? [];
      const index = rows.findIndex((item) => item.id === event.id);
      if (index >= 0) {
        rows[index] = structuredClone(event);
      } else {
        rows.push(structuredClone(event));
      }
      mutableRepository.__fallbackSignalEvents = rows;
    };
  }

  if (
    typeof mutableRepository.getSupportMessageById !== 'function' &&
    typeof mutableRepository.listSupportThreads === 'function' &&
    typeof mutableRepository.listSupportMessagesByThreadId === 'function'
  ) {
    mutableRepository.getSupportMessageById = (id) => {
      for (const thread of mutableRepository.listSupportThreads()) {
        const message = mutableRepository
          .listSupportMessagesByThreadId(thread.id)
          .find((item) => item.id === id);
        if (message) return structuredClone(message);
      }
      return null;
    };
  }

  if (
    typeof mutableRepository.deleteSupportMessagesByThreadId !== 'function' &&
    typeof mutableRepository.listSupportMessagesByThreadId === 'function' &&
    typeof mutableRepository.deleteSupportMessage === 'function'
  ) {
    mutableRepository.deleteSupportMessagesByThreadId = (threadId) => {
      mutableRepository
        .listSupportMessagesByThreadId(threadId)
        .forEach((message) => mutableRepository.deleteSupportMessage(message.id));
    };
  }

  if (
    typeof mutableRepository.deleteSupportMessage !== 'function' &&
    typeof mutableRepository.getSupportMessageById === 'function' &&
    typeof mutableRepository.listSupportMessagesByThreadId === 'function' &&
    typeof mutableRepository.deleteSupportMessagesByThreadId === 'function' &&
    typeof mutableRepository.saveSupportMessage === 'function'
  ) {
    mutableRepository.deleteSupportMessage = (id) => {
      const message = mutableRepository.getSupportMessageById(id);
      if (!message) return;
      const threadMessages = mutableRepository.listSupportMessagesByThreadId(message.threadId);
      mutableRepository.deleteSupportMessagesByThreadId(message.threadId);
      threadMessages
        .filter((item) => item.id !== id)
        .forEach((item) => mutableRepository.saveSupportMessage(item));
    };
  }
}
