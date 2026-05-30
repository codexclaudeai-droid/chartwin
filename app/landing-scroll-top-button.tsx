'use client';

import { useEffect, useState } from 'react';

export default function LandingScrollTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 420);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      aria-label="페이지 상단으로 이동"
      className={`landing-scroll-top-button${isVisible ? ' visible' : ''}`}
      onClick={scrollToTop}
      type="button"
    >
      <span aria-hidden="true">TOP</span>
    </button>
  );
}
