import Link from 'next/link';
import { canUseFullChart, canViewPaidSignals } from '../src/domain/chart-service/index.ts';

export default function HomePage() {
  const guestAccess = {
    chart: canUseFullChart({ role: 'guest', subscriptionStatus: 'none' }),
    signals: canViewPaidSignals({ role: 'guest', subscriptionStatus: 'none' }),
  };

  return (
    <main>
      <section className="hero">
        <div>
          <h1>TC Chart</h1>
          <p>
            실시간 차트, 구독 권한, 관리자 승인 흐름을 하나의 서비스 화면으로 묶는
            첫 번째 운영 셸입니다.
          </p>
          <div className="actions">
            <Link className="button" href="/signup">무료체험 신청</Link>
            <Link className="button secondary" href="/chart">차트 상태 보기</Link>
          </div>
        </div>
        <aside className="status-panel" aria-label="Service gate status">
          <h2>Access Gate</h2>
          <div className="status-list">
            <div className="status-row">
              <span>Guest full chart</span>
              <strong>{guestAccess.chart ? 'Allowed' : 'Blocked'}</strong>
            </div>
            <div className="status-row">
              <span>Guest paid signals</span>
              <strong>{guestAccess.signals ? 'Allowed' : 'Blocked'}</strong>
            </div>
            <div className="status-row">
              <span>Approval model</span>
              <strong>Manual admin</strong>
            </div>
          </div>
        </aside>
      </section>
      <section className="band" aria-label="Operational checkpoints">
        <div className="metric">
          <span>Foundation</span>
          <strong>Domain guards ready</strong>
        </div>
        <div className="metric">
          <span>Chart core</span>
          <strong>기존 차트 보존</strong>
        </div>
        <div className="metric">
          <span>Backend split</span>
          <strong>API 경계 우선</strong>
        </div>
      </section>
    </main>
  );
}
