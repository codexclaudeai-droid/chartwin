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
    typeof persistence.repository.getSupportMessageById === 'function' &&
    typeof persistence.repository.listSupportMessagesByThreadId === 'function' &&
    typeof persistence.repository.deleteSupportMessage === 'function' &&
    typeof persistence.repository.deleteSupportMessagesByThreadId === 'function';
}

function ensureMemoryRepositoryCapabilities(repository: ChartServiceRepository): void {
  const mutableRepository = repository as ChartServiceRepository & {
    __fallbackSalesTeams?: SalesTeamRecord[];
    __fallbackPaymentTransferSettings?: PaymentTransferSettingsRecord | null;
    __fallbackPublicBoardPosts?: PublicBoardPostRecord[];
    __fallbackSignupAgreements?: SignupAgreementRecord[];
  };

  mutableRepository.__fallbackSalesTeams ??= [];
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
