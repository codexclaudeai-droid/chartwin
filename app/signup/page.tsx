import { SignupPanel } from './signup-panel';

export default function SignupPage() {
  return (
    <main className="page auth-page signup-page">
      <section className="auth-hero">
        <span className="eyebrow">Create Account</span>
        <h1>회원가입</h1>
        <p className="lede">
          TradingCore 계정을 만들고 TC Chart, 구독 신청, 무료체험, 고객센터 문의를 하나의 계정으로 이용하세요.
        </p>
      </section>
      <SignupPanel />
    </main>
  );
}
