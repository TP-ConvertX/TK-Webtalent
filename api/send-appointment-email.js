/* ===================================================
   TK WEBTALENT – TERMIN-E-MAIL (Resend)
   Versendet Bestätigungs- und Benachrichtigungs-Mails
   via Resend bei Buchung oder Absage.
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const {
  apptTypeLabel,
  apptZoomNote,
  apptCancelNote,
  createZoomMeeting,
  emailTpl,
  emailBox,
} = require('./_appointment-helpers');

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
    appointmentId,
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

  /* Bei neuen Zoom-Terminen: echtes Meeting in Tims Zoom-Konto anlegen
     und den Link am Termin speichern (wird bei Stornierung gebraucht) */
  let zoomJoinUrl = null;
  if (appointmentType === 'zoom' && (type === 'customer_booked' || type === 'admin_booked') && date && time) {
    zoomJoinUrl = await createZoomMeeting({ date, time, topic: `Beratungstermin mit ${customerName} – TK Webtalent` });
    if (zoomJoinUrl && appointmentId) {
      await sbAdmin.from('appointments').update({ zoom_join_url: zoomJoinUrl }).eq('id', appointmentId);
    }
  }

  const fmt = formattedDate || `${date} ${time}`;
  const mails = buildEmails(type, {
    customerEmail,
    customerName,
    formattedDate: fmt,
    appointmentType,
    zoomJoinUrl,
    appointmentId,
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

/* customer_cancelled/admin_cancelled gibt's hier nicht mehr – Stornierungen
   (inkl. E-Mail-Benachrichtigung an Kunde + Admin, Zoom-Löschung) laufen
   zentral über api/cancel-appointment.js, egal von wo sie ausgelöst werden. */
function buildEmails(type, { customerEmail, customerName, formattedDate, appointmentType, zoomJoinUrl, appointmentId, adminEmail, from }) {
  const sign       = `<p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>`;
  const h1         = (t) => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
  const p          = (t) => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
  const link       = (href, label) => `<a href="${href}" style="color:#0EA5E9">${label}</a>`;
  const kb         = link('https://tk-webtalent.de/kundenbereich', 'Kundenbereich');
  const adm        = link('https://tk-webtalent.de/admin', 'Admin-Bereich');
  const typeLbl    = apptTypeLabel(appointmentType);
  const zoomNote   = apptZoomNote(appointmentType, zoomJoinUrl);
  const cancelNote = apptCancelNote(appointmentId);

  switch (type) {

    case 'customer_booked': return [
      {
        from, to: customerEmail,
        subject: '✅ Buchungsbestätigung – TK Webtalent',
        html: emailTpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin bestätigt!')}
          ${p(`Dein Beratungstermin bei TK Webtalent ist gebucht: <strong>${typeLbl}</strong>.`)}
          ${emailBox(formattedDate)}
          ${zoomNote}
          ${p('Der Termin dauert <strong>60 Minuten</strong>. Wir besprechen dabei den Stand deines Projekts und die nächsten Schritte.')}
          ${p(`Musst du absagen? Kein Problem – einfach im ${kb} stornieren.`)}
          ${sign}
          ${cancelNote}
        `)
      },
      {
        from, to: adminEmail,
        subject: `📅 Neuer Termin: ${customerName}`,
        html: emailTpl(`
          ${h1('Neuer Termin gebucht')}
          ${p(`<strong>${customerName}</strong> hat einen Beratungstermin gebucht: <strong>${typeLbl}</strong>.`)}
          ${emailBox(formattedDate)}
          ${zoomNote}
          ${p(`Einsehen und verwalten im ${adm}.`)}
          ${cancelNote}
        `)
      }
    ];

    case 'admin_booked': return [
      {
        from, to: customerEmail,
        subject: '📅 Termin wurde für dich eingetragen – TK Webtalent',
        html: emailTpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin eingetragen')}
          ${p(`TK Webtalent hat einen Beratungstermin für dich angelegt: <strong>${typeLbl}</strong>.`)}
          ${emailBox(formattedDate)}
          ${zoomNote}
          ${p(`Falls der Termin nicht passt, kannst du ihn im ${kb} absagen oder uns direkt kontaktieren.`)}
          ${sign}
          ${cancelNote}
        `)
      }
    ];

    default: return [];
  }
}
