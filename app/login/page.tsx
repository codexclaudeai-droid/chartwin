import Link from 'next/link';
import { LoginPanel } from './login-panel';

export default function LoginPage() {
  return (
    <main className="page auth-page login-page-centered">
      <section className="login-page-shell">
        <span className="eyebrow">Account Access</span>
        <h1>로그인</h1>
        <LoginPanel />
        <p className="notice">
          비밀번호를 잊으셨나요? <Link href="/forgot-password">비밀번호 재설정</Link>
        </p>
      </section>
    </main>
  );
}
