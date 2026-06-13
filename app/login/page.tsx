import Link from 'next/link';
import { LoginPanel } from './login-panel';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectPath = getSearchParamValue(resolvedSearchParams?.redirect);
  const showWithdrawnPrompt = resolvedSearchParams?.withdrawn === '1';
  const signupHref = redirectPath ? `/signup?redirect=${encodeURIComponent(redirectPath)}` : '/signup';

  return (
    <main className="page auth-page login-page-centered">
      <section className="login-page-shell">
        <span className="eyebrow">Account Access</span>
        <h1>로그인</h1>
        <LoginPanel showWithdrawnPrompt={showWithdrawnPrompt} />
        <section className="auth-signup-guide" aria-label="회원가입 안내">
          <div>
            <strong>TradingCore 계정이 없나요?</strong>
            <p>회원가입 후 무료체험 신청, 구독 관리, 고객센터 문의를 이용할 수 있습니다.</p>
          </div>
          <Link className="button secondary" href={signupHref}>회원가입</Link>
        </section>
        <p className="notice auth-link-note">
          비밀번호를 잊으셨나요? <Link href="/forgot-password">비밀번호 재설정</Link>
        </p>
      </section>
    </main>
  );
}

function getSearchParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
