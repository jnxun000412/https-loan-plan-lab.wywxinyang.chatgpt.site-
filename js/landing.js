/* 落地页只负责展示动效；贷款计算留在 calculator.html。 */
(function () {
  'use strict';

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.hero-copy > *', {
    y: 28,
    autoAlpha: 0,
    duration: .8,
    ease: 'power2.out',
    stagger: .1,
  });
  gsap.from('.hero-art', { scale: 1.07, opacity: .55, duration: 1.5, ease: 'power2.out' });

  document.querySelectorAll('[data-reveal]').forEach((element) => {
    gsap.from(element, {
      scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      y: 35,
      autoAlpha: 0,
      duration: .72,
      ease: 'power2.out',
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
