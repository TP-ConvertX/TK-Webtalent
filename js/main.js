/* ===================================================
   TK WEBTALENT – MAIN JAVASCRIPT
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ── COOKIE BANNER (shows every visit) ─────────── */
  const cookieOverlay = document.getElementById('cookieOverlay');
  const cookieAccept  = document.getElementById('cookieAccept');
  const cookieDecline = document.getElementById('cookieDecline');

  const closeCookieBanner = () => {
    cookieOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  };

  if (cookieOverlay) {
    document.body.style.overflow = 'hidden';
    cookieAccept?.addEventListener('click', closeCookieBanner);
    cookieDecline?.addEventListener('click', closeCookieBanner);
  }

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

  /* ── HERO 3D-LAPTOP SCROLL-PIN ──────────────────── */
  const heroPin  = document.querySelector('.hero-pin-outer');
  const laptop3d = document.getElementById('heroLaptop');

  if (heroPin && laptop3d) {
    const ORBIT_START = { theta: 95, phi: 78, radius: 92 }; // weggedreht (kommt von links)
    const ORBIT_END    = { theta: 18, phi: 72, radius: 82 };  // zugewandt
    const lerp = (a, b, t) => a + (b - a) * t;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const setOrbit = (progress) => {
      const theta  = lerp(ORBIT_START.theta, ORBIT_END.theta, progress);
      const phi    = lerp(ORBIT_START.phi, ORBIT_END.phi, progress);
      const radius = lerp(ORBIT_START.radius, ORBIT_END.radius, progress);
      // setAttribute statt Property: model-viewer ist ein async geladenes
      // Custom Element und liest die Attribute auch vor dem Upgrade korrekt ein.
      laptop3d.setAttribute('camera-orbit', `${theta}deg ${phi}deg ${radius}%`);
    };

    let ticking = false;
    const updateOrbit = () => {
      ticking = false;
      if (reducedMotionQuery.matches) return;
      const total = heroPin.offsetHeight - window.innerHeight;
      if (total <= 0) { setOrbit(1); return; }
      const scrolled = Math.min(Math.max(-heroPin.getBoundingClientRect().top, 0), total);
      setOrbit(scrolled / total);
    };

    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateOrbit);
      }
    };

    const applyModeChange = () => {
      if (reducedMotionQuery.matches) {
        setOrbit(1); // Modell direkt zugewandt zeigen, keine Scroll-Animation
      } else {
        updateOrbit();
      }
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    reducedMotionQuery.addEventListener('change', applyModeChange);
    applyModeChange();
  }

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

  /* ── CHATBOT ─────────────────────────────────────── */
  const chatMessages  = document.getElementById('chatMessages');
  const chatInputArea = document.getElementById('chatInputArea');
  const chatProgress  = document.getElementById('chatProgressBar');
  const chatLabel     = document.getElementById('chatProgressLabel');
  const chatSubtitle  = document.getElementById('chatSubtitle');
  const chatForm      = document.getElementById('chatForm');

  if (chatMessages) {

  const STEPS = [
    {
      id: 'website', field: 'cf_website',
      msg: '👋 Hallo! Ich bin Tim von TK Webtalent. Hast du bereits eine Website?',
      type: 'choice',
      choices: ['✅ Ja, aber sie braucht ein Update', '🆕 Nein, ich brauche eine neue', '🤔 Ich bin noch unsicher']
    },
    {
      id: 'beruf', field: 'cf_beruf',
      msg: 'Was machst du beruflich?',
      placeholder: 'z.B. Elektriker, Friseur, Coach…',
      type: 'text'
    },
    {
      id: 'ziel', field: 'cf_ziel',
      msg: 'Was ist dein wichtigstes Ziel mit der neuen Website?',
      type: 'choice',
      choices: ['📈 Mehr Kunden gewinnen', '🏆 Professioneller wirken', '🔍 Besser bei Google gefunden werden', '💡 Alles davon']
    },
    {
      id: 'budget', field: 'cf_budget',
      msg: 'Hast du schon eine Vorstellung vom Budget?',
      type: 'choice',
      choices: ['💶 Bis 500 €', '💶 500 € – 1.500 €', '💶 Über 1.500 €', '❓ Noch offen']
    },
    {
      id: 'name', field: 'cf_name',
      msg: 'Super! Wie darf ich dich ansprechen?',
      placeholder: 'Dein Name…',
      type: 'text'
    },
    {
      id: 'email', field: 'cf_email',
      msg: 'Und unter welcher E-Mail-Adresse kann ich dir das Angebot schicken?',
      placeholder: 'deine@email.de',
      type: 'email'
    }
  ];

  let currentStep = 0;

  function scrollChat() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addMsg(text, who) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + who;
    const av = document.createElement('div');
    av.className = 'msg-avatar';
    av.textContent = who === 'bot' ? 'TK' : '●';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(av);
    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    scrollChat();
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg bot';
    wrap.id = 'typingIndicator';
    const av = document.createElement('div');
    av.className = 'msg-avatar';
    av.textContent = 'TK';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble typing-bubble';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(av);
    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    scrollChat();
  }

  function removeTyping() {
    const t = document.getElementById('typingIndicator');
    if (t) t.remove();
  }

  function updateProgress(step) {
    const pct = Math.round((step / STEPS.length) * 100);
    if (chatProgress) chatProgress.style.width = pct + '%';
    if (chatLabel) chatLabel.textContent = step + ' / ' + STEPS.length;
  }

  function setAnswer(stepIdx, value) {
    const field = document.getElementById(STEPS[stepIdx].field);
    if (field) field.value = value;
  }

  function renderInput(step) {
    chatInputArea.innerHTML = '';
    if (!step) return;

    if (step.type === 'choice') {
      const wrap = document.createElement('div');
      wrap.className = 'chat-choices';
      step.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'chat-choice-btn';
        btn.textContent = c;
        btn.addEventListener('click', () => handleAnswer(c));
        wrap.appendChild(btn);
      });
      chatInputArea.appendChild(wrap);

    } else {
      const row = document.createElement('div');
      row.className = 'chat-text-row';
      const input = document.createElement('input');
      input.type = step.type || 'text';
      input.className = 'chat-text-input';
      input.placeholder = step.placeholder || '';
      const send = document.createElement('button');
      send.className = 'chat-send-btn';
      send.textContent = 'Weiter →';
      send.disabled = true;
      input.addEventListener('input', () => { send.disabled = input.value.trim() === ''; });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !send.disabled) handleAnswer(input.value.trim()); });
      send.addEventListener('click', () => { if (!send.disabled) handleAnswer(input.value.trim()); });
      row.appendChild(input);
      row.appendChild(send);
      chatInputArea.appendChild(row);
      setTimeout(() => input.focus(), 100);
    }
  }

  function handleAnswer(value) {
    chatInputArea.innerHTML = '';
    setAnswer(currentStep, value);
    addMsg(value, 'user');
    currentStep++;
    updateProgress(currentStep);

    if (currentStep >= STEPS.length) {
      // All done – show submit
      setTimeout(() => {
        showTyping();
        setTimeout(() => {
          removeTyping();
          addMsg('🎉 Perfekt! Ich hab alles was ich brauche. Klick unten auf „Angebot anfordern" und ich melde mich innerhalb von 24 Stunden bei dir!', 'bot');
          if (chatSubtitle) chatSubtitle.textContent = '✓ Fertig – fast geschafft!';
          const btn = document.createElement('button');
          btn.className = 'chat-submit-btn';
          btn.textContent = '📩 Angebot jetzt anfordern →';
          btn.addEventListener('click', () => {
            btn.textContent = 'Wird gesendet…';
            btn.disabled = true;
            chatForm.submit();
          });
          chatInputArea.appendChild(btn);
          scrollChat();
        }, 1400);
      }, 300);
      return;
    }

    const next = STEPS[currentStep];
    setTimeout(() => {
      showTyping();
      setTimeout(() => {
        removeTyping();
        addMsg(next.msg, 'bot');
        renderInput(next);
      }, 900 + Math.random() * 400);
    }, 400);
  }

  // Start conversation
  setTimeout(() => {
    showTyping();
    setTimeout(() => {
      removeTyping();
      addMsg(STEPS[0].msg, 'bot');
      renderInput(STEPS[0]);
      updateProgress(0);
    }, 1000);
  }, 500);

  } // end if (chatMessages)

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
