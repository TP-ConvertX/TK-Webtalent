/* ===================================================
   TK WEBTALENT – TERMIN-HILFSFUNKTIONEN (geteilt)
   Kein eigener Endpoint (Underscore-Präfix), nur require()
   =================================================== */

const APPT_TYPES = ['telefon', 'persoenlich', 'zoom'];

const APPT_TYPE_LABELS = {
  telefon:     '📞 Telefonisch',
  persoenlich: '🤝 Persönlich vor Ort',
  zoom:        '💻 Per Zoom',
};

function apptTypeLabel(type) {
  return APPT_TYPE_LABELS[type] || APPT_TYPE_LABELS.telefon;
}

/* ─── ZOOM SERVER-TO-SERVER OAUTH ─────────────────────
   Erstellt bei Zoom-Terminen ein echtes Meeting (taucht dann auch in
   Tims Zoom-Konto auf), statt nur einen festen Platzhalter-Link zu
   verschicken. Schlägt die Zoom-API mal fehl (falsche Scopes, Ausfall,
   noch nicht konfiguriert) darf das NIE die Buchung selbst zum Absturz
   bringen – dann greift einfach der Platzhalter-Hinweis in apptZoomNote(). */
async function getZoomAccessToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;

  try {
    const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
    const r = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
      { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
    );
    if (!r.ok) { console.error('[zoom] Token-Fehler:', await r.text()); return null; }
    const data = await r.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[zoom] Token-Netzwerkfehler:', e.message);
    return null;
  }
}

/* date: "YYYY-MM-DD", time: "HH:MM" (oder "HH:MM:SS") */
async function createZoomMeeting({ date, time, topic }) {
  const token = await getZoomAccessToken();
  if (!token) return null;

  try {
    const startTime = `${date}T${time.slice(0, 5)}:00`;
    const r = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic || 'Beratungstermin – TK Webtalent',
        type: 2, // geplantes Meeting (fester Termin, kein Dauer-Raum)
        start_time: startTime,
        duration: 60,
        timezone: 'Europe/Berlin',
        settings: { join_before_host: true, waiting_room: false, approval_type: 2 }
      })
    });
    if (!r.ok) { console.error('[zoom] Meeting-Erstellung fehlgeschlagen:', await r.text()); return null; }
    const data = await r.json();
    return data.join_url || null;
  } catch (e) {
    console.error('[zoom] Meeting-Netzwerkfehler:', e.message);
    return null;
  }
}

/* Zusatz-Absatz fürs E-Mail-Template, wenn der Termin per Zoom stattfindet.
   joinUrl (echtes, per API erstelltes Meeting) hat Vorrang. Fällt das aus,
   greift ZOOM_MEETING_LINK (fester Platzhalter-Link). Ist auch das nicht
   gesetzt, gibt's nur den Hinweis, dass der Link separat nachgereicht wird. */
function apptZoomNote(type, joinUrl) {
  if (type !== 'zoom') return '';
  const link = joinUrl || process.env.ZOOM_MEETING_LINK;
  return link
    ? `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">📹 Zoom-Link: <a href="${link}" style="color:#0EA5E9">${link}</a></p>`
    : `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">📹 Der Zoom-Link wird dir rechtzeitig vor dem Termin separat zugeschickt.</p>`;
}

/* meetingId aus einer Zoom-Join-URL herausziehen, z.B.
   https://us05web.zoom.us/j/87654321098?pwd=... → "87654321098" */
function extractZoomMeetingId(joinUrl) {
  if (!joinUrl) return null;
  const m = joinUrl.match(/\/j\/(\d+)/);
  return m ? m[1] : null;
}

/* Löscht das Zoom-Meeting bei Stornierung. Best-effort: schlägt es fehl
   (z.B. Meeting schon manuell gelöscht), bricht die Stornierung selbst
   trotzdem nicht ab. */
async function deleteZoomMeeting(joinUrl) {
  const meetingId = extractZoomMeetingId(joinUrl);
  if (!meetingId) return false;

  const token = await getZoomAccessToken();
  if (!token) return false;

  try {
    const r = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok && r.status !== 404) {
      console.error('[zoom] Meeting-Löschung fehlgeschlagen:', await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[zoom] Lösch-Netzwerkfehler:', e.message);
    return false;
  }
}

/* Dienstags sind für Kunden/Gäste grundsätzlich blockiert (Minijob). */
function isTuesday(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay() === 2;
}

/* ─── GETEILTES E-MAIL-TEMPLATE ───────────────────────── */
function emailTpl(body) {
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

function emailBox(text) {
  return `<div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:14px 20px;margin:16px 0;font-size:15px;font-weight:700;color:#0F172A;text-align:center">📅 ${text}</div>`;
}

/* Storno-Link fürs Ende einer Buchungsbestätigung (Gast + eingeloggter Kunde
   landen beim Klick auf die Bestätigungsseite von api/cancel-appointment). */
function apptCancelNote(appointmentId) {
  if (!appointmentId) return '';
  const href = `https://tk-webtalent.de/api/cancel-appointment?id=${appointmentId}`;
  return `<p style="font-size:13px;color:#94A3B8;margin-top:16px">Termin doch nicht möglich? <a href="${href}" style="color:#0EA5E9">Hier stornieren</a>.</p>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Zusatz-Absatz fürs E-Mail-Template mit der vom Kunden hinterlegten Adresse
   (nur bei "Persönlich vor Ort" relevant – Tim muss wissen, wo er hin muss). */
function apptAddressNote(type, address) {
  if (type !== 'persoenlich' || !address) return '';
  return `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">📍 Adresse: <strong>${escapeHtml(address)}</strong></p>`;
}

module.exports = {
  APPT_TYPES,
  apptTypeLabel,
  apptZoomNote,
  apptAddressNote,
  apptCancelNote,
  isTuesday,
  createZoomMeeting,
  deleteZoomMeeting,
  extractZoomMeetingId,
  emailTpl,
  emailBox,
  escapeHtml,
};
