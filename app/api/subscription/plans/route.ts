import { NextResponse } from 'next/server.js';
import { getAsyncChartServicePersistence } from '../../../../src/server/chart-service/index.ts';

export async function GET() {
  const persistence = getAsyncChartServicePersistence();
  const plans = await persistence.runRead((repository) => repository.listPlans());

  return NextResponse.json({
    plans,
  });
}
