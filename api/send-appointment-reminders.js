/* ===================================================
   TK WEBTALENT – TERMIN-ERINNERUNGEN (Vercel Cron)
   Läuft einmal täglich (siehe vercel.json "crons") und
   verschickt Erinnerungs-Mails an Kunde + Admin für Termine,
   die in genau 7 Tagen bzw. am nächsten Tag stattfinden.
   Verhindert Doppelversand über appointments.reminder_7d_sent_at
   / reminder_24h_sent_at (siehe supabase/reminders-migration.sql).
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const {
  apptTypeLabel,
  apptZoomNote,
  apptAddressNote,
  apptCancelNote,
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

function isoDatePlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  /* Vercel Cron ruft ausschließlich GET auf. Mit gesetztem CRON_SECRET
     zusätzlich absichern (Vercel schickt den Header bei Cron-Aufrufen
     automatisch mit) – ohne gesetztes Secret läuft der Check einfach
     nicht, wie beim optionalen RESEND_API_KEY an anderer Stelle. */
  if (req.method !== 'GET') return res.status(405).end();

  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sbAdmin     = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const FROM        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';

  if (!RESEND_KEY) {
    console.warn('[reminders] RESEND_API_KEY nicht gesetzt – übersprungen');
    return res.status(200).json({ ok: true, skipped: true });
  }

  const ctx = { sbAdmin, RESEND_KEY, ADMIN_EMAIL, FROM, results: { sent7d: 0, sent24h: 0, errors: 0 } };

  await sendDueReminders({ ...ctx, targetDate: isoDatePlusDays(7), column: 'reminder_7d_sent_at',  kind: '7d' });
  await sendDueReminders({ ...ctx, targetDate: isoDatePlusDays(1), column: 'reminder_24h_sent_at', kind: '24h' });

  return res.status(200).json({ ok: true, ...ctx.results });
};

async function sendDueReminders({ sbAdmin, targetDate, column, kind, results, RESEND_KEY, ADMIN_EMAIL, FROM }) {
  const { data: appts, error } = await sbAdmin
    .from('appointments')
    .select('id, customer_id, appointment_date, appointment_time, appointment_type, appointment_address, guest_name, guest_email, zoom_join_url')
    .eq('status', 'confirmed')
    .eq('appointment_date', targetDate)
    .is(column, null);

  if (error) { console.error(`[reminders] Abfrage fehlgeschlagen (${kind}):`, error.message); results.errors++; return; }
  if (!appts || !appts.length) return;

  const whenLabel = kind === '7d' ? 'in einer Woche' : 'morgen';
  const h1 = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
  const p  = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;

  for (const appt of appts) {
    /* Kunden-Identität auflösen: eingeloggter Kunde vs. Gast (wie bei cancel-appointment.js) */
    let customerEmail = appt.guest_email;
    let customerName  = appt.guest_name || 'Kunde';

    if (appt.customer_id) {
      const { data: { user: cu } } = await sbAdmin.auth.admin.getUserById(appt.customer_id);
      customerEmail = cu?.email || null;
      const { data: pf } = await sbAdmin.from('profiles').select('full_name').eq('id', appt.customer_id).single();
      customerName = pf?.full_name || 'Kunde';
    }

    const fmt        = formatAppt(appt.appointment_date, appt.appointment_time.slice(0, 5));
    const typeLbl     = apptTypeLabel(appt.appointment_type);
    const zoomNote    = apptZoomNote(appt.appointment_type, appt.zoom_join_url);
    const addressNote = apptAddressNote(appt.appointment_type, appt.appointment_address);
    const cancelNote  = apptCancelNote(appt.id);

    const mails = [
      {
        from: FROM, to: customerEmail,
        subject: `⏰ Erinnerung: Dein Termin ${whenLabel} – TK Webtalent`,
        html: emailTpl(`
          <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${customerName},</p>
          ${h1('Termin-Erinnerung')}
          ${p(`Kleine Erinnerung: Dein Beratungstermin (<strong>${typeLbl}</strong>) findet ${whenLabel} statt.`)}
          ${emailBox(fmt)}
          ${zoomNote}
          ${addressNote}
          ${p('Falls sich etwas ändert, kannst du den Termin jederzeit im Kundenbereich stornieren.')}
          ${cancelNote}
        `)
      },
      {
        from: FROM, to: ADMIN_EMAIL,
        subject: `⏰ Erinnerung: Termin mit ${customerName} ${whenLabel}`,
        html: emailTpl(`
          ${h1('Termin-Erinnerung')}
          ${p(`Termin mit <strong>${customerName}</strong> (<strong>${typeLbl}</strong>) findet ${whenLabel} statt.`)}
          ${emailBox(fmt)}
          ${addressNote}
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
        if (!r.ok) { console.error(`[reminders] Resend (${kind}):`, await r.text()); results.errors++; }
      } catch (e) {
        console.error(`[reminders] E-Mail-Fehler (${kind}):`, e.message);
        results.errors++;
      }
    }

    await sbAdmin.from('appointments').update({ [column]: new Date().toISOString() }).eq('id', appt.id);
    results[kind === '7d' ? 'sent7d' : 'sent24h']++;
  }
}
