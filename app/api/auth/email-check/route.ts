import { NextResponse, type NextRequest } from 'next/server.js';
import { getAsyncChartServicePersistence } from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase() ?? '';
  if (!email.includes('@')) {
    return NextResponse.json({
      ok: false,
      available: false,
      message: '올바른 이메일을 입력해 주세요.',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();
  const exists = await persistence.runRead(async (repository) => Boolean(await repository.getUserByEmail(email)));
  return NextResponse.json({
    ok: true,
    available: !exists,
    message: exists ? '이미 가입된 이메일입니다.' : '사용 가능한 이메일입니다.',
  });
}
