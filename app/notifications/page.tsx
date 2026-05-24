import { NotificationsPanel } from './notifications-panel';

export default function NotificationsPage() {
  return (
    <main className="page">
      <h1>알림</h1>
      <p className="lede">
        결제 승인, 반려, 환불, 고객센터 답변 같은 운영 결과를 한곳에서 확인합니다.
      </p>
      <NotificationsPanel />
    </main>
  );
}
