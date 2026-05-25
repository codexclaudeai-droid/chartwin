import { NextResponse } from 'next/server.js';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../../src/server/chart-service/index.ts';

export async function GET() {
  const persistence = getAsyncChartServicePersistence();

  try {
    const settings = await persistence.runRead((repository) => getAsyncWebInfoSettingsForDisplay(repository));
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'web info unavailable',
    }, { status: 500 });
  }
}
