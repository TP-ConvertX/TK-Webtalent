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

  /* Bild 2 (Fullscreen-Break zwischen Pakete & Ablauf): eigener, kleiner
     Observer ohne Stagger-Verzögerung, weil die Section direkt in <main>
     hängt und sonst fälschlich mit ALLEN .reveal-Elementen der Seite
     "gruppiert" würde (siehe Kommentar im CSS). */
  const imgwin2 = document.getElementById('imgwin2');
  if (imgwin2) {
    const imgwin2Observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            imgwin2.classList.add('visible');
            imgwin2Observer.unobserve(imgwin2);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    imgwin2Observer.observe(imgwin2);
  }

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
      /* Nicht über die komplette Hero-Höhe strecken, sonst verteilt sich die
         Drehung über eine so lange Scrollstrecke, dass man beim normalen
         Scrollen kaum eine Veränderung wahrnimmt. Stattdessen reicht ein
         kurzer Scroll (max. 420px) bis zum "Endanschlag". */
      const total = Math.min(rect.height || 1, 420);
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

  /* ── FENSTER-DURCHBLICK SCROLL-PIN (+ integriertes Bild 1) ──────
     EIN durchgehender Sticky-Pin über die ganze Sektion. Die Sektion
     wurde per CSS auf 400vh verlängert (war 200vh) – die ERSTEN 100vh
     Scrollstrecke steuern exakt wie vorher das Karussell (unverändert),
     die ZUSÄTZLICHEN 200vh danach steuern Bild 1: es öffnet sich als
     kleines Fenster, wächst randlos auf 100vw×100vh und hält dort, bis
     der Pin ganz normal endet. Beides läuft aus DERSELBEN rect-Messung,
     damit es sich wie eine einzige zusammenhängende Sequenz anfühlt. */
  const windowSection = document.querySelector('.window-section');
  const windowTrack   = document.getElementById('windowTrack');
  const imgwin1        = document.getElementById('imgwin1Frame');
  const imgwin1Img     = imgwin1?.querySelector('img');

  const windowCta = document.getElementById('windowCta');

  if (windowSection && windowTrack) {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
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
      const vh = window.innerHeight;
      const scrolled = Math.max(-rect.top, 0);

      /* Karussell-Phase: exakt die gleiche Scrollstrecke (1 Viewport-
         Höhe) wie vor der Bild-Integration – unverändertes Verhalten. */
      const carouselTotal = vh;
      const carouselProgress = Math.min(scrolled, carouselTotal) / carouselTotal;
      windowTrack.style.transform = `translateX(-${carouselProgress * maxTranslate}px)`;
      windowCta?.classList.toggle('visible', carouselProgress >= 0.92);

      /* Bild-1-Phase: die komplette REST-Scrollstrecke der Sektion,
         erst NACHDEM die Karussell-Phase durchgescrollt ist. Kein
         Opacity-Fade mehr, kein Rahmen/Ecken – nur eine horizontale
         Blende, die sich von komplett geschlossen (0px) auf echtes
         Fullscreen öffnet, plus ein durchgehender langsamer Zoom auf
         dem Bild selbst für den "lebendige Bildsequenz"-Eindruck. */
      if (imgwin1) {
        const imgPhaseTotal = Math.max(rect.height - vh - carouselTotal, 1);
        const imgProgress = Math.min(Math.max(scrolled - carouselTotal, 0), imgPhaseTotal) / imgPhaseTotal;

        const growP = Math.min(imgProgress / 0.5, 1); // 0–50%: Blende öffnet sich zu Fullscreen
        const eased = easeOutCubic(growP);
        const band = lerp(50, 0, eased); // vh Abstand oben/unten

        imgwin1.style.top = `${band}vh`;
        imgwin1.style.bottom = `${band}vh`;
        if (imgwin1Img) {
          const zoom = lerp(1, 1.14, imgProgress); // durchgehend über die ganze Bildphase
          imgwin1Img.style.transform = `scale(${zoom})`;
        }
      }
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

  /* ── BILD 2: leichter Parallax-Drift statt statischem Foto ──────
     Kein Sticky, kein Pin – die Section scrollt ganz normal mit. Nur
     das <img> darin (per CSS überdimensioniert: 140% Höhe) verschiebt
     sich leicht abhängig davon, wie nah die Sektionsmitte an der
     Viewport-Mitte ist, damit es sich wie eine Hintergrund-Bildebene
     mit Tiefe anfühlt statt wie ein flach eingesetztes Standbild. */
  const imgwin2El = document.getElementById('imgwin2');
  if (imgwin2El) {
    const img2 = imgwin2El.querySelector('img');
    const reducedMotionQuery2 = window.matchMedia('(prefers-reduced-motion: reduce)');
    let ticking2 = false;
    const updateImgwin2Parallax = () => {
      ticking2 = false;
      if (reducedMotionQuery2.matches || !img2) return;
      const rect = imgwin2El.getBoundingClientRect();
      const vh = window.innerHeight;
      const center = rect.top + rect.height / 2;
      const offset = (center - vh / 2) * -0.15;
      img2.style.transform = `translateY(${offset}px)`;
    };
    const requestImgwin2Parallax = () => {
      if (!ticking2) { ticking2 = true; requestAnimationFrame(updateImgwin2Parallax); }
    };
    window.addEventListener('scroll', requestImgwin2Parallax, { passive: true });
    window.addEventListener('resize', requestImgwin2Parallax, { passive: true });
    updateImgwin2Parallax();
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
