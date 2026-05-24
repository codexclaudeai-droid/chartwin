export type PostgresRuntimeMode = 'development' | 'test' | 'production';

export type PostgresSslMode = 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';

export type PostgresConnectionSettingsInput = {
  databaseUrl?: string | null;
  databaseSslMode?: string | null;
  runtimeMode?: string | null;
};

export type PostgresConnectionSettings = {
  connectionString: string;
  protocol: 'postgres' | 'postgresql';
  host: string;
  port: string | null;
  databaseName: string;
  sslMode: PostgresSslMode;
  hasCredentials: boolean;
  safeLabel: string;
};

const POSTGRES_SSL_MODES: readonly PostgresSslMode[] = [
  'disable',
  'allow',
  'prefer',
  'require',
  'verify-ca',
  'verify-full',
];

const PRODUCTION_SAFE_SSL_MODES: readonly PostgresSslMode[] = [
  'require',
  'verify-ca',
  'verify-full',
];

export function resolvePostgresConnectionSettings(
  input: PostgresConnectionSettingsInput,
): PostgresConnectionSettings {
  const connectionString = input.databaseUrl?.trim();
  if (!connectionString) {
    throw new Error('CHART_SERVICE_DATABASE_URL is required.');
  }

  const url = parsePostgresUrl(connectionString);
  const protocol = normalizePostgresProtocol(url.protocol);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, '').trim());
  if (!databaseName) {
    throw new Error('CHART_SERVICE_DATABASE_URL must include a database name.');
  }

  const runtimeMode = normalizeRuntimeMode(input.runtimeMode);
  const sslMode = normalizePostgresSslMode(
    input.databaseSslMode ?? url.searchParams.get('sslmode'),
    runtimeMode === 'production' ? 'require' : 'prefer',
  );

  const portPart = url.port ? `:${url.port}` : '';
  const safeLabel = `${protocol}://${url.hostname}${portPart}/${databaseName}?sslmode=${sslMode}`;

  const settings = {
    protocol,
    host: url.hostname,
    port: url.port || null,
    databaseName,
    sslMode,
    hasCredentials: Boolean(url.username || url.password),
    safeLabel,
  } as PostgresConnectionSettings;

  Object.defineProperty(settings, 'connectionString', {
    value: connectionString,
    enumerable: false,
  });

  return settings;
}

export function isPostgresSslModeProductionSafe(sslMode: PostgresSslMode): boolean {
  return PRODUCTION_SAFE_SSL_MODES.includes(sslMode);
}

export function getPostgresConnectionSignature(settings: PostgresConnectionSettings): string {
  return `${settings.safeLabel}:${hashSensitiveValue(settings.connectionString)}`;
}

function parsePostgresUrl(connectionString: string): URL {
  try {
    return new URL(connectionString);
  } catch {
    throw new Error('CHART_SERVICE_DATABASE_URL must be a valid postgres connection URL.');
  }
}

function normalizePostgresProtocol(protocol: string): PostgresConnectionSettings['protocol'] {
  const normalized = protocol.replace(/:$/, '').toLowerCase();
  if (normalized === 'postgres' || normalized === 'postgresql') {
    return normalized;
  }

  throw new Error('CHART_SERVICE_DATABASE_URL must be a postgres connection URL.');
}

function normalizePostgresSslMode(value: string | null | undefined, fallback: PostgresSslMode): PostgresSslMode {
  const normalized = value?.trim().toLowerCase() || fallback;
  if (POSTGRES_SSL_MODES.includes(normalized as PostgresSslMode)) {
    return normalized as PostgresSslMode;
  }

  throw new Error(`Unsupported CHART_SERVICE_DATABASE_SSL_MODE: ${value}`);
}

function normalizeRuntimeMode(value: string | null | undefined): PostgresRuntimeMode {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

function hashSensitiveValue(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
