import { ProfilePanel } from './profile-panel';

export default function ProfilePage() {
  return (
    <main className="page">
      <h1>내 계정</h1>
      <p className="lede">
        구독 승인 상태, 입금 확인 진행 상황, 알림, 고객센터 문의를 한 곳에서 확인합니다.
        관리자 확인이 필요한 작업은 현재 대기 상태와 다음 이동 경로를 함께 표시합니다.
      </p>
      <ProfilePanel />
    </main>
  );
}

