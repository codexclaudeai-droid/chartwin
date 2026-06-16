import { NextResponse, type NextRequest } from 'next/server.js';
import { assertSuperAdminActor } from '../../../../src/domain/chart-service/index.ts';
import {
  getActorFromAsyncRequest,
  getAdminMutationErrorStatus,
  getAsyncChartServicePersistence,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const adminError = await assertSuperAdminRequest(request);
  if (adminError) return adminError;

  return proxyGatewayJson('/admin/mt45');
}

export async function PATCH(request: NextRequest) {
  const adminError = await assertSuperAdminRequest(request);
  if (adminError) return adminError;

  const body = await request.json().catch(() => ({}));
  return proxyGatewayJson('/admin/mt45', {
    method: 'POST',
    body,
  });
}

async function assertSuperAdminRequest(request: NextRequest) {
  const persistence = getAsyncChartServicePersistence();
  try {
    await persistence.runRead(async (repository) => {
      const actor = await getActorFromAsyncRequest(repository, request, new Date().toISOString());
      assertSuperAdminActor(actor);
    });
    return null;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'unauthorized',
    }, { status: getAdminMutationErrorStatus(error) });
  }
}

async function proxyGatewayJson(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
) {
  const gatewayUrl = getGatewayUrl();
  const adminToken = process.env.DATA_GATEWAY_ADMIN_TOKEN || '';
  if (!gatewayUrl || !adminToken) {
    return NextResponse.json({
      ok: false,
      message: 'DATA_GATEWAY_URL and DATA_GATEWAY_ADMIN_TOKEN are required',
    }, { status: 503 });
  }

  const response = await fetch(new URL(path, gatewayUrl), {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({
    ok: false,
    message: 'invalid gateway response',
  }));
  if (response.status === 401 && String(payload?.message || '').toLowerCase() === 'unauthorized') {
    return NextResponse.json({
      ok: false,
      message: 'data gateway unauthorized: check DATA_GATEWAY_ADMIN_TOKEN',
    }, { status: 401 });
  }
  return NextResponse.json(payload, { status: response.status });
}

function getGatewayUrl() {
  return String(process.env.DATA_GATEWAY_URL || process.env.CHART_DATA_GATEWAY_URL || 'http://127.0.0.1:8787').trim();
}
