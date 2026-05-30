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
  PaymentTransferSettingsRecord,
  PublicBoardPostRecord,
  SalesTeamRecord,
  SignupAgreementRecord,
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
    typeof persistence.repository.getPaymentTransferSettings === 'function' &&
    typeof persistence.repository.savePaymentTransferSettings === 'function' &&
    typeof persistence.repository.listPublicBoardPosts === 'function' &&
    typeof persistence.repository.savePublicBoardPost === 'function' &&
    typeof persistence.repository.listSignupAgreementsByUserId === 'function' &&
    typeof persistence.repository.saveSignupAgreement === 'function' &&
    typeof persistence.repository.getChartUserSettings === 'function' &&
    typeof persistence.repository.saveChartUserSettings === 'function' &&
    typeof persistence.repository.getSupportMessageById === 'function' &&
    typeof persistence.repository.listSupportMessagesByThreadId === 'function' &&
    typeof persistence.repository.deleteSupportMessage === 'function' &&
    typeof persistence.repository.deleteSupportMessagesByThreadId === 'function';
}

function hasMemoryRepositoryCapabilities(repository: ChartServiceRepository): boolean {
  return typeof repository.getSupportMessageById === 'function' &&
    typeof repository.getChartUserSettings === 'function' &&
    typeof repository.saveChartUserSettings === 'function' &&
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
  copyRecords(source.listSupportThreads, target.saveSupportThread);
  copyRecords(source.listAuditLogs, target.appendAuditLog);
  copyRecords(() => source.listEmailOutboxRecords?.() ?? [], target.saveEmailOutboxRecord);

  const users = readRecords(source.listUsers);
  users.forEach((user) => {
    copyRecords(() => source.listSessionsByUserId?.(user.id) ?? [], target.saveSession);
    copyRecords(() => source.listNotificationsByUserId?.(user.id) ?? [], target.saveNotification);
    copyRecords(() => source.listSignupAgreementsByUserId?.(user.id) ?? [], target.saveSignupAgreement);
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
  const paymentSettings = readOptionalRecord(source.getPaymentTransferSettings);
  if (paymentSettings) target.savePaymentTransferSettings(paymentSettings);
  const webInfoSettings = readOptionalRecord(source.getWebInfoSettings);
  if (webInfoSettings) target.saveWebInfoSettings(webInfoSettings);
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
    __fallbackChartUserSettings?: ChartUserSettingsRecord[];
    __fallbackPaymentTransferSettings?: PaymentTransferSettingsRecord | null;
    __fallbackPublicBoardPosts?: PublicBoardPostRecord[];
    __fallbackSignupAgreements?: SignupAgreementRecord[];
  };

  mutableRepository.__fallbackSalesTeams ??= [];
  mutableRepository.__fallbackChartUserSettings ??= [];
  mutableRepository.__fallbackPaymentTransferSettings ??= null;
  mutableRepository.__fallbackPublicBoardPosts ??= getDefaultPublicBoardPosts();
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
