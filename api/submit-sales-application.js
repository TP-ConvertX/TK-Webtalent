/* ===================================================
   TK WEBTALENT – VERTRIEBSPARTNER-BEWERBUNG
   Nimmt die vollständigen Antworten aus vertriebspartner.html entgegen
   (nur Kandidaten, die alle Vorqualifikations-Fragen bestanden haben –
   automatische Ausstiege werden hier NIE mit persönlichen Daten
   angefragt, siehe api/track-funnel-event.js dafür).
   Berechnet serverseitig die interne Einstufung, speichert die
   Bewerbung und benachrichtigt Tim per Resend (gleiche Konvention wie
   api/send-ersteinschaetzung.js).
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const { emailTpl, emailBox, escapeHtml } = require('./_appointment-helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s/]{6,}$/;

function classify(a) {
  const erfahrenGenug   = a.vertriebserfahrung === 'Mehrere Jahre Erfahrung';
  const etwasErfahrung  = a.vertriebserfahrung === 'Etwas Erfahrung';
  const kaltakquiseGut  = ['Wohl', 'Sehr wohl'].includes(a.kaltakquise);
  const kaltakquiseOk   = ['Grundsätzlich okay', 'Wohl', 'Sehr wohl'].includes(a.kaltakquise);
  const highTicket      = a.high_ticket_erfahrung === 'Ja';
  const telefonBereit   = a.telefonakquise_bereit === 'Ja';
  const selbststaendig  = a.selbststaendig === 'Ja';
  const selbststaendigMoeglich = ['Ja', 'Noch nicht, wäre aber möglich'].includes(a.selbststaendig);

  if (erfahrenGenug && kaltakquiseGut && highTicket && telefonBereit && selbststaendig) {
    return 'Sehr interessant';
  }
  if (etwasErfahrung && kaltakquiseOk && highTicket && selbststaendigMoeglich) {
    return 'Interessant';
  }
  return 'Prüfen';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const b = req.body || {};

  const required = [
    'vorname', 'nachname', 'email', 'telefon',
    'vertriebserfahrung', 'kaltakquise', 'high_ticket_erfahrung',
    'telefonakquise_bereit', 'zeit_pro_woche', 'provisionsmodell_akzeptiert',
    'selbststaendig', 'einwilligung',
  ];
  for (const field of required) {
    if (!b[field] && b[field] !== false) return res.status(400).json({ error: `Feld fehlt: ${field}` });
  }
  if (b.einwilligung !== true) return res.status(400).json({ error: 'Einwilligung fehlt' });
  if (!EMAIL_RE.test(b.email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  if (!PHONE_RE.test(b.telefon)) return res.status(400).json({ error: 'Ungültige Telefonnummer' });

  const interneEinstufung = classify(b);

  const row = {
    vorname:                     String(b.vorname).trim(),
    nachname:                    String(b.nachname).trim(),
    email:                       String(b.email).trim(),
    telefon:                     String(b.telefon).trim(),
    linkedin:                    b.linkedin ? String(b.linkedin).trim() : null,
    website:                     b.website ? String(b.website).trim() : null,

    vertriebserfahrung:          b.vertriebserfahrung,
    vertriebserfahrung_details:  Array.isArray(b.vertriebserfahrung_details) ? b.vertriebserfahrung_details : null,
    vertriebsdauer:              b.vertriebsdauer || null,
    bisherige_produkte:          b.bisherige_produkte ? String(b.bisherige_produkte).trim() : null,

    kaltakquise:                 b.kaltakquise,
    akquiseart:                  Array.isArray(b.akquiseart) ? b.akquiseart : null,

    high_ticket_erfahrung:       b.high_ticket_erfahrung,
    high_ticket_details:         b.high_ticket_details ? String(b.high_ticket_details).trim() : null,
    hoechster_verkaufswert:      b.hoechster_verkaufswert || null,

    telefonakquise_bereit:       b.telefonakquise_bereit,
    zeit_pro_woche:              b.zeit_pro_woche,
    provisionsmodell_akzeptiert: b.provisionsmodell_akzeptiert,
    selbststaendig:              b.selbststaendig,

    vertriebsstaerken:           Array.isArray(b.vertriebsstaerken) ? b.vertriebsstaerken : null,
    motivation:                  b.motivation ? String(b.motivation).trim() : null,

    interne_einstufung:          interneEinstufung,
    status:                      'Neu',
  };

  const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: inserted, error: insertErr } = await sbAdmin
    .from('sales_applications')
    .insert(row)
    .select('id')
    .single();

  if (insertErr) {
    console.error('[submit-sales-application] insert error:', insertErr);
    return res.status(500).json({ error: 'Speichern fehlgeschlagen' });
  }

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const FROM        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';

  if (RESEND_KEY) {
    const list = (arr) => Array.isArray(arr) && arr.length ? arr.map(escapeHtml).join(', ') : '—';
    const row2 = (label, val) => `<p style="font-size:13px;color:#475569;margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${val || '—'}</p>`;

    const html = emailTpl(`
      <p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">🆕 Neue Vertriebspartner-Bewerbung</p>
      ${emailBox(`Einstufung: ${escapeHtml(interneEinstufung)}`)}
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin:16px 0">
        ${row2('Name', escapeHtml(`${row.vorname} ${row.nachname}`))}
        ${row2('E-Mail', `<a href="mailto:${escapeHtml(row.email)}" style="color:#0EA5E9">${escapeHtml(row.email)}</a>`)}
        ${row2('Telefon', escapeHtml(row.telefon))}
        ${row.linkedin ? row2('LinkedIn', `<a href="${escapeHtml(row.linkedin)}" style="color:#0EA5E9">${escapeHtml(row.linkedin)}</a>`) : ''}
        ${row.website ? row2('Website', escapeHtml(row.website)) : ''}
      </div>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin:16px 0">
        ${row2('Vertriebserfahrung', escapeHtml(row.vertriebserfahrung))}
        ${row.vertriebserfahrung_details ? row2('Erfahrung aus', list(row.vertriebserfahrung_details)) : ''}
        ${row.vertriebsdauer ? row2('Dauer', escapeHtml(row.vertriebsdauer)) : ''}
        ${row.bisherige_produkte ? row2('Bisher verkauft', escapeHtml(row.bisherige_produkte)) : ''}
        ${row2('Kaltakquise', escapeHtml(row.kaltakquise))}
        ${row.akquiseart ? row2('Bevorzugte Akquiseart', list(row.akquiseart)) : ''}
        ${row2('High-Ticket-Erfahrung', escapeHtml(row.high_ticket_erfahrung))}
        ${row.high_ticket_details ? row2('High-Ticket-Details', escapeHtml(row.high_ticket_details)) : ''}
        ${row.hoechster_verkaufswert ? row2('Höchster Verkaufswert', escapeHtml(row.hoechster_verkaufswert)) : ''}
        ${row2('Telefonakquise bereit', escapeHtml(row.telefonakquise_bereit))}
        ${row2('Zeit/Woche', escapeHtml(row.zeit_pro_woche))}
        ${row2('Provisionsmodell akzeptiert', escapeHtml(row.provisionsmodell_akzeptiert))}
        ${row2('Selbstständig/Gewerbe', escapeHtml(row.selbststaendig))}
        ${row.vertriebsstaerken ? row2('Stärken', list(row.vertriebsstaerken)) : ''}
      </div>
      ${row.motivation ? `<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="font-size:13px;color:#5B21B6;margin:0"><strong>Motivation:</strong> ${escapeHtml(row.motivation)}</p>
      </div>` : ''}
    `);

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: ADMIN_EMAIL,
          subject: `Neue Vertriebspartner-Bewerbung – ${row.vorname} ${row.nachname}`,
          html,
        }),
      });
      if (!r.ok) console.error('[submit-sales-application] Resend:', await r.text());
    } catch (e) {
      console.error('[submit-sales-application] E-Mail-Fehler:', e.message);
    }
  }

  return res.status(200).json({ ok: true, id: inserted.id });
};
