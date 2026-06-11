import {
  getChartServiceRepositoryConfigFromEnv,
  resolveChartServiceRepositoryAdapter,
  type ResolvedChartServiceRepositoryAdapter,
  type ChartServiceRepositoryRuntimeEnv,
} from './repository-adapter.ts';
import {
  isCloudflareHyperdriveConnection,
  isPostgresSslModeProductionSafe,
  type PostgresSslMode,
  type PostgresConnectionSettings,
} from './postgres-connection.ts';

export type ChartServiceRuntimeMode = 'development' | 'test' | 'production';

export type RuntimeReadinessCheck = {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
};

export type ChartServiceRuntimeReadiness = {
  ok: boolean;
  mode: ChartServiceRuntimeMode;
  repository: {
    kind: string;
    isPersistent: boolean;
    label: string;
  };
  checks: RuntimeReadinessCheck[];
};

export type ChartServiceRuntimeEnv = ChartServiceRepositoryRuntimeEnv & {
  NODE_ENV?: string;
  CHART_SERVICE_SESSION_SECRET?: string;
  CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL?: string;
  CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD?: string;
  CHART_SERVICE_BOOTSTRAP_ADMIN_NAME?: string;
};

type RuntimeRepositorySelection = ResolvedChartServiceRepositoryAdapter | {
  kind: 'unknown';
  isPersistent: false;
  label: string;
  connection?: undefined;
};

export function getChartServiceRuntimeReadiness(
  env: ChartServiceRuntimeEnv = getRuntimeEnv(),
): ChartServiceRuntimeReadiness {
  const mode = normalizeMode(env.NODE_ENV);
  const checks: RuntimeReadinessCheck[] = [];
  let repository: RuntimeRepositorySelection = {
    kind: 'unknown',
    isPersistent: false,
    label: 'Unresolved repository adapter',
  };

  try {
    repository = resolveChartServiceRepositoryAdapter({
      adapter: env.CHART_SERVICE_REPOSITORY,
      databaseUrl: env.CHART_SERVICE_DATABASE_URL,
      databaseSslMode: env.CHART_SERVICE_DATABASE_SSL_MODE,
      runtimeTarget: env.CHART_SERVICE_RUNTIME_TARGET,
      runtimeMode: mode,
    });
    checks.push({
      key: 'repository_adapter',
      label: 'Repository adapter',
      status: 'pass',
      message: `${repository.label} selected.`,
    });
  } catch (error) {
    checks.push({
      key: 'repository_adapter',
      label: 'Repository adapter',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Repository adapter could not be resolved.',
    });
  }

  if (mode === 'production' && !repository.isPersistent) {
    checks.push({
      key: 'persistent_repository',
      label: 'Persistent repository',
      status: 'fail',
      message: 'Production must not use the in-memory repository.',
    });
  } else {
    checks.push({
      key: 'persistent_repository',
      label: 'Persistent repository',
      status: repository.isPersistent ? 'pass' : 'warn',
      message: repository.isPersistent
        ? 'Persistent repository is configured.'
        : 'In-memory repository is acceptable only for local development and tests.',
    });
  }
  checks.push(getSessionSecretCheck(env.CHART_SERVICE_SESSION_SECRET, mode));

  if (repository.kind === 'postgres') {
    const connection = repository.connection;
    checks.push({
      key: 'database_url',
      label: 'Database URL',
      status: connection ? 'pass' : 'fail',
      message: connection
        ? `Database URL is configured for ${connection.safeLabel}.`
        : 'CHART_SERVICE_DATABASE_URL is required.',
    });
    const sslStatus = connection ? getDatabaseSslStatus(connection, mode) : 'fail';
    checks.push({
      key: 'database_ssl',
      label: 'Database SSL',
      status: sslStatus,
      message: connection
        ? renderDatabaseSslMessage(connection, mode)
        : 'Database SSL mode cannot be checked without a valid database URL.',
    });
    checks.push({
      key: 'postgres_mapping_contract',
      label: 'Postgres mapping contract',
      status: 'pass',
      message: 'Postgres row mappers and parameterized SQL builders are available.',
    });
    checks.push({
      key: 'postgres_schema_migration_harness',
      label: 'Postgres schema migration harness',
      status: 'pass',
      message: 'Postgres schema migration runner and deployment script are available.',
    });
    checks.push({
      key: 'postgres_bootstrap_harness',
      label: 'Postgres bootstrap harness',
      status: 'pass',
      message: 'Default plan seed and initial admin bootstrap script are available.',
    });
    checks.push(getBootstrapAdminCredentialsCheck(env, mode));
    checks.push({
      key: 'postgres_transaction_boundary',
      label: 'Postgres transaction boundary',
      status: 'pass',
      message: 'Postgres mutations can run through a transaction-scoped repository executor.',
    });
    checks.push({
      key: 'transactional_email_outbox',
      label: 'Transactional email outbox',
      status: 'pass',
      message: 'Password reset emails can be queued in a repository-backed delivery outbox.',
    });
    checks.push({
      key: 'transactional_email_dispatch_harness',
      label: 'Transactional email dispatch harness',
      status: 'pass',
      message: 'Queued email delivery can be run through npm run service:email:deliver.',
    });
    checks.push({
      key: 'repository_adapter_implementation',
      label: 'Repository implementation',
      status: 'pass',
      message: 'Postgres async repository implementation and pg runtime client binding are available.',
    });
  } else {
    checks.push({
      key: 'repository_adapter_implementation',
      label: 'Repository implementation',
      status: 'pass',
      message: 'Memory repository implementation is available.',
    });
  }
  checks.push({
    key: 'async_repository_boundary',
    label: 'Async repository boundary',
    status: 'pass',
    message: 'Repository operations can run through an async persistence boundary.',
  });

  return {
    ok: checks.every((check) => check.status !== 'fail'),
    mode,
    repository,
    checks,
  };
}

function getBootstrapAdminCredentialsCheck(
  env: ChartServiceRuntimeEnv,
  mode: ChartServiceRuntimeMode,
): RuntimeReadinessCheck {
  const email = env.CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL?.trim() ?? '';
  const password = env.CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD ?? '';
  const name = env.CHART_SERVICE_BOOTSTRAP_ADMIN_NAME?.trim() ?? '';
  const hasAnyCredential = Boolean(email || password || name);

  if (email && password && name) {
    return {
      key: 'bootstrap_admin_credentials',
      label: 'Initial admin bootstrap credentials',
      status: 'pass',
      message: 'Initial admin bootstrap email, password, and display name are configured.',
    };
  }

  if (hasAnyCredential) {
    return {
      key: 'bootstrap_admin_credentials',
      label: 'Initial admin bootstrap credentials',
      status: 'warn',
      message: 'Initial admin bootstrap requires email and password, and a display name is recommended.',
    };
  }

  return {
    key: 'bootstrap_admin_credentials',
    label: 'Initial admin bootstrap credentials',
    status: 'warn',
    message: mode === 'production'
      ? 'Initial admin bootstrap credentials are not configured. Skip only if the first super admin already exists.'
      : 'Initial admin bootstrap credentials are optional for local development.',
  };
}

function getSessionSecretCheck(
  secret: string | undefined,
  mode: ChartServiceRuntimeMode,
): RuntimeReadinessCheck {
  const normalized = secret?.trim() ?? '';
  if (normalized.length >= 32) {
    return {
      key: 'session_secret',
      label: 'Session signing secret',
      status: 'pass',
      message: 'CHART_SERVICE_SESSION_SECRET is configured.',
    };
  }

  if (mode === 'production') {
    return {
      key: 'session_secret',
      label: 'Session signing secret',
      status: 'fail',
      message: 'CHART_SERVICE_SESSION_SECRET must be set to at least 32 characters in production.',
    };
  }

  return {
    key: 'session_secret',
    label: 'Session signing secret',
    status: 'warn',
    message: 'Local development is using the built-in session signing secret.',
  };
}

function normalizeMode(value: string | undefined): ChartServiceRuntimeMode {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

function getDatabaseSslStatus(
  connection: PostgresConnectionSettings,
  mode: ChartServiceRuntimeMode,
): RuntimeReadinessCheck['status'] {
  if (isCloudflareHyperdriveConnection(connection)) return 'pass';
  if (mode === 'production' && !isPostgresSslModeProductionSafe(connection.sslMode)) return 'fail';
  if (isPostgresSslModeProductionSafe(connection.sslMode)) return 'pass';
  return 'warn';
}

function renderDatabaseSslMessage(
  connection: PostgresConnectionSettings,
  mode: ChartServiceRuntimeMode,
): string {
  const sslMode = connection.sslMode;
  if (isCloudflareHyperdriveConnection(connection)) {
    return 'Cloudflare Hyperdrive local binding is configured without app-level SSL; origin SSL is managed by Hyperdrive.';
  }
  if (mode === 'production' && !isPostgresSslModeProductionSafe(sslMode)) {
    return `Postgres SSL mode "${sslMode}" is unsafe for production. Use require, verify-ca, or verify-full.`;
  }
  if (isPostgresSslModeProductionSafe(sslMode)) {
    return `Postgres SSL mode "${sslMode}" is configured.`;
  }

  return `Postgres SSL mode "${sslMode}" is acceptable only for local development and tests.`;
}

function getRuntimeEnv(): ChartServiceRuntimeEnv {
  const processEnv: ChartServiceRuntimeEnv = ((globalThis as typeof globalThis & {
    process?: { env?: ChartServiceRuntimeEnv };
  }).process?.env) ?? {};
  const repositoryConfig = getChartServiceRepositoryConfigFromEnv();

  return {
    ...processEnv,
    CHART_SERVICE_REPOSITORY: repositoryConfig.adapter ?? processEnv.CHART_SERVICE_REPOSITORY,
    CHART_SERVICE_DATABASE_URL: repositoryConfig.databaseUrl ?? processEnv.CHART_SERVICE_DATABASE_URL,
    CHART_SERVICE_DATABASE_SSL_MODE: repositoryConfig.databaseSslMode ?? processEnv.CHART_SERVICE_DATABASE_SSL_MODE,
    CHART_SERVICE_RUNTIME_TARGET: repositoryConfig.runtimeTarget ?? processEnv.CHART_SERVICE_RUNTIME_TARGET,
  };
}
