import { ProfilePanel } from './profile-panel';

export default function ProfilePage() {
  return (
    <main className="page">
      <h1>마이프로필</h1>
      <p className="lede">
        계정 정보, 연락번호, 비밀번호 변경, 추천코드와 구독 진행 상황을 한 곳에서 확인합니다.
        관리자 확인이 필요한 작업은 현재 대기 상태와 다음 이동 경로를 함께 표시합니다.
      </p>
      <ProfilePanel />
    </main>
  );
}
