/* ===================================================
   TK WEBTALENT – EINWILLIGUNGSVERWALTUNG
   Speichert die Entscheidung des Besuchers (localStorage-Eintrag
   "tkw_consent", technisch notwendig) und lädt optionale Dienste
   (aktuell: Vercel Web Analytics) ausschließlich nach Zustimmung.
   Ohne Zustimmung wird das Skript nicht einmal angefordert.
   =================================================== */
(function () {
  var KEY = 'tkw_consent';

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return v && typeof v.analytics === 'boolean' ? v : null;
    } catch (e) { return null; }
  }

  function write(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: analytics, ts: Date.now() })); } catch (e) {}
  }

  var analyticsLoaded = false;
  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
  }

  var stored = read();
  if (stored && stored.analytics) loadAnalytics();

  document.addEventListener('DOMContentLoaded', function () {
    var overlay = document.getElementById('cookieOverlay');
    if (!overlay) return;

    function show() {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function hide() {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    function decide(analytics) {
      var wasOn = analyticsLoaded;
      write(analytics);
      hide();
      if (analytics) loadAnalytics();
      else if (wasOn) location.reload(); /* bereits geladenes Skript sauber entfernen */
    }

    var accept = document.getElementById('cookieAccept');
    var decline = document.getElementById('cookieDecline');
    if (accept) accept.addEventListener('click', function () { decide(true); });
    if (decline) decline.addEventListener('click', function () { decide(false); });

    document.querySelectorAll('[data-cookie-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); show(); });
    });

    if (read()) hide(); else show();
  });

  window.tkConsent = { get: read };
})();
