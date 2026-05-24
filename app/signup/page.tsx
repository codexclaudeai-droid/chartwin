import { validatePasswordPolicy } from '../../src/domain/chart-service/index.ts';
import { SignupPanel } from './signup-panel';

export default function SignupPage() {
  const policy = validatePasswordPolicy('Aa1!aaaa');

  return (
    <main className="page">
      <h1>회원가입</h1>
      <p className="lede">
        실제 가입 저장소를 연결하기 전, 보안 정책과 가입 플로우 기준을 먼저 고정합니다.
      </p>
      <table className="table">
        <tbody>
          <tr>
            <th>Password policy</th>
            <td>{policy.ok ? 'Ready' : policy.missing.join(', ')}</td>
          </tr>
          <tr>
            <th>Email verification</th>
            <td>필수</td>
          </tr>
        </tbody>
      </table>
      <SignupPanel />
    </main>
  );
}
