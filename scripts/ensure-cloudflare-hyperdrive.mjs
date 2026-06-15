import fs from 'node:fs';
import path from 'node:path';

const hyperdriveName = process.env.CLOUDFLARE_HYPERDRIVE_NAME || 'tradingcore-hyperdrive';
const bindingName = process.env.CLOUDFLARE_HYPERDRIVE_BINDING || 'HYPERDRIVE';
const configuredHyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID?.trim();
const shouldSyncOrigin = process.env.CLOUDFLARE_HYPERDRIVE_SYNC_ORIGIN === 'true';

const hyperdrive = configuredHyperdriveId
  ? { id: configuredHyperdriveId }
  : await ensureHyperdriveConfig(hyperdriveName, normalizeSupabaseDirectUrl(requireEnv('CHART_SERVICE_DATABASE_URL')));

patchWranglerConfig(hyperdrive.id, bindingName);
console.log(`[HYPERDRIVE READY] ${hyperdriveName} (${hyperdrive.id}) bound as ${bindingName}.`);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function cloudflareRequest(method, apiPath, body) {
  const apiToken = requireEnv('CLOUDFLARE_API_TOKEN');
  const response = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`Cloudflare API ${method} ${apiPath} failed: ${message}`);
  }
  return payload.result;
}

async function findHyperdriveByName(name) {
  const result = await cloudflareRequest('GET', `${getCloudflareAccountPath()}/hyperdrive/configs`);
  return result?.find((config) => config.name === name) ?? null;
}

async function ensureHyperdriveConfig(name, url) {
  const existingConfig = await findHyperdriveByName(name);
  if (!existingConfig) return await createHyperdrive(name, url);
  if (!shouldSyncOrigin) return existingConfig;
  return await updateHyperdrive(existingConfig.id, name, url);
}

async function createHyperdrive(name, url) {
  return await cloudflareRequest('POST', `${getCloudflareAccountPath()}/hyperdrive/configs`, {
    name,
    origin: {
      scheme: normalizeScheme(url.protocol),
      host: url.hostname,
      port: Number(url.port || '5432'),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    },
    mtls: {
      sslmode: 'require',
    },
    caching: {
      disabled: true,
    },
    origin_connection_limit: 5,
  });
}

async function updateHyperdrive(id, name, url) {
  const updated = await cloudflareRequest('PATCH', `${getCloudflareAccountPath()}/hyperdrive/configs/${id}`, {
    name,
    origin: {
      scheme: normalizeScheme(url.protocol),
      host: url.hostname,
      port: Number(url.port || '5432'),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    },
    mtls: {
      sslmode: 'require',
    },
    caching: {
      disabled: true,
    },
    origin_connection_limit: 5,
  });
  console.log(`[HYPERDRIVE UPDATED] ${name} (${id}) origin synchronized.`);
  return updated;
}

function getCloudflareAccountPath() {
  return `/accounts/${requireEnv('CLOUDFLARE_ACCOUNT_ID')}`;
}

function normalizeSupabaseDirectUrl(connectionString) {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith('.pooler.supabase.com')) return url;

  const projectRef = getSupabaseProjectRefFromPoolerUser(url.username);
  if (!projectRef) return url;

  const directUrl = new URL(url.toString());
  directUrl.hostname = `db.${projectRef}.supabase.co`;
  directUrl.username = 'postgres';
  directUrl.port = '5432';
  return directUrl;
}

function getSupabaseProjectRefFromPoolerUser(username) {
  const match = /^postgres\.([a-z0-9-]+)$/i.exec(decodeURIComponent(username));
  return match?.[1] ?? null;
}

function normalizeScheme(protocol) {
  const scheme = protocol.replace(/:$/, '').toLowerCase();
  if (scheme === 'postgres' || scheme === 'postgresql') return scheme;
  throw new Error(`Unsupported database protocol for Hyperdrive: ${protocol}`);
}

function patchWranglerConfig(hyperdriveId, binding) {
  const configPath = path.resolve('wrangler.jsonc');
  const config = JSON.parse(stripJsoncComments(fs.readFileSync(configPath, 'utf8')));
  config.hyperdrive = [
    {
      binding,
      id: hyperdriveId,
    },
  ];
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function stripJsoncComments(source) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      output += '\n';
      continue;
    }

    output += char;
  }

  return output;
}
