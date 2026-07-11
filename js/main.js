/* ===================================================
   TK WEBTALENT – MAIN JAVASCRIPT
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ── NAV SCROLL EFFECT ──────────────────────────── */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── MOBILE MENU ────────────────────────────────── */
  const burger      = document.getElementById('navBurger');
  const mobileMenu  = document.getElementById('mobileMenu');
  const mobileClose = document.getElementById('mobileClose');
  const overlay     = document.getElementById('mobileOverlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  const openMenu  = () => { mobileMenu.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeMenu = () => { mobileMenu.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };

  burger?.addEventListener('click', openMenu);
  mobileClose?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);
  mobileLinks.forEach(link => link.addEventListener('click', closeMenu));

  /* ── SMOOTH SCROLL ──────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = nav ? nav.offsetHeight : 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ── SCROLL REVEAL ──────────────────────────────── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.dataset.delay || 0;
          setTimeout(() => el.classList.add('visible'), delay);
          revealObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  // Stagger sibling reveals
  document.querySelectorAll('.reveal').forEach((el, i) => {
    const siblings = el.parentElement.querySelectorAll('.reveal');
    const sibIndex = Array.from(siblings).indexOf(el);
    el.dataset.delay = sibIndex * 80;
    revealObserver.observe(el);
  });

  /* ── FAQ ACCORDION ──────────────────────────────── */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Open clicked if it was closed
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── CONTACT FORM SUBMIT FEEDBACK ──────────────── */
  const contactForm = document.querySelector('.contact-form[action]');
  if (contactForm) {
    contactForm.addEventListener('submit', () => {
      const btn = contactForm.querySelector('button[type="submit"]');
      if (btn) { btn.textContent = 'Wird gesendet…'; btn.disabled = true; }
    });
  }

  /* ── ACTIVE NAV LINK (on scroll) ───────────────── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links li a');

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => sectionObserver.observe(s));

});
