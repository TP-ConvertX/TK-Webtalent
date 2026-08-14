/* ===================================================
   TK WEBTALENT – LEAD-ANGEBOT PRÜFEN & FREIGEBEN
   Tim bekommt per E-Mail + Push einen Link hierher, sobald der
   KI-Chatbot ein Angebot vorgeschlagen hat.

   GET  ?id=<uuid>          → Review-Seite (KEINE Nebenwirkung!
                               E-Mail-Sicherheitsscanner rufen Links
                               manchmal automatisch vorab auf – daher
                               erst ein bewusster Klick, dann POST)
   POST { id, action }      → 'approve': Angebots-Mail an den Kunden
                               'reject':  Anfrage abgelehnt, keine Mail
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const { buildLeadOfferEmail, maintenancePriceEur, MAINTENANCE_PERCENT } = require('./_lead-helpers');
const { escapeHtml } = require('./_appointment-helpers');

const MAINTENANCE_LABELS = { ja: '✅ Ja, interessiert', nein: '❌ Kein Interesse', unsicher: '🤔 Unsicher' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(bodyHtml) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anfrage prüfen – TK Webtalent</title>
</head><body style="margin:0;padding:40px 20px;background:#F0F9FF;font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif;min-height:100vh;box-sizing:border-box">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 24px rgba(15,23,42,.08)">
  <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:24px">
    <img src="https://tk-webtalent.de/assets/logo-icon.png" width="32" height="32" alt="TK">
    <span style="font-size:16px;font-weight:700;color:#0F172A">TK Webtalent</span>
  </div>
  ${bodyHtml}
</div>
</body></html>`;
}

function row(label, val) {
  if (!val) return '';
  return `<p style="font-size:14px;color:#334155;margin:6px 0"><strong style="color:#0F172A">${escapeHtml(label)}:</strong> ${escapeHtml(val)}</p>`;
}

function renderTranscript(conversation) {
  if (!Array.isArray(conversation)) return '';
  const lines = conversation
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const text = typeof m.content === 'string'
        ? m.content
        : (Array.isArray(m.content) ? m.content.filter(b => b.type === 'text').map(b => b.text).join(' ') : '');
      if (!text) return '';
      const who = m.role === 'user' ? 'Kunde' : 'Tim (KI)';
      return `<p style="font-size:13px;color:#475569;margin:4px 0"><strong>${who}:</strong> ${escapeHtml(text)}</p>`;
    })
    .filter(Boolean);
  if (!lines.length) return '';
  return `<details style="margin-top:20px">
    <summary style="cursor:pointer;font-size:13px;font-weight:700;color:#0F172A">Chat-Verlauf anzeigen</summary>
    <div style="margin-top:10px;max-height:320px;overflow-y:auto;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 16px">${lines.join('')}</div>
  </details>`;
}

module.exports = async function handler(req, res) {
  const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.FROM_EMAIL || 'TK Webtalent <kontakt@tp-convertx.de>';

  const isJson = (req.headers['content-type'] || '').includes('application/json');
  const id = req.method === 'GET' ? req.query.id : (req.body || {}).id;
  const action = req.method === 'POST' ? (req.body || {}).action : null;

  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(400).send(page(`<h2 style="font-size:18px;color:#0F172A">Ungültiger Link</h2><p style="font-size:14px;color:#64748B">Dieser Link ist nicht gültig.</p>`));
    }
    return res.status(400).json({ error: 'invalid_id' });
  }

  const { data: lead } = await sbAdmin
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!lead) {
    const msg = `<h2 style="font-size:18px;color:#0F172A">Anfrage nicht gefunden</h2><p style="font-size:14px;color:#64748B">Diese Anfrage existiert nicht (mehr).</p>`;
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(404).send(page(msg));
    }
    return res.status(404).json({ error: 'not_found' });
  }

  /* ─── GET: Review-Seite, ändert noch NICHTS ─── */
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');

    if (lead.status !== 'pending_review') {
      const statusLabel = lead.status === 'sent' ? 'bereits freigegeben und versendet' : 'bereits abgelehnt';
      return res.status(200).send(page(`
        <h2 style="font-size:18px;color:#0F172A;margin-bottom:8px">Bereits bearbeitet</h2>
        <p style="font-size:14px;color:#64748B">Diese Anfrage wurde ${statusLabel}.</p>
      `));
    }

    return res.status(200).send(page(`
      <h2 style="font-size:18px;color:#0F172A;margin-bottom:4px">Neue Anfrage prüfen</h2>
      <p style="font-size:13px;color:#94A3B8;margin-bottom:16px">Preis bei Bedarf anpassen, dann Angebot freigeben oder ablehnen.</p>
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:16px 18px;margin:16px 0;text-align:center">
        <label for="priceInput" style="display:block;font-size:12px;color:#0369A1;font-weight:600;margin-bottom:8px">Projekt-Preis (anpassbar)</label>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px">
          <input type="number" id="priceInput" form="approveForm" name="price" value="${lead.suggested_price_eur}" min="1" step="1"
            style="width:130px;text-align:center;font-size:22px;font-weight:800;color:#0F172A;padding:8px;border:1.5px solid #BAE6FD;border-radius:8px;font-family:inherit">
          <span style="font-size:22px;font-weight:800;color:#0F172A">€</span>
        </div>
        <p style="font-size:12px;color:#0369A1;margin-top:10px">Betreuung/Monat bei Zusage: <strong id="maintenancePreview">${maintenancePriceEur(lead.suggested_price_eur)}</strong> € (${MAINTENANCE_PERCENT}% des Projekt-Preises)</p>
      </div>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin:16px 0">
        ${row('Name', lead.name)}
        ${row('E-Mail', lead.email)}
        ${row('Beruf/Branche', lead.profession)}
        ${row('Bestehende Website', lead.current_website)}
        ${row('Hauptziel', lead.main_goal)}
        ${row('Projekt-Details', lead.project_details)}
        ${row('Budget-Hinweis', lead.budget_hint)}
      </div>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="font-size:13px;color:#92400E;margin:0"><strong>Preis-Begründung (KI):</strong> ${escapeHtml(lead.price_reasoning)}</p>
      </div>
      ${lead.design_direction ? `<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="font-size:13px;color:#5B21B6;margin:0"><strong>🎨 Design-Idee (KI):</strong> ${escapeHtml(lead.design_direction)}</p>
      </div>` : ''}
      ${lead.wants_maintenance ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="font-size:13px;color:#166534;margin:0"><strong>🔧 Betreuung:</strong> ${escapeHtml(MAINTENANCE_LABELS[lead.wants_maintenance] || lead.wants_maintenance)}</p>
      </div>` : ''}
      ${renderTranscript(lead.conversation)}
      <div style="display:flex;gap:10px;margin-top:24px">
        <form method="POST" action="/api/lead-review" id="approveForm" style="flex:1">
          <input type="hidden" name="id" value="${lead.id}">
          <input type="hidden" name="action" value="approve">
          <button type="submit" style="width:100%;padding:13px;background:#0EA5E9;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">✅ Angebot senden</button>
        </form>
        <form method="POST" action="/api/lead-review" style="flex:1">
          <input type="hidden" name="id" value="${lead.id}">
          <input type="hidden" name="action" value="reject">
          <button type="submit" style="width:100%;padding:13px;background:#fff;color:#64748B;border:1.5px solid #E2E8F0;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Ablehnen</button>
        </form>
      </div>
      <script>
        document.getElementById('priceInput').addEventListener('input', function () {
          var v = parseFloat(this.value) || 0;
          document.getElementById('maintenancePreview').textContent = Math.round(v * ${MAINTENANCE_PERCENT} / 100);
        });
      </script>
    `));
  }

  /* ─── POST: Freigabe oder Ablehnung wirklich ausführen ─── */
  if (req.method !== 'POST') return res.status(405).end();

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'invalid_action' });
  }

  if (lead.status !== 'pending_review') {
    if (isJson) return res.status(409).json({ error: 'already_reviewed' });
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.status(409).send(page(`<h2 style="font-size:18px;color:#0F172A">Bereits bearbeitet</h2><p style="font-size:14px;color:#64748B">Diese Anfrage wurde bereits bearbeitet.</p>`));
  }

  if (action === 'approve') {
    /* Tim kann den KI-vorgeschlagenen Preis vor dem Versand anpassen –
       fällt bei fehlendem/ungültigem Wert auf den ursprünglichen
       Vorschlag zurück. Die Betreuungskosten (15%) werden aus diesem
       finalen Preis neu berechnet, nicht aus dem KI-Vorschlag. */
    const submittedPrice = Math.round(Number((req.body || {}).price));
    const finalPriceEur = (Number.isFinite(submittedPrice) && submittedPrice > 0) ? submittedPrice : lead.suggested_price_eur;
    const finalLead = { ...lead, suggested_price_eur: finalPriceEur };

    if (RESEND_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: lead.email,
            subject: 'Dein persönliches Angebot – TK Webtalent',
            html: buildLeadOfferEmail(finalLead),
          }),
        });
        if (!r.ok) console.error('[lead-review] Resend (Kunde):', await r.text());
      } catch (e) {
        console.error('[lead-review] E-Mail-Fehler (Kunde):', e.message);
      }
    }
    await sbAdmin.from('leads').update({ status: 'sent', reviewed_at: new Date().toISOString(), suggested_price_eur: finalPriceEur }).eq('id', id);
  } else {
    await sbAdmin.from('leads').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id);
  }

  if (isJson) {
    return res.status(200).json({ ok: true, status: action === 'approve' ? 'sent' : 'rejected' });
  }

  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  return res.status(200).send(page(action === 'approve'
    ? `<div style="font-size:40px;margin-bottom:8px">✅</div><h2 style="font-size:18px;color:#0F172A;margin-bottom:8px">Angebot gesendet</h2><p style="font-size:14px;color:#64748B">${escapeHtml(lead.name)} erhält jetzt das Angebot per E-Mail.</p>`
    : `<div style="font-size:40px;margin-bottom:8px">🚫</div><h2 style="font-size:18px;color:#0F172A;margin-bottom:8px">Anfrage abgelehnt</h2><p style="font-size:14px;color:#64748B">Es wurde keine E-Mail an den Kunden verschickt.</p>`
  ));
};
