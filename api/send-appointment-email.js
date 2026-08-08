/* ===================================================
   TK WEBTALENT – TERMIN-E-MAIL (Resend)
   Versendet Bestätigungs- und Benachrichtigungs-Mails
   via Resend bei Buchung oder Absage.
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const { apptTypeLabel, apptZoomNote } = require('./_appointment-helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  /* Auth-Token prüfen */
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await sbAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const FROM        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';

  /* Resend nicht konfiguriert → still überspringen */
  if (!RESEND_KEY) {
    console.warn('[email] RESEND_API_KEY nicht gesetzt – übersprungen');
    return res.status(200).json({ ok: true, skipped: true });
  }

  const {
    type,
    customerId,
    date,
    time,
    formattedDate,
    appointmentType,
    customerEmail: passedEmail,
    customerName:  passedName
  } = req.body;

  let customerEmail = passedEmail;
  let customerName  = passedName || 'Kunde';

  /* Kunden-E-Mail über Service Role nachschlagen (Admin-Aktionen) */
  if (customerId && !customerEmail) {
    const { data: { user: cu } } = await sbAdmin.auth.admin.getUserById(customerId);
    customerEmail = cu?.email || null;

    if (!passedName) {
      const { data: pf } = await sbAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', customerId)
        .single();
      customerName = pf?.full_name || 'Kunde';
    }
  }

  const fmt = formattedDate || `${date} ${time}`;
  const mails = buildEmails(type, {
    customerEmail,
    customerName,
    formattedDate: fmt,
    appointmentType,
    adminEmail: ADMIN_EMAIL,
    from: FROM
  });

  for (const mail of mails) {
    if (!mail.to) continue;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify(mail)
      });
      if (!r.ok) console.error('[email] Resend:', await r.text());
    } catch (e) {
      console.error('[email] Netzwerkfehler:', e.message);
    }
  }

  return res.status(200).json({ ok: true });
};

/* ─── E-Mail-Template ─── */
function tpl(body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head><body style="margin:0;padding:20px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
  <div style="background:#0F172A;padding:20px 28px;display:flex;align-items:center">
    <img src="https://tk-webtalent.de/assets/logo-icon.png" width="36" height="36" alt="TK" style="display:block">
    <span style="color:#fff;font-size:17px;font-weight:700;margin-left:10px">Webtalent</span>
  </div>
  <div style="padding:28px 28px 24px">${body}</div>
  <div style="padding:14px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;text-align:center">
    TK Webtalent &nbsp;|&nbsp; <a href="https://tk-webtalent.de" style="color:#0EA5E9;text-decoration:none">tk-webtalent.de</a>
  </div>
</div>
</body></html>`;
}

function box(date) {
  return `<div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:14px 20px;margin:16px 0;font-size:15px;font-weight:700;color:#0F172A;text-align:center">📅 ${date}</div>`;
}

function buildEmails(type, { customerEmail, customerName, formattedDate, appointmentType, adminEmail, from }) {
  const sign     = `<p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>`;
  const h1       = (t) => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
  const p        = (t) => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
  const link     = (href, label) => `<a href="${href}" style="color:#0EA5E9">${label}</a>`;
  const kb       = link('https://tk-webtalent.de/kundenbereich', 'Kundenbereich');
  const adm      = link('https://tk-webtalent.de/admin', 'Admin-Bereich');
  const typeLbl  = apptTypeLabel(appointmentType);
  const zoomNote = apptZoomNote(appointmentType);

  switch (type) {

    case 'customer_booked': return [
      {
        from, to: customerEmail,
        subject: '✅ Buchungsbestätigung – TK Webtalent',
        html: tpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin bestätigt!')}
          ${p(`Dein Beratungstermin bei TK Webtalent ist gebucht: <strong>${typeLbl}</strong>.`)}
          ${box(formattedDate)}
          ${zoomNote}
          ${p('Der Termin dauert <strong>60 Minuten</strong>. Wir besprechen dabei den Stand deines Projekts und die nächsten Schritte.')}
          ${p(`Musst du absagen? Kein Problem – einfach im ${kb} stornieren.`)}
          ${sign}
        `)
      },
      {
        from, to: adminEmail,
        subject: `📅 Neuer Termin: ${customerName}`,
        html: tpl(`
          ${h1('Neuer Termin gebucht')}
          ${p(`<strong>${customerName}</strong> hat einen Beratungstermin gebucht: <strong>${typeLbl}</strong>.`)}
          ${box(formattedDate)}
          ${zoomNote}
          ${p(`Einsehen und verwalten im ${adm}.`)}
        `)
      }
    ];

    case 'admin_booked': return [
      {
        from, to: customerEmail,
        subject: '📅 Termin wurde für dich eingetragen – TK Webtalent',
        html: tpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin eingetragen')}
          ${p(`TK Webtalent hat einen Beratungstermin für dich angelegt: <strong>${typeLbl}</strong>.`)}
          ${box(formattedDate)}
          ${zoomNote}
          ${p(`Falls der Termin nicht passt, kannst du ihn im ${kb} absagen oder uns direkt kontaktieren.`)}
          ${sign}
        `)
      }
    ];

    case 'customer_cancelled': return [
      {
        from, to: customerEmail,
        subject: 'Termin abgesagt – TK Webtalent',
        html: tpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin abgesagt')}
          ${p('Dein Beratungstermin wurde erfolgreich abgesagt.')}
          ${box(formattedDate)}
          ${p(`Kein Problem – buche einfach einen neuen Termin im ${kb}.`)}
          ${sign}
        `)
      },
      {
        from, to: adminEmail,
        subject: `❌ Termin abgesagt: ${customerName}`,
        html: tpl(`
          ${h1('Termin abgesagt')}
          ${p(`<strong>${customerName}</strong> hat den Termin abgesagt.`)}
          ${box(formattedDate)}
          ${p('Das Zeitfenster ist wieder frei.')}
        `)
      }
    ];

    case 'admin_cancelled': return [
      {
        from, to: customerEmail,
        subject: 'Dein Termin wurde storniert – TK Webtalent',
        html: tpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin storniert')}
          ${p('TK Webtalent hat deinen Beratungstermin leider stornieren müssen.')}
          ${box(formattedDate)}
          ${p(`Wir entschuldigen uns. Buche gerne einen neuen Termin im ${kb}.`)}
          ${sign}
        `)
      }
    ];

    default: return [];
  }
}
