import { LoginPanel } from './login-panel';

export default function LoginPage() {
  return (
    <main className="page">
      <h1>로그인</h1>
      <p className="lede">
        현재 단계는 mock 세션입니다. 실제 비밀번호 인증, 이메일 인증, 2FA는 이후 DB/Auth 어댑터 연결 시 교체합니다.
      </p>
      <LoginPanel />
    </main>
  );
}
