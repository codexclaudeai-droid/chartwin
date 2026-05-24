import { canUseFullChart, canViewPaidSignals } from '../../src/domain/chart-service/index.ts';

export default function ChartGatePage() {
  const trial = {
    role: 'trial' as const,
    subscriptionStatus: 'trial_active' as const,
  };

  return (
    <main className="page">
      <h1>TC 차트</h1>
      <table className="table">
        <tbody>
          <tr>
            <th>Full chart</th>
            <td>{canUseFullChart(trial) ? 'Allowed' : 'Blocked'}</td>
          </tr>
          <tr>
            <th>Paid signals</th>
            <td>{canViewPaidSignals(trial) ? 'Allowed' : 'Blocked'}</td>
          </tr>
          <tr>
            <th>Chart engine</th>
            <td>기존 Vite 차트 코어를 유지하고, Next 서비스 셸은 권한과 구독 흐름만 감쌉니다.</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
