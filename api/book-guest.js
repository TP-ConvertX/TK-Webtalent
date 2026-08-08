/* ===================================================
   TK WEBTALENT – GAST-TERMINBUCHUNG
   Öffentliche Buchung ohne Login
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const {
  APPT_TYPES,
  apptTypeLabel,
  apptZoomNote,
  apptCancelNote,
  isTuesday,
  createZoomMeeting,
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, date, time, appointmentType } = req.body || {};

  if (!name || !email || !date || !time || !appointmentType) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
  }
  if (!APPT_TYPES.includes(appointmentType)) {
    return res.status(400).json({ error: 'Ungültige Terminart' });
  }
  if (isTuesday(date)) {
    return res.status(400).json({ error: 'tuesday_blocked' });
  }

  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  /* Slot-Verfügbarkeit prüfen */
  const { data: existing } = await sbAdmin
    .from('appointments')
    .select('id')
    .eq('appointment_date', date)
    .eq('appointment_time', time + ':00')
    .eq('status', 'confirmed')
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'slot_taken' });
  }

  /* Buchung anlegen */
  const { data: inserted, error: insertErr } = await sbAdmin.from('appointments').insert({
    appointment_date: date,
    appointment_time: time + ':00',
    status:           'confirmed',
    customer_id:      null,
    appointment_type: appointmentType,
    guest_name:       name,
    guest_email:      email
  }).select('id').single();

  if (insertErr) {
    console.error('[book-guest] insert error:', insertErr);
    return res.status(500).json({ error: insertErr.message });
  }

  /* Bei Zoom-Terminen: echtes Meeting in Tims Zoom-Konto anlegen */
  let zoomJoinUrl = null;
  if (appointmentType === 'zoom') {
    zoomJoinUrl = await createZoomMeeting({ date, time, topic: `Beratungstermin mit ${name} – TK Webtalent` });
    if (zoomJoinUrl) {
      await sbAdmin.from('appointments').update({ zoom_join_url: zoomJoinUrl }).eq('id', inserted.id);
    }
  }

  /* E-Mails senden */
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const from        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';
  const fmt         = formatAppt(date, time);

  if (RESEND_KEY) {
    const h1       = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
    const p        = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
    const sign     = `<p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>`;
    const typeLbl  = apptTypeLabel(appointmentType);
    const zoomNote = apptZoomNote(appointmentType, zoomJoinUrl);
    const cancelNote = apptCancelNote(inserted.id);

    const mails = [
      {
        from, to: email,
        subject: '✅ Buchungsbestätigung – TK Webtalent',
        html: emailTpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${name},</p>
          ${h1('Termin bestätigt!')}
          ${p(`Dein Termin bei TK Webtalent ist gebucht: <strong>${typeLbl}</strong>.`)}
          ${emailBox(fmt)}
          ${zoomNote}
          ${p('Der Termin dauert <strong>60 Minuten</strong>.')}
          ${p('Fragen vorher? Schreib einfach an <a href="mailto:kontakt@tp-convertx.de" style="color:#0EA5E9">kontakt@tp-convertx.de</a>.')}
          ${sign}
          ${cancelNote}
        `)
      },
      {
        from, to: ADMIN_EMAIL,
        subject: `📅 Neuer Gast-Termin: ${name}`,
        html: emailTpl(`
          ${h1('Neuer Termin (Gast)')}
          ${p(`<strong>${name}</strong> (<a href="mailto:${email}" style="color:#0EA5E9">${email}</a>) hat einen Termin über die Website gebucht: <strong>${typeLbl}</strong>.`)}
          ${emailBox(fmt)}
          ${zoomNote}
          ${cancelNote}
        `)
      }
    ];

    for (const mail of mails) {
      if (!mail.to) continue;
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(mail)
        });
        if (!r.ok) console.error('[book-guest] Resend:', await r.text());
      } catch (e) {
        console.error('[book-guest] E-Mail-Fehler:', e.message);
      }
    }
  }

  return res.status(200).json({ ok: true });
};
