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

/* Zusatz-Absatz fürs E-Mail-Template, wenn der Termin per Zoom stattfindet.
   ZOOM_MEETING_LINK ist noch nicht gesetzt (kein Zoom-Konto) → Platzhalter-Hinweis
   statt eines kaputten Links. Sobald die Env-Var gesetzt ist, erscheint automatisch
   der echte Link – ohne Code-Änderung. */
function apptZoomNote(type) {
  if (type !== 'zoom') return '';
  const link = process.env.ZOOM_MEETING_LINK;
  return link
    ? `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">📹 Zoom-Link: <a href="${link}" style="color:#0EA5E9">${link}</a></p>`
    : `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">📹 Der Zoom-Link wird dir rechtzeitig vor dem Termin separat zugeschickt.</p>`;
}

/* Dienstags sind für Kunden/Gäste grundsätzlich blockiert (Minijob). */
function isTuesday(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay() === 2;
}

module.exports = { APPT_TYPES, apptTypeLabel, apptZoomNote, isTuesday };
