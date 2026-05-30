'use client';

import { useEffect } from 'react';

const scrollFadeSelector = [
  '.landing-page .landing-anchor-nav',
  '.landing-page .landing-section',
  '.landing-page .tc-chart-feature-card',
  '.landing-page .landing-plan-card',
  '.landing-page .landing-faq-card',
  '.landing-page .landing-contact-card',
  '.landing-page .landing-footer',
].join(', ');

export default function LandingScrollFadeMotion() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(scrollFadeSelector));
    if (!elements.length) return;

    elements.forEach((element) => {
      element.classList.add('landing-scroll-fade');
    });

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            element.classList.add('is-visible');
            element.classList.remove('is-exiting');
            return;
          }

          element.classList.remove('is-visible');
          if (entry.boundingClientRect.top < 0) {
            element.classList.add('is-exiting');
          } else {
            element.classList.remove('is-exiting');
          }
        });
      },
      {
        root: null,
        rootMargin: '-12% 0px -16% 0px',
        threshold: [0, 0.18, 0.36],
      },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove('landing-scroll-fade', 'is-visible', 'is-exiting');
      });
    };
  }, []);

  return null;
}
