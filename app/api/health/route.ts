import { NextResponse } from 'next/server.js';
import { getChartServiceRuntimeReadiness } from '../../../src/server/chart-service/index.ts';

export function GET() {
  const readiness = getChartServiceRuntimeReadiness();

  return NextResponse.json({
    ok: readiness.ok,
    mode: readiness.mode,
    repository: readiness.repository,
    checks: readiness.checks,
  }, { status: readiness.ok ? 200 : 503 });
}
