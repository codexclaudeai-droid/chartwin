import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('post-deploy smoke is wired into package scripts and runbook', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const script = fs.readFileSync(new URL('../scripts/run-chart-service-postdeploy-smoke.mjs', import.meta.url), 'utf8');
  const runbook = fs.readFileSync(new URL('../docs/04-deploy/chart-service-deployment-runbook.md', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['service:postdeploy:smoke'], 'node scripts/run-chart-service-postdeploy-smoke.mjs');
  assert.match(script, /CHART_SERVICE_BASE_URL/);
  assert.match(script, /\/api\/health/);
  assert.match(script, /\/api\/auth\/login/);
  assert.match(script, /\/api\/admin\/dashboard/);
  assert.match(runbook, /npm\.cmd run service:postdeploy:smoke/);
});

test('post-deploy smoke checks health, admin login, and protected admin API without leaking credentials', async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      cookie: request.headers.cookie ?? '',
      origin: request.headers.origin ?? '',
    });

    if (request.method === 'GET' && request.url === '/api/health') {
      writeJson(response, 200, { ok: true, repository: { kind: 'postgres' }, checks: [] });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/auth/login') {
      const body = await readJson(request);
      assert.equal(body.email, 'owner@tradingcore.test');
      assert.equal(body.password, 'ProdAdmin1234!');
      response.setHeader('Set-Cookie', 'tc_chart_session=session_1; Path=/; HttpOnly');
      writeJson(response, 200, { ok: true, user: { id: 'admin_1', role: 'super_admin' } });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/admin/dashboard') {
      assert.match(request.headers.cookie ?? '', /tc_chart_session=session_1/);
      writeJson(response, 200, { ok: true, summary: { pendingPayments: 0 } });
      return;
    }

    writeJson(response, 404, { ok: false });
  });
  await listen(server);

  try {
    const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-postdeploy-smoke.mjs', import.meta.url));
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        CHART_SERVICE_BASE_URL: `http://127.0.0.1:${server.address().port}`,
        CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
        CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
      },
    });

    assert.match(stdout, /\[POSTDEPLOY PASS\] health/);
    assert.match(stdout, /\[POSTDEPLOY PASS\] admin login/);
    assert.match(stdout, /\[POSTDEPLOY PASS\] admin dashboard/);
    assert.match(stdout, /TradingCore post-deploy smoke passed/);
    assert.doesNotMatch(stdout, /ProdAdmin1234!/);
    assert.equal(requests[1].origin, `http://127.0.0.1:${server.address().port}`);
  } finally {
    await close(server);
  }
});

test('post-deploy smoke fails when health leaks database secrets', async () => {
  const server = http.createServer((_request, response) => {
    writeJson(response, 200, { ok: true, databaseUrl: 'postgres://user:secret@db/chart' });
  });
  await listen(server);

  try {
    const scriptPath = fileURLToPath(new URL('../scripts/run-chart-service-postdeploy-smoke.mjs', import.meta.url));
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    await assert.rejects(
      execFileAsync(process.execPath, [scriptPath], {
        cwd,
        env: {
          ...process.env,
          CHART_SERVICE_BASE_URL: `http://127.0.0.1:${server.address().port}`,
          CHART_SERVICE_BOOTSTRAP_ADMIN_EMAIL: 'owner@tradingcore.test',
          CHART_SERVICE_BOOTSTRAP_ADMIN_PASSWORD: 'ProdAdmin1234!',
        },
      }),
      /health payload must not expose database connection strings/,
    );
  } finally {
    await close(server);
  }
});

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
