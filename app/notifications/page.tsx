import { NotificationsPanel } from './notifications-panel';

export default function NotificationsPage() {
  return (
    <main className="page notifications-page">
      <section className="notifications-page-hero">
        <span className="eyebrow">Notification Center</span>
        <h1>알림센터</h1>
        <p className="lede">
          운영 처리 결과, 구독 상태 변경, 고객센터 답변과 시스템 알림을 한 곳에서 확인합니다.
        </p>
      </section>
      <NotificationsPanel />
    </main>
  );
}
