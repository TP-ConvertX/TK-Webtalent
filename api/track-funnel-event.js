/* ===================================================
   TK WEBTALENT – ANONYME FUNNEL-STATISTIK
   Speichert einzelne Etappen-Events aus dem Vertriebspartner-Funnel
   (gestartet / Frage erreicht / Ausstieg / Kontaktformular / abgesendet).
   Enthält bewusst NIE personenbezogene Daten – wird auch bei
   automatisch beendeten Bewerbungen aufgerufen, um die Conversion pro
   Frage auswerten zu können. Best-effort: ein Fehler hier darf den
   Funnel für den Nutzer nie sichtbar stören.
   =================================================== */

const { createClient } = require('@supabase/supabase-js');

const VALID_EVENTS = ['started', 'question_reached', 'exited', 'contact_reached', 'submitted'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { event, questionNumber, sessionId } = req.body || {};
  if (!VALID_EVENTS.includes(event)) return res.status(400).json({ error: 'invalid_event' });

  try {
    const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await sbAdmin.from('funnel_events').insert({
      funnel: 'vertriebspartner',
      event,
      question_number: Number.isInteger(questionNumber) ? questionNumber : null,
      session_id: sessionId ? String(sessionId).slice(0, 64) : null,
    });
  } catch (e) {
    console.error('[track-funnel-event] Fehler:', e.message);
  }

  return res.status(200).json({ ok: true });
};
