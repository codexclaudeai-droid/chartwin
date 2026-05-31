import { NextResponse } from 'next/server.js';
import {
  getAsyncChartServicePersistence,
  listAsyncPublishedNoticePopups,
} from '../../../src/server/chart-service/index.ts';

export async function GET() {
  const persistence = getAsyncChartServicePersistence();

  try {
    const popups = await persistence.runRead((repository) => (
      listAsyncPublishedNoticePopups(repository, new Date().toISOString())
    ));

    return NextResponse.json({ ok: true, popups });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'notice popups unavailable',
      popups: [],
    }, { status: 500 });
  }
}
