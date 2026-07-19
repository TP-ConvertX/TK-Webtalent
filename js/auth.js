/* ===================================================
   TK WEBTALENT – AUTH UTILITIES
   Gemeinsam genutzt von Login, Kundenbereich und Admin
   =================================================== */

let _client = null;

function getSB() {
  if (!_client) {
    _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return _client;
}

async function getSession() {
  const { data: { session } } = await getSB().auth.getSession();
  return session;
}

/* Leitet zur Login-Seite um, wenn kein aktiver Login */
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/kunden-login';
    return null;
  }
  return session;
}

/* Leitet um, wenn der Nutzer kein aktiver Admin ist */
async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/kunden-login';
    return null;
  }
  const { data: profile, error } = await getSB()
    .from('profiles')
    .select('role, active, full_name')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || profile.role !== 'admin' || !profile.active) {
    window.location.href = '/';
    return null;
  }
  return { session, profile };
}

async function signOut() {
  await getSB().auth.signOut();
  window.location.href = '/kunden-login';
}

/* Toast-Benachrichtigung (success | error | default) */
function showToast(msg, type = 'default') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const PHASES = ['Planung', 'Design', 'Entwicklung', 'Überarbeitung', 'Freigabe', 'Veröffentlicht'];

function buildPhaseHTML(currentStatus) {
  const currentIdx = PHASES.indexOf(currentStatus);
  let html = '<div class="phase-track">';
  PHASES.forEach((phase, i) => {
    let cls = '';
    if (i < currentIdx) cls = 'done';
    else if (i === currentIdx) cls = 'active';
    const dot = i < currentIdx ? '✓' : (i + 1);
    html += `<div class="phase-step ${cls}">
      <div class="phase-dot">${dot}</div>
      <div class="phase-name">${phase}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function statusBadgeClass(status) {
  const map = {
    'Planung':       'badge-gray',
    'Design':        'badge-blue',
    'Entwicklung':   'badge-orange',
    'Überarbeitung': 'badge-purple',
    'Freigabe':      'badge-orange',
    'Veröffentlicht':'badge-green'
  };
  return map[status] || 'badge-gray';
}
