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

  /* ── HERO 3D-GLASKARTE: dreht sich beim Scrollen ──
     Kein Sticky-Pin mehr (führte dazu, dass die Seite beim Scrollen
     "hängen blieb") – die Karte dreht sich stattdessen anhand des
     ganz normalen Scroll-Fortschritts, während der Hero-Bereich
     selbst normal wegscrollt. */
  const heroPin = document.querySelector('.hero-pin-outer');

  if (heroPin) {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let ticking = false;
    const updateProgress = () => {
      ticking = false;
      if (reducedMotionQuery.matches) return;
      const rect = heroPin.getBoundingClientRect();
      const total = rect.height || 1;
      const progress = Math.min(Math.max(-rect.top, 0), total) / total;
      window.heroGlassCard?.setProgress(progress);
    };

    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    };

    const applyModeChange = () => {
      if (reducedMotionQuery.matches) {
        window.heroGlassCard?.setProgress(1); // direkt zugewandt zeigen, keine Scroll-Animation
      } else {
        updateProgress();
      }
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    reducedMotionQuery.addEventListener('change', applyModeChange);
    applyModeChange();
  }

  /* ── FENSTER-DURCHBLICK SCROLL-PIN ───────────────── */
  const windowSection = document.querySelector('.window-section');
  const windowTrack   = document.getElementById('windowTrack');

  const windowCta = document.getElementById('windowCta');

  if (windowSection && windowTrack) {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let maxTranslate = 0;

    const measure = () => {
      maxTranslate = Math.max(0, windowTrack.scrollWidth - windowTrack.parentElement.clientWidth);
    };

    let ticking = false;
    const updateProgress = () => {
      ticking = false;
      if (reducedMotionQuery.matches) {
        windowTrack.style.transform = '';
        windowCta?.classList.add('visible'); // kein Scroll-Trick, Button gleich zeigen
        return;
      }
      const rect = windowSection.getBoundingClientRect();
      const total = rect.height || 1;
      const progress = Math.min(Math.max(-rect.top, 0), total) / total;
      windowTrack.style.transform = `translateX(-${progress * maxTranslate}px)`;
      windowCta?.classList.toggle('visible', progress >= 0.92);
    };

    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    };

    const remeasureAndUpdate = () => { measure(); updateProgress(); };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', remeasureAndUpdate, { passive: true });
    reducedMotionQuery.addEventListener('change', remeasureAndUpdate);
    remeasureAndUpdate();
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

  /* ── CHATBOT (KI-geführt, api/chat.js) ───────────── */
  const chatMessages  = document.getElementById('chatMessages');
  const chatInputArea = document.getElementById('chatInputArea');
  const chatSubtitle  = document.getElementById('chatSubtitle');

  if (chatMessages) {

  const OPENING_MESSAGE = '👋 Hallo! Ich bin der digitale Assistent von TK Webtalent. Möchtest du ein unverbindliches Angebot für dein Projekt, oder hast du erstmal eine Frage?';

  let conversationHistory = [];
  let chatBusy  = false;
  let chatDone  = false;

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

  function renderInputRow(choices) {
    chatInputArea.innerHTML = '';

    if (Array.isArray(choices) && choices.length) {
      const choicesWrap = document.createElement('div');
      choicesWrap.className = 'chat-choices';
      choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-choice-btn';
        btn.textContent = choice;
        btn.addEventListener('click', () => { if (!chatBusy) sendUserMessage(choice, null); });
        choicesWrap.appendChild(btn);
      });
      chatInputArea.appendChild(choicesWrap);
    }

    const row = document.createElement('div');
    row.className = 'chat-text-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chat-text-input';
    input.placeholder = 'Deine Antwort…';
    const send = document.createElement('button');
    send.className = 'chat-send-btn';
    send.textContent = 'Senden →';
    send.disabled = true;
    input.addEventListener('input', () => { send.disabled = input.value.trim() === '' || chatBusy; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !send.disabled) sendUserMessage(input.value.trim(), input); });
    send.addEventListener('click', () => { if (!send.disabled) sendUserMessage(input.value.trim(), input); });
    row.appendChild(input);
    row.appendChild(send);
    chatInputArea.appendChild(row);
  }

  function renderDoneStatus() {
    chatInputArea.innerHTML = '';
    const status = document.createElement('p');
    status.style.cssText = 'font-size:13px;color:#64748B;text-align:center;padding:6px 0';
    status.textContent = '✓ Tim prüft deine Anfrage und meldet sich per E-Mail bei dir.';
    chatInputArea.appendChild(status);
  }

  async function sendUserMessage(value, input) {
    if (!value || chatBusy || chatDone) return;
    chatBusy = true;
    if (input) { input.value = ''; input.disabled = true; }
    const sendBtn = chatInputArea.querySelector('.chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    addMsg(value, 'user');
    conversationHistory.push({ role: 'user', content: value });
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });
      const data = await res.json();
      removeTyping();

      if (!res.ok || !data.reply) {
        addMsg('Entschuldige, gerade gibt es ein technisches Problem. Versuch es gleich nochmal oder schreib mir direkt eine E-Mail.', 'bot');
        if (input) { input.disabled = false; }
        chatBusy = false;
        return;
      }

      addMsg(data.reply, 'bot');
      conversationHistory.push({ role: 'assistant', content: data.reply });

      if (data.done) {
        chatDone = true;
        if (chatSubtitle) chatSubtitle.textContent = '✓ Anfrage übermittelt';
        renderDoneStatus();
      } else {
        chatBusy = false;
        renderInputRow(data.choices);
      }
    } catch (e) {
      removeTyping();
      addMsg('Verbindungsproblem – bitte versuch es gleich nochmal.', 'bot');
      if (input) { input.disabled = false; }
      chatBusy = false;
    }
  }

  // Start conversation
  setTimeout(() => {
    showTyping();
    setTimeout(() => {
      removeTyping();
      addMsg(OPENING_MESSAGE, 'bot');
      conversationHistory.push({ role: 'assistant', content: OPENING_MESSAGE });
      renderInputRow();
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
