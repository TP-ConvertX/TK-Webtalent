/* ===================================================
   TK WEBTALENT – GAST-TERMINBUCHUNG
   Öffentliche Buchung ohne Login
   =================================================== */

const { createClient } = require('@supabase/supabase-js');

const CAL_DAYS   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const CAL_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function formatAppt(dateStr, timeStr) {
  const d    = new Date(dateStr + 'T12:00:00');
  const endH = parseInt(timeStr) + 1;
  return CAL_DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + CAL_MONTHS[d.getMonth()] + ' '
    + d.getFullYear() + ' · ' + timeStr.slice(0,5) + ' – '
    + String(endH).padStart(2,'0') + ':00 Uhr';
}

function tpl(body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif">
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, date, time } = req.body || {};

  if (!name || !email || !date || !time) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
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
  const { error: insertErr } = await sbAdmin.from('appointments').insert({
    appointment_date: date,
    appointment_time: time + ':00',
    status:           'confirmed',
    customer_id:      null
  });

  if (insertErr) {
    console.error('[book-guest] insert error:', insertErr);
    return res.status(500).json({ error: insertErr.message });
  }

  /* E-Mails senden */
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const from        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';
  const fmt         = formatAppt(date, time);

  if (RESEND_KEY) {
    const h1   = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
    const p    = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
    const sign = `<p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>`;

    const mails = [
      {
        from, to: email,
        subject: '✅ Buchungsbestätigung – TK Webtalent',
        html: tpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${name},</p>
          ${h1('Termin bestätigt!')}
          ${p('Dein Telefontermin bei TK Webtalent ist gebucht.')}
          ${box(fmt)}
          ${p('Der Termin dauert <strong>60 Minuten</strong>. Tim meldet sich pünktlich bei dir – per Telefon oder Videocall, ganz wie du möchtest.')}
          ${p('Fragen vorher? Schreib einfach an <a href="mailto:kontakt@tp-convertx.de" style="color:#0EA5E9">kontakt@tp-convertx.de</a>.')}
          ${sign}
        `)
      },
      {
        from, to: ADMIN_EMAIL,
        subject: `📅 Neuer Gast-Termin: ${name}`,
        html: tpl(`
          ${h1('Neuer Telefontermin (Gast)')}
          ${p(`<strong>${name}</strong> (<a href="mailto:${email}" style="color:#0EA5E9">${email}</a>) hat einen Telefontermin über die Website gebucht.`)}
          ${box(fmt)}
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
