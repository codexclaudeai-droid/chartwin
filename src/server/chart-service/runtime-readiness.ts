import {
  resolveChartServiceRepositoryAdapter,
  type ResolvedChartServiceRepositoryAdapter,
  type ChartServiceRepositoryRuntimeEnv,
} from './repository-adapter.ts';
import {
  isPostgresSslModeProductionSafe,
  type PostgresSslMode,
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
    const sslStatus = connection && mode === 'production' && !isPostgresSslModeProductionSafe(connection.sslMode)
      ? 'fail'
      : connection && isPostgresSslModeProductionSafe(connection.sslMode)
        ? 'pass'
        : 'warn';
    checks.push({
      key: 'database_ssl',
      label: 'Database SSL',
      status: sslStatus,
      message: connection
        ? renderDatabaseSslMessage(connection.sslMode, mode)
        : 'Database SSL mode cannot be checked without a valid database URL.',
    });
    checks.push({
      key: 'postgres_mapping_contract',
      label: 'Postgres mapping contract',
      status: 'pass',
      message: 'Postgres row mappers and parameterized SQL builders are available.',
    });
    checks.push({
      key: 'repository_adapter_implementation',
      label: 'Repository implementation',
      status: 'fail',
      message: 'Postgres async repository implementation is available, but the runtime query executor/client binding is not installed yet.',
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

function renderDatabaseSslMessage(sslMode: PostgresSslMode, mode: ChartServiceRuntimeMode): string {
  if (mode === 'production' && !isPostgresSslModeProductionSafe(sslMode)) {
    return `Postgres SSL mode "${sslMode}" is unsafe for production. Use require, verify-ca, or verify-full.`;
  }
  if (isPostgresSslModeProductionSafe(sslMode)) {
    return `Postgres SSL mode "${sslMode}" is configured.`;
  }

  return `Postgres SSL mode "${sslMode}" is acceptable only for local development and tests.`;
}

function getRuntimeEnv(): ChartServiceRuntimeEnv {
  return ((globalThis as typeof globalThis & {
    process?: { env?: ChartServiceRuntimeEnv };
  }).process?.env) ?? {};
}
