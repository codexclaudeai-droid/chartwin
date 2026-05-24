import { NotificationsPanel } from './notifications-panel';

export default function NotificationsPage() {
  return (
    <main className="page">
      <h1>알림센터</h1>
      <p className="lede">
        운영 처리 결과와 고객센터 답변을 한곳에서 확인합니다.
      </p>
      <NotificationsPanel />
    </main>
  );
}
