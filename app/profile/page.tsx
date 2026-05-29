import { ProfilePanel } from './profile-panel';

export default function ProfilePage() {
  return (
    <main className="page profile-page">
      <section className="profile-page-hero">
        <span className="eyebrow">My Profile</span>
        <h1>마이프로필</h1>
        <p className="lede">
          계정 정보, 연락번호, 비밀번호 변경, 추천코드, 구독 진행 상태와 처리 알림을 한 곳에서 확인합니다.
        </p>
      </section>
      <ProfilePanel />
    </main>
  );
}
