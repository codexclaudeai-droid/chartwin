import { SupportPanel } from './support-panel';

const SUPPORT_FLOW = [
  {
    title: '입금/결제',
    description: '무통장 입금 확인, 결제 승인 대기, 영수증 확인을 요청할 수 있습니다.',
  },
  {
    title: '취소/환불',
    description: '구독 취소, 환불 요청, 관리자 확인이 필요한 결제 이슈를 남겨 주세요.',
  },
  {
    title: '시그널/차트',
    description: '시그널 이용 권한, 차트 접근, 서비스 사용 방법을 문의할 수 있습니다.',
  },
];

export default function SupportPage() {
  return (
    <main className="page">
      <h1>고객센터</h1>
      <p className="lede">입금 확인, 환불 요청, 시그널 이용 문의를 한 곳에서 관리합니다.</p>
      <div className="summary-grid">
        {SUPPORT_FLOW.map((item) => (
          <article className="mini-card" key={item.title}>
            <span>{item.title}</span>
            <strong>관리자 확인 후 처리</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
      <SupportPanel />
    </main>
  );
}
