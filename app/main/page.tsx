import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Activity,
  BellRing,
  ChartNoAxesCombined,
  FileChartColumn,
  type LucideIcon,
} from 'lucide-react';
import LandingHeroSlider from '../landing-hero-slider.tsx';
import LandingScrollFadeMotion from '../landing-scroll-fade-motion.tsx';
import LandingScrollTopButton from '../landing-scroll-top-button.tsx';
import { FreeTrialRequestButton } from '../shared/free-trial-request-button';
import { SiteFooter } from '../shared/site-footer';
import { formatPlanPriceParts } from '../shared/plan-price-format.ts';
import { createPricingPlanHref } from '../pricing/plan-selection.ts';
import { SocialSignupCompleteModal } from './social-signup-complete-modal';
import type { SubscriptionPlan } from '../../src/domain/chart-service/index.ts';
import {
  getAsyncChartServicePersistence,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';

export const metadata: Metadata = {
  title: 'TradingCore | 실시간 알고리즘 트레이딩 시그널',
  description: 'TradingCore는 TC Chart 기반 실시간 알고리즘 시그널, 온사이트/텔레그램 알림, 프로급 차트 분석 도구를 제공하는 구독형 트레이딩 서비스입니다.',
  keywords: ['TradingCore', 'TC Chart', '알고리즘 시그널', '실시간 차트 알림', '텔레그램 시그널', '차트 분석 도구'],
  openGraph: {
    title: 'TradingCore | 실시간 알고리즘 트레이딩 시그널',
    description: '정밀한 기술적 분석, 실시간 알림, 프로급 차트 도구로 트레이딩 의사결정을 더 빠르고 명확하게 만드세요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'TradingCore',
  },
};

export const dynamic = 'force-dynamic';

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const tcChartFeatures = [
  {
    label: 'Advanced Algorithmic Signal',
    title: '다중 지표 교차 검증을 통한 고정밀 시그널',
    body: 'RSI, MACD, 이동평균선 등 검증된 기술 지표를 TradingCore 시스템 엔진이 실시간으로 교차 분석합니다. 통계적 확률이 높은 결정적 순간만 선별해 차트에 매수·매도 신호로 시각화합니다.',
    points: ['다중 지표 교차 분석', '매수·매도 시그널 표시', '노이즈 필터링'],
  },
  {
    label: 'Instant Signal Alert',
    title: '시장을 떠나 있어도 기회를 포착하는 실시간 알림 시스템',
    body: 'PC와 모바일 웹의 온사이트 알림은 물론 텔레그램 연동을 지원합니다. 진입가, 목표가, 손절가를 포함한 디테일한 알림으로 차트 앞을 지키지 않아도 빠르게 대응할 수 있습니다.',
    points: ['온사이트 실시간 알림', '텔레그램 연동 지원', '진입·목표·손절 메시지'],
  },
  {
    label: 'Professional Charting & Tools',
    title: '프로급 차트와 강력한 분석 도구 지원',
    body: '단순한 시그널 조회를 넘어 추세선, 채널, 피보나치, 포지션 예측, 측정 도구 등 프로 트레이더가 사용하는 작도 기능을 지원합니다.',
    points: ['추세선·채널 작도', '피보나치·포지션 예측', '다크 모드 최적화 UI'],
  },
  {
    label: 'Backtesting & Stat',
    title: '신뢰할 수 있는 백테스팅 지표 공개',
    body: 'TradingCore 추천 시그널은 과거 데이터 기반 백테스팅과 승률 분석 결과를 바탕으로 검증합니다. 막연한 기대감이 아닌 객관적인 데이터로 전략을 점검할 수 있습니다.',
    points: ['과거 데이터 기반 검증', '승률 통계 확인', '전략 신뢰도 점검'],
  },
];

const tcChartFeatureIcons: LucideIcon[] = [
  ChartNoAxesCombined,
  BellRing,
  Activity,
  FileChartColumn,
];

const landingPlanFeaturesById: Record<string, string[]> = {
  plan_monthly: [
    '실시간 온사이트 및 텔레그램 시그널 알림',
    '핵심 기술 보조지표 제공',
    '기본 시그널과 월간 백테스팅 데이터',
  ],
  plan_half_year: [
    'BASIC의 모든 핵심 기능 포함',
    '텔레그램 알림 확장 및 시그널 알림 커스텀',
    '프로 시그널과 주간 백테스팅 리포트',
    '우선 라우팅 기반 시그널 전송',
  ],
  plan_yearly: [
    'PRO의 모든 고급 기능 포함',
    '텔레그램 실시간 알림 무제한 등록',
    'VIP 초고급 데이터 대시보드 및 우선 기술 지원',
    '신규 프리미엄 지표 베타 테스트 우선 참여',
  ],
};
const contactActionCards = [
  {
    label: 'Support',
    title: '1:1 문의',
    body: '서비스 이용, 구독 상태, 차트 기능, 알림 설정 관련 문의를 회원 전용 게시글로 남길 수 있습니다.',
    href: '/support',
    action: '1:1 문의하기',
  },
  {
    label: 'Partner',
    title: '제휴문의',
    body: '영업 제휴, 파트너십, 공동 프로모션 제안은 제휴 문의로 별도 접수합니다.',
    href: '/support?category=partnership',
    action: '제휴 문의하기',
  },
  {
    label: 'Trial',
    title: '무료체험신청',
    body: '일반회원 가입 후 BASIC 플랜의 핵심 시그널과 기본 분석 도구를 먼저 체험할 수 있습니다.',
    href: 'free-trial',
    action: '무료체험 신청',
  },
];

const partnershipHighlights = [
  {
    label: 'Strategic Investment',
    title: '서비스 고도화를 위한 성장 기반 확보',
  },
  {
    label: 'Business Alliance',
    title: '트레이딩 서비스 사업화와 시장 확장 협력',
  },
  {
    label: 'Platform Growth',
    title: 'TC Chart와 시그널 인프라의 안정적 확장',
  },
];

const faqItems = [
  {
    question: 'TradingCore는 초보 투자자도 바로 사용할 수 있나요?',
    answer: '네. 복잡한 보조지표 해석 없이 핵심 시그널을 차트에 직관적으로 표시해 진입/청산 타이밍을 빠르게 파악할 수 있습니다.',
  },
  {
    question: '시그널이 지원하는 투자 상품이나 시장은 무엇인가요?',
    answer: '주요 가상자산/지수/선물 등 핵심 종목을 중심으로 운영하며, 실시간 데이터 기반 분석으로 방향성과 진입 신호를 제공합니다.',
  },
  {
    question: '시그널 승률 검증 기준은 신뢰할 수 있나요?',
    answer: '과거 데이터 기반 백테스팅과 성과 통계를 함께 공개하며, 단순 체감이 아닌 수치 기반으로 전략 신뢰도를 검증합니다.',
  },
  {
    question: '무료체험은 어떻게 진행되며 비용이 청구되나요?',
    answer: '무료체험은 회원가입 후 신청 방식이며 자동 결제가 되지 않습니다. 체험 기간 동안 핵심 기능을 먼저 확인할 수 있습니다.',
  },
  {
    question: '텔레그램 실시간 알림 연동은 어렵지 않나요?',
    answer: '가이드에 따라 채널/봇을 연결하면 바로 사용할 수 있으며, 플랜에 따라 알림 조건 세부 설정도 지원합니다.',
  },
  {
    question: '구독 중간에 취소하거나 플랜을 변경할 수 있나요?',
    answer: '마이프로필에서 구독 상태 확인 후 취소/환불 요청이 가능하며, 관리자 확인 절차에 따라 순차 처리됩니다.',
  },
];

const landingStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

function calculateLandingPlanPrice(plan: SubscriptionPlan): number {
  return Math.round(plan.basePriceUsd * (1 - plan.discountPercent / 100) * 100) / 100;
}

function renderLandingPlanPrice(plan: SubscriptionPlan) {
  const price = formatPlanPriceParts(calculateLandingPlanPrice(plan));

  return (
    <strong className="landing-plan-price" aria-label={`${price.currency}${price.whole}${price.fraction}`}>
      <span>{price.currency}</span>
      <span>{price.whole}</span>
      {price.fraction ? <span className="landing-plan-price-fraction">{price.fraction}</span> : null}
    </strong>
  );
}

function formatLandingPlanPeriod(plan: SubscriptionPlan): string {
  if (plan.id === 'plan_monthly') return '/1개월';
  if (plan.id === 'plan_half_year') return '/ 6개월';
  if (plan.id === 'plan_yearly') return '/ 1년';
  return `/ ${plan.durationDays}일`;
}

function formatLandingPlanDiscount(plan: SubscriptionPlan): string | null {
  if (plan.discountPercent <= 0) return null;
  return `${plan.discountPercent}% 할인`;
}

function formatLandingPlanName(plan: SubscriptionPlan): string {
  if (plan.id === 'plan_monthly') return 'BASIC';
  if (plan.id === 'plan_half_year') return 'PRO';
  if (plan.id === 'plan_yearly') return 'ELITE';
  return plan.name;
}

function formatLandingPlanIconType(plan: SubscriptionPlan): 'basic' | 'pro' | 'elite' {
  if (plan.id === 'plan_half_year') return 'pro';
  if (plan.id === 'plan_yearly') return 'elite';
  return 'basic';
}

function renderLandingPlanIcon(plan: SubscriptionPlan) {
  const iconType = formatLandingPlanIconType(plan);

  return (
    <span className={`landing-plan-icon ${iconType}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {iconType === 'basic' ? (
          <>
            <circle cx="12" cy="12" r="7" />
            <path d="M9 15l3-8 3 8-3-2z" />
          </>
        ) : null}
        {iconType === 'pro' ? (
          <>
            <path d="M5 15h4l2-7 3 10 2-6h3" />
            <path d="M6 8h4" />
          </>
        ) : null}
        {iconType === 'elite' ? (
          <>
            <path d="M12 4l7 7-7 9-7-9z" />
            <path d="M5 11h14M9 4l3 16 3-16" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function renderTcChartFeatureIcon(index: number) {
  const FeatureIcon = tcChartFeatureIcons[index % tcChartFeatureIcons.length];

  return (
    <span className="tc-chart-feature-icon" aria-hidden="true">
      <FeatureIcon strokeWidth={1.7} />
    </span>
  );
}

function formatLandingPlanNote(plan: SubscriptionPlan): string {
  if (plan.id === 'plan_monthly') return '가볍게 시작하고 나만의 매매 타이밍을 시험해보고 싶은 분들을 위한 기본 요금제';
  if (plan.id === 'plan_half_year') return '일관된 매매 원칙을 다지고 체계적인 중단기 전략을 선호하는 액티브 트레이더 추천 요금제';
  if (plan.id === 'plan_yearly') return '최적의 속도와 맞춤형 지원을 통해 최상의 결과를 추구하는 프로/기업 사용자용 패키지';
  return `${plan.durationDays}일 이용 · ${plan.discountPercent}% 할인`;
}

function getLandingPlanFeatures(plan: SubscriptionPlan): string[] {
  return landingPlanFeaturesById[plan.id] ?? ['실시간 알고리즘 시그널', 'TC Chart 분석 도구', '구독 확인 및 이용'];
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const signupComplete = resolvedSearchParams?.signup === 'complete';
  const signupExisting = resolvedSearchParams?.signup === 'existing';
  const persistence = getAsyncChartServicePersistence();
  const { plans, webInfoSettings } = await persistence.runRead(async (repository) => ({
    plans: (await repository.listPlans()).filter((plan) => plan.isActive),
    webInfoSettings: await getAsyncWebInfoSettingsForDisplay(repository),
  }));

  return (
    <main className="landing-page">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData) }}
      />
      <LandingScrollFadeMotion />
      <LandingHeroSlider />

      <nav className="landing-anchor-nav" aria-label="서비스 섹션 바로가기">
        <a href="#landing-tc-chart-features">TC Chart 기능</a>
        <a href="#landing-plans">플랜 비교</a>
        <a href="#landing-faq">FAQ</a>
        <a href="#landing-contact-actions">문의하기</a>
      </nav>

      <section
        className="landing-section landing-tc-chart-features"
        id="landing-tc-chart-features"
        aria-label="TC Chart 기능"
      >
        <div className="section-heading">
          <span className="eyebrow">TC Chart Features</span>
          <h2>고정밀 시그널부터 프로급 차트 도구까지 한 화면에서 경험하세요.</h2>
          <p>복잡한 시장 분석은 TradingCore 알고리즘에 맡기고, 사용자는 명확한 타이밍과 실행 기준에 집중할 수 있습니다.</p>
        </div>
        <div className="tc-chart-feature-grid">
          {tcChartFeatures.map((feature, index) => (
            <article className="tc-chart-feature-card" key={feature.title}>
              <span>{feature.label}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <ul>
                {feature.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {renderTcChartFeatureIcon(index)}
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-plans" id="landing-plans" aria-label="구독 플랜 미리보기">
        <div className="section-heading">
          <span className="eyebrow">Plans</span>
          <h2>당신의 트레이딩 성향에 맞는 완벽한 플랜</h2>
          <p>합리적인 예산으로 검증된 실시간 알고리즘 시그널과 프로급 차트 분석 도구를 경험해 보세요.</p>
        </div>
        <div className="landing-plan-grid">
          {plans.map((plan) => {
            const featured = plan.id === 'plan_half_year';
            const landingPlanFeatures = webInfoSettings.planServices[plan.id] ?? getLandingPlanFeatures(plan);
            return (
              <article className={featured ? 'landing-plan-card featured' : 'landing-plan-card'} key={plan.id}>
                <div className="landing-plan-card-header">
                  <h3 className="landing-plan-title">
                    {renderLandingPlanIcon(plan)}
                    <span>{formatLandingPlanName(plan)}</span>
                  </h3>
                  {featured ? <span className="landing-plan-badge">★ RECOMMENDED</span> : null}
                </div>
                <div className="landing-plan-price-row">
                  {renderLandingPlanPrice(plan)}
                  <span className="landing-plan-period">{formatLandingPlanPeriod(plan)}</span>
                </div>
                {formatLandingPlanDiscount(plan) ? (
                  <span className="landing-plan-discount">{formatLandingPlanDiscount(plan)}</span>
                ) : null}
                <p>{formatLandingPlanNote(plan)}</p>
                <ul className="landing-plan-feature-list">
                  {landingPlanFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <small>{plan.durationDays}일 이용권 · 정가 ${plan.basePriceUsd.toLocaleString('en-US')}</small>
                <div className="landing-plan-card-footer">
                  <span>{featured ? 'Best value for active traders' : 'Flexible trading access'}</span>
                  <Link className={featured ? 'button' : 'button secondary'} href={createPricingPlanHref(plan.id)}>
                    플랜 선택하기
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-faq" id="landing-faq" aria-label="자주 묻는 질문">
        <div className="section-heading">
          <span className="eyebrow">FAQ</span>
          <h2>자주 묻는 질문</h2>
          <p>서비스에 대한 대표적인 궁금증과 구독전 핵심 질문을 정리했습니다.</p>
        </div>
        <div className="landing-faq-grid">
          {faqItems.map((item) => (
            <details className="landing-faq-card" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        className="landing-section landing-strategic-partnership"
        id="landing-strategic-partnership"
        aria-label="전략적 파트너십"
      >
        <div className="landing-partnership-layout">
          <div className="landing-partnership-copy">
            <span className="eyebrow">Strategic Partnership</span>
            <h2>키리오스인베스트먼트, 전략적 투자 및 사업 파트너로 합류</h2>
            <p>
              TradingCore는 Kyrios Investment와의 파트너십을 통해 알고리즘 시그널 기술,
              구독형 서비스, 운영 인프라 고도화를 본격화합니다.
            </p>
            <div className="landing-partnership-highlights">
              {partnershipHighlights.map((item) => (
                <article className="landing-partnership-highlight" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                </article>
              ))}
            </div>
          </div>
          <div className="landing-partnership-visual" aria-label="TradingCore와 KYRIOS INVESTMENT 전략적 파트너십">
            <div className="landing-partnership-brand-lockup">
              <figure className="landing-partnership-brand-card tradingcore">
                <img
                  className="landing-partnership-tradingcore-logo"
                  src="/images/TC-main-logo.png"
                  alt="TradingCore"
                />
              </figure>
              <span className="landing-partnership-x" aria-hidden="true">
                <svg viewBox="0 0 48 48" focusable="false">
                  <path d="M13 13L35 35" />
                  <path d="M35 13L13 35" />
                </svg>
              </span>
              <figure className="landing-partnership-brand-card kyrios">
                <img
                  className="landing-partnership-logo landing-partnership-kyrios-logo"
                  src="/images/partners/kyrios-investment-white.png"
                  alt="KYRIOS INVESTMENT"
                />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section
        className="landing-section landing-contact-actions"
        id="landing-contact-actions"
        aria-label="문의 및 체험 신청"
      >
        <div className="section-heading">
          <span className="eyebrow">Contact</span>
          <h2>필요한 문의 유형을 선택하세요.</h2>
          <p>일반 문의, 제휴 제안, 무료체험 신청을 목적별로 나누어 빠르게 접수할 수 있습니다.</p>
        </div>
        <div className="landing-contact-grid">
          {contactActionCards.map((card) => (
            <article className="landing-contact-card" key={card.title}>
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {card.href === 'free-trial' ? (
                <FreeTrialRequestButton className="button secondary">{card.action}</FreeTrialRequestButton>
              ) : (
                <Link className="button secondary" href={card.href}>{card.action}</Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <nav className="landing-mobile-cta" aria-label="모바일 빠른 구독 이동">
        <Link className="button" href="/pricing">구독 신청</Link>
        <Link className="button secondary" href="/signup">회원가입</Link>
      </nav>

      <LandingScrollTopButton />

      <SiteFooter />
      <SocialSignupCompleteModal show={signupComplete || signupExisting} isExistingAccount={signupExisting} />
    </main>
  );
}

