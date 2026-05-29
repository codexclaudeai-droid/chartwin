import { validatePasswordPolicy } from '../src/domain/chart-service/index.ts';

const env = process.env;
const failures = [];

requireExact('NODE_ENV', 'production');
requireExact('CHART_SERVICE_REPOSITORY', 'postgres');
const databaseUrl = requireValue('CHART_SERVICE_DATABASE_URL');
const sslMode = requireValue('CHART_SERVICE_DATABASE_SSL_MODE');
const sessionSecret = requireValue('CHART_SERVICE_SESSION_SECRET');
const emailProvider = requireValue('CHART_SERVICE_EMAIL_PROVIDER');
const emailLimit = requireValue('CHART_SERVICE_EMAIL_DELIVERY_LIMIT');
const adminEmail = requireValue('CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL');
const adminPassword = requireValue('CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD');
const adminName = requireValue('CHART_SERVICE_BOOTSTRAP_ADMIN_NAME');

const redactedDatabaseUrl = validateDatabaseUrl(databaseUrl);
validateSslMode(sslMode);
validateSessionSecret(sessionSecret);
validateEmailDelivery(emailProvider, emailLimit);
validateBootstrapAdmin(adminEmail, adminPassword, adminName);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[PROD ENV FAIL] ${failure}`);
  }
  console.error(`Production environment check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('[PROD ENV PASS] repository: postgres');
console.log(`[PROD ENV PASS] database: ${redactedDatabaseUrl}`);
console.log(`[PROD ENV PASS] ssl mode: ${sslMode}`);
console.log('[PROD ENV PASS] session secret: configured');
console.log(`[PROD ENV PASS] email delivery: ${emailProvider} limit ${emailLimit}`);
console.log(`[PROD ENV PASS] bootstrap admin: ${adminEmail.trim().toLowerCase()}`);
console.log('Production environment check passed.');

function requireValue(key) {
  const value = String(env[key] ?? '').trim();
  if (!value) {
    failures.push(`${key} is required.`);
  } else if (isPlaceholder(value)) {
    failures.push(`${key} still contains a placeholder value.`);
  }
  return value;
}

function requireExact(key, expected) {
  const value = requireValue(key);
  if (value && value !== expected) {
    failures.push(`${key} must be ${expected}.`);
  }
}

function validateDatabaseUrl(value) {
  if (!value || isPlaceholder(value)) return '<invalid-database-url>';

  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      failures.push('CHART_SERVICE_DATABASE_URL must use postgres:// or postgresql://.');
    }
    return redactDatabaseUrl(url);
  } catch {
    failures.push('CHART_SERVICE_DATABASE_URL must be a valid URL.');
    return '<invalid-database-url>';
  }
}

function validateSslMode(value) {
  if (!['require', 'verify-ca', 'verify-full'].includes(value)) {
    failures.push('CHART_SERVICE_DATABASE_SSL_MODE must be require, verify-ca, or verify-full.');
  }
}

function validateSessionSecret(value) {
  if (value.length < 32) {
    failures.push('CHART_SERVICE_SESSION_SECRET must be at least 32 characters.');
  }
  if (value === '0123456789abcdef0123456789abcdef') {
    failures.push('CHART_SERVICE_SESSION_SECRET must not use the documented sample value.');
  }
}

function validateEmailDelivery(provider, limitValue) {
  if (provider !== 'log') {
    failures.push('CHART_SERVICE_EMAIL_PROVIDER must be log until an external provider is wired.');
  }

  const limit = Number(limitValue);
  if (!Number.isInteger(limit) || limit < 0) {
    failures.push('CHART_SERVICE_EMAIL_DELIVERY_LIMIT must be a non-negative integer.');
  }
}

function validateBootstrapAdmin(email, password, name) {
  if (email && !email.includes('@')) {
    failures.push('CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL must be an email address.');
  }
  if (!name.trim()) {
    failures.push('CHART_SERVICE_BOOTSTRAP_ADMIN_NAME is required for first-launch verification.');
  }
  if (password === 'Owner1234!') {
    failures.push('CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD must not use the documented sample value.');
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.ok) {
    failures.push(`CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD is missing: ${policy.missing.join(', ')}.`);
  }
}

function isPlaceholder(value) {
  return /^<[^>]+>$/.test(value) || value.includes('replace-with');
}

function redactDatabaseUrl(url) {
  const redacted = new URL(url.toString());
  redacted.username = '';
  redacted.password = '';
  redacted.search = '';
  return redacted.toString().replace('//', '//');
}
