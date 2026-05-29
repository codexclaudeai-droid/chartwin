import Link from 'next/link';
import { ForgotPasswordPanel } from './forgot-password-panel';

export default function ForgotPasswordPage() {
  return (
    <main className="page auth-page">
      <span className="eyebrow">Password Recovery</span>
      <h1>비밀번호 재설정</h1>
      <p className="lede">
        가입 이메일로 재설정 요청을 만든 뒤 새 비밀번호를 등록합니다. 배포 환경에서는 이메일 발송 흐름과 연결됩니다.
      </p>
      <ForgotPasswordPanel />
      <p className="notice">
        비밀번호가 기억났나요? <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </main>
  );
}
