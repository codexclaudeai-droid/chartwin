import Link from 'next/link';
import { ForgotPasswordPanel } from './forgot-password-panel';

export default function ForgotPasswordPage() {
  return (
    <main className="page auth-page">
      <span className="eyebrow">Password Recovery</span>
      <h1>비밀번호 재설정</h1>
      <p className="lede">
        가입 이메일로 재설정 안내를 받은 뒤 새 비밀번호를 등록합니다.
      </p>
      <ForgotPasswordPanel />
      <p className="notice">
        비밀번호가 기억났나요? <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </main>
  );
}
