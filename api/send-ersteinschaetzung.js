/* ===================================================
   TK WEBTALENT – KOSTENLOSE ERSTEINSCHÄTZUNG (Lead-Formular)
   Nimmt die Antworten aus ersteinschaetzung.html entgegen und
   verschickt sie per Resend an Tim, plus eine Eingangsbestätigung
   an den Lead. Gleiche Resend-Konvention wie api/book-guest.js.
   =================================================== */

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function emailTpl(body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head><body style="margin:0;padding:20px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Inter',system-ui,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
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

  const { name, email, telefon, branche, website, ziel, tempo, budget, aiAssessment } = req.body || {};

  if (!name || !email || !branche || !website || !ziel || !tempo || !budget) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
  }

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';
  const FROM        = process.env.FROM_EMAIL  || 'TK Webtalent <kontakt@tp-convertx.de>';

  if (!RESEND_KEY) {
    console.warn('[ersteinschaetzung] RESEND_API_KEY nicht gesetzt – übersprungen');
    return res.status(200).json({ ok: true, skipped: true });
  }

  const row = (label, value) => `<tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#94A3B8;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;font-size:14px;color:#0F172A;font-weight:600">${escapeHtml(value)}</td></tr>`;

  const aiBlock = aiAssessment ? `
    <p style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94A3B8;margin:24px 0 8px">KI-Entwurf zur Einschätzung (bitte prüfen & anpassen)</p>
    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:16px 18px;font-size:14px;color:#0F172A;line-height:1.7">
      ${String(aiAssessment).split(/\n{2,}/).map(p => `<p style="margin:0 0 10px">${escapeHtml(p)}</p>`).join('')}
    </div>
  ` : '';

  const adminHtml = emailTpl(`
    <p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">📋 Neue Ersteinschätzung angefragt</p>
    <p style="font-size:14px;color:#475569;margin-bottom:20px">Von <strong>${escapeHtml(name)}</strong> (<a href="mailto:${escapeHtml(email)}" style="color:#0EA5E9">${escapeHtml(email)}</a>)${telefon ? ' · ' + escapeHtml(telefon) : ''}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #F1F5F9;padding-top:8px">
      ${row('Branche', branche)}
      ${row('Aktuelle Website', website)}
      ${row('Hauptziel', ziel)}
      ${row('Zeitrahmen', tempo)}
      ${row('Budget-Vorstellung', budget)}
    </table>
    ${aiBlock}
  `);

  const leadHtml = emailTpl(`
    <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${escapeHtml(name)},</p>
    <p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">Danke für deine Anfrage! 🙌</p>
    <p style="font-size:14px;color:#475569;line-height:1.6">Ich habe deine Angaben erhalten und schaue sie mir persönlich an. Du bekommst innerhalb von <strong>24 Stunden</strong> eine ehrliche Ersteinschätzung von mir zurück – per E-Mail.</p>
    <p style="font-size:13px;color:#94A3B8;margin-top:24px;border-top:1px solid #F1F5F9;padding-top:16px">Viele Grüße,<br><strong style="color:#0F172A">Tim · TK Webtalent</strong></p>
  `);

  const mails = [
    { from: FROM, to: ADMIN_EMAIL, subject: `📋 Neue Ersteinschätzung: ${name}`, html: adminHtml },
    { from: FROM, to: email, subject: 'Danke für deine Anfrage – TK Webtalent', html: leadHtml }
  ];

  for (const mail of mails) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mail)
      });
      if (!r.ok) console.error('[ersteinschaetzung] Resend:', await r.text());
    } catch (e) {
      console.error('[ersteinschaetzung] E-Mail-Fehler:', e.message);
    }
  }

  return res.status(200).json({ ok: true });
};
