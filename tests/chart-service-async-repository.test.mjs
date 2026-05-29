import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAsyncChartServicePersistence,
  createAsyncChartServiceRepository,
  createMockChartServiceRepository,
  getAsyncChartServicePersistence,
  getChartServiceRepositoryConfigSignature,
  getChartServiceRepository,
  getChartServiceRuntimeReadiness,
} from '../src/server/chart-service/index.ts';

test('async repository wrapper exposes sync memory records through awaited methods', async () => {
  const repository = createMockChartServiceRepository();
  const asyncRepository = createAsyncChartServiceRepository(repository);

  await asyncRepository.saveUser({
    id: 'user_async',
    email: 'async@example.com',
    name: 'Async Member',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'pbkdf2_sha256$1$test$test',
  });

  const userById = await asyncRepository.getUserById('user_async');
  const userByEmail = await asyncRepository.getUserByEmail('ASYNC@example.com');
  const users = await asyncRepository.listUsers();

  assert.equal(userById?.name, 'Async Member');
  assert.equal(userByEmail?.id, 'user_async');
  assert.equal(users.some((user) => user.id === 'user_async'), true);
});

test('async persistence scope runs read and mutation operations through one boundary', async () => {
  const persistence = createAsyncChartServicePersistence(createMockChartServiceRepository());

  const createdUser = await persistence.runMutation(async (repository) => {
    await repository.saveUser({
      id: 'user_scope',
      email: 'scope@example.com',
      name: 'Scoped Member',
      role: 'member',
      accountStatus: 'active',
      passwordHash: 'pbkdf2_sha256$1$test$test',
    });

    return repository.getUserById('user_scope');
  });
  const readUser = await persistence.runRead((repository) => repository.getUserById('user_scope'));

  assert.equal(createdUser?.email, 'scope@example.com');
  assert.equal(readUser?.name, 'Scoped Member');
});

test('runtime readiness reports async repository boundary as available', () => {
  const readiness = getChartServiceRuntimeReadiness({
    NODE_ENV: 'development',
    CHART_SERVICE_REPOSITORY: 'memory',
  });

  assert.equal(
    readiness.checks.some((check) => check.key === 'async_repository_boundary' && check.status === 'pass'),
    true,
  );
});

test('global async persistence singleton is keyed by repository config', async () => {
  const env = { CHART_SERVICE_REPOSITORY: 'memory' };
  const first = getAsyncChartServicePersistence(env);
  const second = getAsyncChartServicePersistence(env);

  await first.repository.saveUser({
    id: 'user_async_singleton',
    email: 'singleton@example.com',
    name: 'Singleton User',
    role: 'member',
    accountStatus: 'active',
    passwordHash: 'pbkdf2_sha256$1$test$test',
  });

  assert.equal(first, second);
  assert.equal((await second.repository.getUserById('user_async_singleton'))?.name, 'Singleton User');
});

test('global async persistence shares memory state with the sync repository singleton', async () => {
  const env = { CHART_SERVICE_REPOSITORY: 'memory' };
  const syncRepository = getChartServiceRepository(env);
  const asyncPersistence = getAsyncChartServicePersistence(env);

  syncRepository.saveSession({
    id: 'session_shared_boundary',
    userId: 'user_subscriber',
    createdAt: '2026-05-24T00:00:00.000Z',
    expiresAt: '2026-05-25T00:00:00.000Z',
  });

  const session = await asyncPersistence.repository.getSessionById('session_shared_boundary');

  assert.equal(session?.userId, 'user_subscriber');
});

test('global memory persistence repairs stale repository singletons after new methods are added', async () => {
  const env = { CHART_SERVICE_REPOSITORY: 'memory' };
  const globals = globalThis;
  const previousSync = globals.__chartServiceRepository;
  const previousSyncSignature = globals.__chartServiceRepositorySignature;
  const previousAsync = globals.__asyncChartServicePersistence;
  const previousAsyncSignature = globals.__asyncChartServicePersistenceSignature;
  const staleRepository = {
    ...createMockChartServiceRepository(),
  };

  delete staleRepository.listSalesTeams;
  delete staleRepository.saveSalesTeam;
  delete staleRepository.getPaymentTransferSettings;
  delete staleRepository.savePaymentTransferSettings;
  delete staleRepository.listSignupAgreementsByUserId;
  delete staleRepository.saveSignupAgreement;

  try {
    globals.__chartServiceRepository = staleRepository;
    globals.__chartServiceRepositorySignature = getChartServiceRepositoryConfigSignature(env);
    globals.__asyncChartServicePersistence = undefined;
    globals.__asyncChartServicePersistenceSignature = undefined;

    const persistence = getAsyncChartServicePersistence(env);
    const teams = await persistence.repository.listSalesTeams();
    const settings = await persistence.repository.getPaymentTransferSettings();
    await persistence.repository.saveSignupAgreement({
      id: 'signup_agreement_repaired',
      userId: 'user_member',
      termsAcceptedAt: '2026-05-27T00:00:00.000Z',
      privacyAcceptedAt: '2026-05-27T00:00:00.000Z',
      termsContent: 'Terms snapshot',
      privacyContent: 'Privacy snapshot',
      termsSettingsUpdatedAt: '2026-05-27T00:00:00.000Z',
      privacySettingsUpdatedAt: '2026-05-27T00:00:00.000Z',
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-05-27T00:00:00.000Z',
    });
    const agreements = await persistence.repository.listSignupAgreementsByUserId('user_member');

    assert.deepEqual(teams, []);
    assert.equal(settings, null);
    assert.equal(agreements.some((agreement) => agreement.id === 'signup_agreement_repaired'), true);
    assert.equal(typeof globals.__chartServiceRepository.listSalesTeams, 'function');
    assert.equal(typeof globals.__chartServiceRepository.saveSalesTeam, 'function');
    assert.equal(typeof globals.__chartServiceRepository.listSignupAgreementsByUserId, 'function');
    assert.equal(typeof globals.__chartServiceRepository.saveSignupAgreement, 'function');
  } finally {
    globals.__chartServiceRepository = previousSync;
    globals.__chartServiceRepositorySignature = previousSyncSignature;
    globals.__asyncChartServicePersistence = previousAsync;
    globals.__asyncChartServicePersistenceSignature = previousAsyncSignature;
  }
});
