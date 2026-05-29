const baseUrl = normalizeBaseUrl(requireEnv('CHART_SERVICE_BASE_URL'));
const adminEmail = requireEnv('CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL').trim().toLowerCase();
const adminPassword = requireEnv('CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD');

const health = await requestJson('/api/health', { method: 'GET' });
if (health.status < 200 || health.status >= 300) {
  fail(`health endpoint returned ${health.status}`);
}
if (health.body?.ok !== true) {
  fail('health endpoint did not report ok=true');
}
const healthPayload = JSON.stringify(health.body);
if (/postgres(?:ql)?:\/\//i.test(healthPayload)) {
  fail('health payload must not expose database connection strings');
}
pass('health');

const login = await requestJson('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: adminEmail,
    password: adminPassword,
  }),
});
if (login.status < 200 || login.status >= 300 || login.body?.ok !== true) {
  fail(`admin login failed with ${login.status}`);
}
if (login.body?.user?.role !== 'admin' && login.body?.user?.role !== 'super_admin') {
  fail('admin login did not return an admin role');
}
const sessionCookie = extractSessionCookie(login.headers);
if (!sessionCookie) {
  fail('admin login did not return a session cookie');
}
pass('admin login');

const dashboard = await requestJson('/api/admin/dashboard', {
  method: 'GET',
  headers: { cookie: sessionCookie },
});
if (dashboard.status < 200 || dashboard.status >= 300 || dashboard.body?.ok !== true) {
  fail(`admin dashboard failed with ${dashboard.status}`);
}
pass('admin dashboard');

console.log('TradingCore post-deploy smoke passed.');

async function requestJson(pathname, init) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...init,
    headers: {
      origin: baseUrl.origin,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    fail(`${pathname} returned non-JSON response`);
  }
  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

function extractSessionCookie(headers) {
  const setCookie = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie().join('; ')
    : headers.get('set-cookie') ?? '';
  const match = setCookie.match(/(?:^|,\s*)(tc_chart_session=[^;,]+)/);
  return match?.[1] ?? '';
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    fail('CHART_SERVICE_BASE_URL must be a valid URL.');
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    fail(`${key} is required.`);
  }
  return String(value);
}

function pass(label) {
  console.log(`[POSTDEPLOY PASS] ${label}`);
}

function fail(message) {
  console.error(`[POSTDEPLOY FAIL] ${message}`);
  process.exit(1);
}
