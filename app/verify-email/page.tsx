import Link from 'next/link';
import {
  getAsyncChartServicePersistence,
  verifyAsyncEmailWithToken,
} from '../../src/server/chart-service/index.ts';
import { VerifyEmailResendForm } from './verify-email-resend-form';

type VerifyEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = getSearchParamValue(resolvedSearchParams?.token);
  const result = await verifyEmailToken(token);

  return (
    <main className="page auth-page">
      <section className="card auth-card">
        <span className="eyebrow">Email Verification</span>
        <h1>{result.ok ? '이메일 인증이 완료되었습니다' : '이메일 인증을 완료하지 못했습니다'}</h1>
        <p className="lede">
          {result.ok
            ? `${result.email} 계정의 이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.`
            : result.message}
        </p>
        <div className="actions compact">
          <Link className="button" href="/login">로그인하러 가기</Link>
          <Link className="button secondary" href="/signup">회원가입으로 돌아가기</Link>
        </div>
        {!result.ok && <VerifyEmailResendForm />}
      </section>
    </main>
  );
}

async function verifyEmailToken(token: string | null): Promise<{
  ok: true;
  email: string;
} | {
  ok: false;
  message: string;
}> {
  if (!token) {
    return {
      ok: false,
      message: '인증 토큰이 없습니다. 메일의 인증 링크를 다시 확인해 주세요.',
    };
  }

  const persistence = getAsyncChartServicePersistence();
  try {
    const result = await persistence.runMutation((repository) => verifyAsyncEmailWithToken(repository, {
      token,
      verifiedAt: new Date().toISOString(),
    }));
    return {
      ok: true,
      email: result.user.email,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : '이메일 인증에 실패했습니다. 인증 링크를 다시 확인해 주세요.',
    };
  }
}

function getSearchParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
