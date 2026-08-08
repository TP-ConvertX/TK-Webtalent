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

/* Dienstags sind für Kunden/Gäste grundsätzlich blockiert (Minijob). */
function isTuesday(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay() === 2;
}

module.exports = { APPT_TYPES, apptTypeLabel, apptZoomNote, isTuesday, createZoomMeeting };
