'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const landingHeroSlides = [
  {
    eyebrow: 'Precision Algorithmic Technical Analysis',
    title: '복잡한 시장의 흐름을 한눈에, 정밀한 실시간 트레이딩 시그널',
    body: 'TradingCore의 고도화된 퀀트 알고리즘이 시장 노이즈를 제거하고 정확한 진입/청산 시점을 포착합니다. 더 이상 감정에 흔들리는 매매를 하지 마세요.',
    primaryLabel: '회원가입',
    primaryHref: '/signup',
    secondaryLabel: '무료체험 신청',
    secondaryHref: '/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form',
    backgroundClass: 'hero-bg-approval',
    heroImage: '/images/hero/slide-01.png',
  },
  {
    eyebrow: 'The Second Edge for Profit',
    title: '망설임 없는 진입을 완성하는 초고속 실시간 차트 알림',
    body: '급변하는 금융 시장에서 가장 빠른 신호를 실시간으로 전달합니다. 차트를 계속 들여다보지 않아도 원하는 최적의 매매 기회를 놓치지 않도록 돕습니다.',
    primaryLabel: '회원가입',
    primaryHref: '/signup',
    secondaryLabel: '무료체험 신청',
    secondaryHref: '/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form',
    backgroundClass: 'hero-bg-deposit',
    heroImage: '/images/hero/slide-03.png',
  },
  {
    eyebrow: 'Intuitive & Visual Charts for Everyone',
    title: "복잡한 분석은 TradingCore에 맡기고, 당신은 오직 '수익'에만 집중하세요",
    body: '수많은 보조지표를 개별적으로 분석할 필요가 없습니다. 알고리즘이 검증한 핵심 시그널만 직관적인 그래프로 시각화하여 명확한 투자 기준을 제시합니다.',
    primaryLabel: '플랜보기',
    primaryHref: '#landing-plans',
    secondaryLabel: '무료체험 신청',
    secondaryHref: '/signup?redirect=/support%3Fcategory%3Dtrial%23support-inquiry-form',
    backgroundClass: 'hero-bg-workspace',
    heroImage: '/images/hero/slide-02.png',
  },
];

export default function LandingHeroSlider() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % landingHeroSlides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="landing-hero" aria-label="TradingCore 메인 슬라이드">
      <div className="landing-hero-stage">
        {landingHeroSlides.map((slide, index) => (
          <article
            className={index === activeSlide ? 'landing-hero-slide active' : 'landing-hero-slide'}
            key={slide.title}
            aria-hidden={index !== activeSlide}
          >
            <span
              className={`landing-hero-bg ${slide.backgroundClass}`}
              style={{
                backgroundImage: `
                  url('${slide.heroImage}'),
                  linear-gradient(115deg, rgba(2, 7, 19, 0.2) 0%, rgba(8, 27, 56, 0.14) 48%, rgba(2, 7, 19, 0.18) 100%),
                  radial-gradient(circle at 72% 18%, rgba(19, 89, 255, 0.07), transparent 24%),
                  radial-gradient(circle at 82% 70%, rgba(125, 183, 255, 0.05), transparent 28%)
                `,
              }}
              aria-hidden="true"
            />
            <div className="landing-hero-layout">
              <div className="landing-hero-copy">
                <span className="eyebrow">{slide.eyebrow}</span>
                <h1 className="landing-hero-title">{slide.title}</h1>
                <p className="landing-hero-body">{slide.body}</p>
                <div className="actions landing-hero-actions">
                  {slide.primaryLabel === '회원가입' ? (
                    <span className="sparkle-button hero-signup-sparkle">
                      <Link className="session-signup-cta hero-signup-cta" href={slide.primaryHref}>
                        <span className="spark" />
                        <span className="backdrop" />
                        <svg className="sparkle" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z" />
                          <path d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z" />
                          <path d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z" />
                        </svg>
                        <span className="text">회원가입</span>
                      </Link>
                      <span aria-hidden="true" className="particle-pen">
                        <svg className="particle" viewBox="0 0 15 15" fill="none">
                          <path d="M6.937 3.846L7.75 1L8.563 3.846C8.77313 4.58114 9.1671 5.25062 9.70774 5.79126C10.2484 6.3319 10.9179 6.72587 11.653 6.936L14.5 7.75L11.654 8.563C10.9189 8.77313 10.2494 9.1671 9.70874 9.70774C9.1681 10.2484 8.77413 10.9179 8.564 11.653L7.75 14.5L6.937 11.654C6.72687 10.9189 6.3329 10.2494 5.79226 9.70874C5.25162 9.1681 4.58214 8.77413 3.847 8.564L1 7.75L3.846 6.937C4.58114 6.72687 5.25062 6.3329 5.79126 5.79226C6.3319 5.25162 6.72587 4.58214 6.936 3.847L6.937 3.846Z" />
                        </svg>
                      </span>
                    </span>
                  ) : (
                    <Link className="button" href={slide.primaryHref}>{slide.primaryLabel}</Link>
                  )}
                  <Link className="button secondary" href={slide.secondaryHref}>{slide.secondaryLabel}</Link>
                </div>
              </div>
            </div>
          </article>
        ))}
        <div className="landing-hero-controls" aria-label="슬라이드 이동">
          {landingHeroSlides.map((slide, index) => (
            <button
              className={index === activeSlide ? 'landing-hero-control active' : 'landing-hero-control'}
              type="button"
              key={slide.eyebrow}
              aria-label={`${index + 1}번 슬라이드로 이동`}
              aria-pressed={index === activeSlide}
              onClick={() => setActiveSlide(index)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{slide.eyebrow}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
