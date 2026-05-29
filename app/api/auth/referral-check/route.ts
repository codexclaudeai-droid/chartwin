import { NextResponse, type NextRequest } from 'next/server.js';
import {
  getAsyncChartServicePersistence,
  normalizeReferralCode,
} from '../../../../src/server/chart-service/index.ts';

export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(new URL(request.url).searchParams.get('code'));
  if (!code) {
    return NextResponse.json({
      ok: false,
      found: false,
      message: '추천코드를 입력해 주세요.',
    }, { status: 400 });
  }

  const persistence = getAsyncChartServicePersistence();
  const referrer = await persistence.runRead(async (repository) => {
    const users = await repository.listUsers();
    return users.find((user) => normalizeReferralCode(user.referralCode) === code) ?? null;
  });

  if (!referrer) {
    return NextResponse.json({
      ok: false,
      found: false,
      message: '추천코드를 확인할 수 없습니다.',
    }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    message: '추천인 확인 완료',
    referrer: {
      name: referrer.name,
      emailMasked: maskEmail(referrer.email),
    },
  });
}

function maskEmail(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');
  if (!localPart || !domain) return '비공개';
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}${'*'.repeat(Math.max(3, localPart.length - visiblePrefix.length))}@${domain}`;
}
