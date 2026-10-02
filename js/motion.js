/* 数据层保持原样；这里仅管理版面动效与结论切换。 */
(function () {
  'use strict';

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = [...document.querySelectorAll('.insight-carousel .insight')];
  const carousel = document.querySelector('.insight-carousel');
  const position = document.getElementById('insight-position');
  let current = 0;

  slides.forEach((slide, index) => { slide.inert = index !== 0; });

  function activateSlide(nextIndex) {
    const next = (nextIndex + slides.length) % slides.length;
    if (next === current) return;
    const outgoing = slides[current];
    const incoming = slides[next];

    if (gsap) gsap.killTweensOf([outgoing, incoming]);
    outgoing.classList.remove('is-active');
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.inert = true;
    if (gsap) gsap.set(outgoing, { autoAlpha: 0, x: 0 });

    incoming.classList.add('is-active');
    incoming.setAttribute('aria-hidden', 'false');
    incoming.inert = false;
    if (gsap && !reducedMotion) {
      gsap.fromTo(incoming, { autoAlpha: 0, x: 22 }, { autoAlpha: 1, x: 0, duration: .48, ease: 'power2.out' });
    } else if (gsap) {
      gsap.set(incoming, { autoAlpha: 1, x: 0 });
    }
    current = next;
    position.textContent = `${current + 1} / ${slides.length}`;
  }

  document.getElementById('insight-prev').addEventListener('click', () => activateSlide(current - 1));
  document.getElementById('insight-next').addEventListener('click', () => activateSlide(current + 1));
  carousel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    activateSlide(current + (event.key === 'ArrowRight' ? 1 : -1));
  });

  if (!gsap || !ScrollTrigger || reducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top bottom', end: 'bottom top', scrub: true },
  })
    .fromTo('.hero-art', { scale: .8, opacity: .55, filter: 'brightness(1)' }, { scale: 1, opacity: 1, filter: 'brightness(1)', duration: 1, ease: 'none' })
    .to('.hero-art', { scale: 1.08, opacity: .18, filter: 'brightness(.58)', duration: 1, ease: 'none' });

  gsap.matchMedia().add('(min-width: 1021px)', () => {
    const trigger = ScrollTrigger.create({
      trigger: '.charts-layout',
      start: 'top top+=110',
      end: 'bottom bottom-=110',
      pin: '.charts-rail',
      pinSpacing: false,
      invalidateOnRefresh: true,
    });
    return () => trigger.kill();
  });

  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
