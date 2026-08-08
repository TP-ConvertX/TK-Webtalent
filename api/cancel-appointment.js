/* ===================================================
   TK WEBTALENT – TERMIN STORNIEREN
   Zentrale Storno-Route für alle drei Buchungswege
   (Gast-E-Mail-Link, Kundenbereich, Admin-Bereich).
   Kündigt bei Zoom-Terminen auch das Zoom-Meeting,
   benachrichtigt danach immer Kunde + Admin.

   GET  ?id=<uuid>  → Bestätigungsseite (kein Auto-Storno!
                       E-Mail-Sicherheitsscanner rufen Links
                       manchmal automatisch vorab auf – daher
                       erst ein bewusster Klick, dann POST)
   POST { id }      → storniert wirklich, sendet Benachrichtigungen
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const {
  apptTypeLabel,
  deleteZoomMeeting,
  emailTpl,
  emailBox,
} = require('./_appointment-helpers');

const CAL_DAYS   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const CAL_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function formatAppt(dateStr, timeStr) {
  const d    = new Date(dateStr + 'T12:00:00');
  const endH = parseInt(timeStr) + 1;
  return CAL_DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + CAL_MONTHS[d.getMonth()] + ' '
    + d.getFullYear() + ' · ' + timeStr.slice(0,5) + ' – '
    + String(endH).padStart(2,'0') + ':00 Uhr';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(bodyHtml) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Termin stornieren – TK Webtalent</title>
</head><body style="margin:0;padding:40px 20px;background:#F0F9FF;font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif;min-height:100vh;box-sizing:border-box">
<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 24px rgba(15,23,42,.08);text-align:center">
  <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:24px">
    <img src="https://tk-webtalent.de/assets/logo-icon.png" width="32" height="32" alt="TK">
    <span style="font-size:16px;font-weight:700;color:#0F172A">TK Webtalent</span>
  </div>
  ${bodyHtml}
</div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const FROM        = process.env.FROM_EMAIL || 'TK Webtalent <kontakt@tp-convertx.de>';

  const isJson = (req.headers['content-type'] || '').includes('application/json');
  const id = req.method === 'GET' ? req.query.id : (req.body || {}).id;

  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(400).send(page(`<h2 style="font-size:18px;color:#0F172A">Ungültiger Link</h2><p style="font-size:14px;color:#64748B">Dieser Storno-Link ist nicht gültig.</p>`));
    }
    return res.status(400).json({ error: 'invalid_id' });
  }

  const { data: appt } = await sbAdmin
    .from('appointments')
    .select('id, customer_id, appointment_date, appointment_time, status, appointment_type, guest_name, guest_email, zoom_join_url')
    .eq('id', id)
    .maybeSingle();

  if (!appt || appt.status !== 'confirmed') {
    const msg = `<h2 style="font-size:18px;color:#0F172A">Termin nicht gefunden</h2><p style="font-size:14px;color:#64748B">Dieser Termin wurde bereits storniert oder existiert nicht (mehr).</p>`;
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.status(404).send(page(msg));
    }
    return res.status(404).json({ error: 'not_found' });
  }

  const fmt = formatAppt(appt.appointment_date, appt.appointment_time.slice(0, 5));
  const typeLbl = apptTypeLabel(appt.appointment_type);

  /* ─── GET: Bestätigungsseite, storniert noch NICHTS ─── */
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.status(200).send(page(`
      <h2 style="font-size:18px;color:#0F172A;margin-bottom:8px">Termin wirklich stornieren?</h2>
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px;font-weight:700;color:#0F172A">
        📅 ${fmt}<br><span style="font-weight:500;font-size:13px;color:#475569">${typeLbl}</span>
      </div>
      <form method="POST" action="/api/cancel-appointment">
        <input type="hidden" name="id" value="${appt.id}">
        <button type="submit" style="width:100%;padding:13px;background:#0F172A;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">Ja, Termin stornieren</button>
      </form>
      <p style="font-size:12px;color:#94A3B8;margin-top:16px">Nichts tun, um den Termin zu behalten.</p>
    `));
  }

  /* ─── POST: jetzt wirklich stornieren ─── */
  if (req.method !== 'POST') return res.status(405).end();

  await sbAdmin.from('appointments').update({ status: 'cancelled' }).eq('id', id);

  if (appt.zoom_join_url) {
    await deleteZoomMeeting(appt.zoom_join_url);
  }

  /* Kunden-Identität auflösen: eingeloggter Kunde vs. Gast */
  let customerEmail = appt.guest_email;
  let customerName  = appt.guest_name || 'Kunde';

  if (appt.customer_id) {
    const { data: { user: cu } } = await sbAdmin.auth.admin.getUserById(appt.customer_id);
    customerEmail = cu?.email || null;
    const { data: pf } = await sbAdmin.from('profiles').select('full_name').eq('id', appt.customer_id).single();
    customerName = pf?.full_name || 'Kunde';
  }

  /* Immer beide benachrichtigen */
  if (RESEND_KEY) {
    const h1 = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
    const p  = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;

    const mails = [
      {
        from: FROM, to: customerEmail,
        subject: 'Termin storniert – TK Webtalent',
        html: emailTpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin storniert')}
          ${p(`Dein Termin (<strong>${typeLbl}</strong>) wurde storniert.`)}
          ${emailBox(fmt)}
          ${p('Du möchtest einen neuen Termin vereinbaren? Einfach über die Website erneut buchen.')}
        `)
      },
      {
        from: FROM, to: ADMIN_EMAIL,
        subject: `❌ Termin storniert: ${customerName}`,
        html: emailTpl(`
          ${h1('Termin storniert')}
          ${p(`<strong>${customerName}</strong>s Termin (<strong>${typeLbl}</strong>) wurde storniert.`)}
          ${emailBox(fmt)}
          ${p('Das Zeitfenster ist wieder frei.')}
        `)
      }
    ];

    for (const mail of mails) {
      if (!mail.to) continue;
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(mail)
        });
        if (!r.ok) console.error('[cancel-appointment] Resend:', await r.text());
      } catch (e) {
        console.error('[cancel-appointment] E-Mail-Fehler:', e.message);
      }
    }
  }

  if (isJson) {
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  return res.status(200).send(page(`
    <div style="font-size:40px;margin-bottom:8px">✅</div>
    <h2 style="font-size:18px;color:#0F172A;margin-bottom:8px">Termin storniert</h2>
    <p style="font-size:14px;color:#64748B">Dein Termin am ${fmt} wurde storniert. Du erhältst gleich eine Bestätigung per E-Mail.</p>
  `));
};
