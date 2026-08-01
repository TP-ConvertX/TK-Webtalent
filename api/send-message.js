/* ===================================================
   TK WEBTALENT – NACHRICHTEN API
   Sendet Nachrichten zwischen Kunde und Admin
   inkl. E-Mail-Benachrichtigung via Resend
   =================================================== */

const { createClient } = require('@supabase/supabase-js');

function tplHtml(body) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  /* Token prüfen */
  const { data: { user }, error: authErr } = await sbAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  /* Sender-Profil laden */
  const { data: senderProfile } = await sbAdmin
    .from('profiles').select('full_name, role').eq('id', user.id).single();

  const { customerId, sender, content, attachments, recipientOnline } = req.body || {};

  if (!customerId || !sender) return res.status(400).json({ error: 'Missing fields' });
  if (!content && !(attachments && attachments.length)) return res.status(400).json({ error: 'Empty message' });

  /* Berechtigungsprüfung */
  if (sender === 'customer' && user.id !== customerId)
    return res.status(403).json({ error: 'Forbidden' });
  if (sender === 'admin' && senderProfile?.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  /* Nachricht speichern */
  const { data: msg, error: insertErr } = await sbAdmin.from('messages').insert({
    customer_id: customerId,
    sender,
    content:     content || null,
    attachments: attachments || []
  }).select().single();

  if (insertErr) {
    console.error('[send-message] insert error:', insertErr);
    return res.status(500).json({ error: insertErr.message });
  }

  /* E-Mail-Benachrichtigung */
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const from        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';

  if (RESEND_KEY && !recipientOnline) {
    const { data: custProfile } = await sbAdmin
      .from('profiles').select('full_name').eq('id', customerId).single();
    const { data: { user: custUser } } = await sbAdmin.auth.admin.getUserById(customerId);
    const custName  = custProfile?.full_name || 'Kunde';
    const custEmail = custUser?.email;

    const h1   = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
    const p    = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
    const sign = `<p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>`;
    const preview = content
      ? `<div style="background:#F8FAFC;border-left:3px solid #0EA5E9;padding:12px 16px;margin:14px 0;border-radius:0 8px 8px 0;font-size:14px;color:#475569;font-style:italic;white-space:pre-wrap">${content.replace(/</g,'&lt;').slice(0,300)}</div>`
      : '';
    const fileNote = attachments?.length ? p(`${attachments.length} Datei(en) angehängt.`) : '';

    let mailTo, subject, html;

    if (sender === 'customer') {
      mailTo  = ADMIN_EMAIL;
      subject = `💬 Neue Nachricht von ${custName}`;
      html    = tplHtml(`
        ${h1('Neue Kundennachricht')}
        ${p(`<strong>${custName}</strong> hat Ihnen eine Nachricht geschrieben:`)}
        ${preview}${fileNote}
        ${p(`<a href="https://tk-webtalent.de/admin" style="background:#0EA5E9;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Im Admin-Bereich antworten →</a>`)}
      `);
    } else {
      mailTo  = custEmail;
      subject = '💬 Neue Nachricht von TK Webtalent';
      html    = tplHtml(`
        <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${custName},</p>
        ${h1('Neue Nachricht')}
        ${p('TK Webtalent hat dir eine Nachricht geschickt:')}
        ${preview}${fileNote}
        ${p(`<a href="https://tk-webtalent.de/kundenbereich" style="background:#0EA5E9;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Im Kundenbereich ansehen →</a>`)}
        ${sign}
      `);
    }

    if (mailTo) {
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ from, to: mailTo, subject, html })
      }).catch(e => console.error('[send-message] Resend error:', e.message));
    }
  }

  return res.status(200).json({ ok: true, message: msg });
};
