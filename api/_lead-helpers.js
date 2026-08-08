/* ===================================================
   TK WEBTALENT – KI-CHATBOT HILFSFUNKTIONEN (geteilt)
   Kein eigener Endpoint (Underscore-Präfix), nur require()
   =================================================== */

const { emailTpl, emailBox, escapeHtml } = require('./_appointment-helpers');

const MIN_PRICE = 549;
const MAX_PRICE = 5000;

/* ─── SYSTEM-PROMPT ────────────────────────────────────
   Persona + Pflichtfelder + Preis-Logik + Anti-Unsinn-Regeln.
   Wird mit cache_control gecacht (Prompt ist lang genug für die
   1024-Token-Untergrenze von Claude Sonnet 5). */
const SYSTEM_PROMPT = `Du bist Tim, der Gründer von TK Webtalent (Webdesign-Agentur für kleine Unternehmen, Selbstständige und Vereine). Du führst über einen Chat auf der Website ein kurzes, persönliches Erstgespräch mit einem potenziellen Kunden, um am Ende ein passendes Angebot vorzuschlagen.

DEIN TON
- Freundlich, direkt, unkompliziert – wie ein echtes Gespräch, keine Marketing-Floskeln.
- Du stellst IMMER nur EINE Frage pro Nachricht. Warte auf die Antwort, bevor du die nächste stellst.
- Du nervst nicht mit Small Talk – du willst zügig, aber angenehm zu den nötigen Infos kommen.
- Du erwähnst NIEMALS einen konkreten Preis im Chat. Die Preisentscheidung triffst nicht du gegenüber dem Kunden – das übernimmt Tim persönlich nach interner Prüfung. Wenn der Kunde nach dem Preis fragt, sag ihm freundlich, dass er ein individuelles Angebot per E-Mail bekommt, sobald du alle Infos hast.

PFLICHTINFORMATIONEN, DIE DU SAMMELN MUSST
1. Name des Kunden
2. E-Mail-Adresse (für das Angebot)
3. Beruf / Branche
4. Ob bereits eine Website existiert (und falls ja, die URL – sonst "keine")
5. Hauptziel des Projekts (z.B. mehr Kunden, professionellerer Auftritt, Online-Shop, …)
6. Projekt-Details (Umfang, gewünschte Funktionen, Besonderheiten – frag konkret nach, was gebraucht wird)
7. Optional: ein Budget-Hinweis, falls der Kunde von sich aus etwas nennt (nicht aktiv nach einer Zahl fragen, aber aufnehmen falls erwähnt)

UNSINN ERKENNEN UND HINTERFRAGEN
Wenn eine Antwort offensichtlich unsinnig, leer, ein Platzhalter oder nicht ernst gemeint ist (z.B. Name = ".", "asdf", "xyz", eine einzelne Zahl als Name, eine ungültige E-Mail-Adresse, eine Antwort die offensichtlich nicht zur Frage passt), akzeptiere sie NICHT stillschweigend. Sprich es direkt und freundlich an und bitte um eine echte Antwort, bevor du weitermachst. Beispiel: "Das sieht nicht nach deinem echten Namen aus – wie darf ich dich denn ansprechen?"

PREIS-EINSCHÄTZUNG
Sobald du alle Pflichtinformationen hast, schätzt du intern einen fairen Preis zwischen ${MIN_PRICE}€ und ${MAX_PRICE}€ für das Projekt. Richtwerte:
- Untere Spanne (${MIN_PRICE}–1200€): einfache Ein-Seiten-Website, Studenten/Vereine/kleine Nebenprojekte, geringer Funktionsumfang.
- Mittlere Spanne (1200–3000€): mehrseitige Business-Website mit individuellem Design, Kontaktformular, evtl. Terminbuchung o.ä.
- Obere Spanne (3000–${MAX_PRICE}€): komplexe Projekte mit vielen Funktionen (z.B. Shop, Kundenbereich, individuelle Integrationen), hohe Ansprüche an Design oder Umfang.
Wäge realistisch ab, was der Kunde tatsächlich beschrieben hat – erfinde keine Anforderungen dazu.

ABSCHLUSS
Sobald alle Pflichtinformationen plausibel vorliegen, rufe das Tool "submit_lead_summary" mit allen gesammelten Daten und deinem eingeschätzten Preis samt kurzer interner Begründung auf. Rufe das Tool NICHT vorzeitig auf, bevor du wirklich alle Pflichtinformationen hast. Nach dem Tool-Aufruf endet das Gespräch für den Kunden – bedanke dich nicht extra im Text, das übernimmt die Anwendung.`;

/* ─── TOOL-SCHEMA für die Anthropic Messages API ──────── */
const SUBMIT_LEAD_TOOL = {
  name: 'submit_lead_summary',
  description: 'Wird aufgerufen, sobald alle nötigen Kundendaten plausibel vorliegen, um die Anfrage zur Freigabe an Tim weiterzuleiten.',
  input_schema: {
    type: 'object',
    properties: {
      name:                { type: 'string', description: 'Name des Kunden' },
      email:               { type: 'string', description: 'E-Mail-Adresse des Kunden' },
      profession:          { type: 'string', description: 'Beruf / Branche des Kunden' },
      current_website:     { type: 'string', description: 'URL der bestehenden Website oder "keine"' },
      main_goal:           { type: 'string', description: 'Hauptziel des Projekts' },
      project_details:     { type: 'string', description: 'Umfang und gewünschte Funktionen des Projekts' },
      budget_hint:         { type: 'string', description: 'Vom Kunden genannter Budget-Hinweis, falls vorhanden' },
      suggested_price_eur: { type: 'integer', minimum: MIN_PRICE, maximum: MAX_PRICE, description: `Eingeschätzter fairer Preis in Euro (${MIN_PRICE}-${MAX_PRICE})` },
      price_reasoning:     { type: 'string', description: 'Kurze interne Begründung für Tim, warum dieser Preis passt – NICHT für den Kunden sichtbar' },
    },
    required: ['name', 'email', 'profession', 'main_goal', 'project_details', 'suggested_price_eur', 'price_reasoning'],
  },
};

const FALLBACK_DONE_MESSAGE = 'Danke dir! Ich habe jetzt alles, was ich brauche. Tim prüft deine Anfrage persönlich und meldet sich zeitnah mit einem passenden Angebot per E-Mail bei dir.';

/* ─── PUSHOVER (Push-Benachrichtigung) ────────────────
   Best-effort: schlägt der Push fehl, darf das den Chat-Flow
   nie zum Absturz bringen (gleiches Resilienz-Muster wie bei
   den Zoom-Helpers in _appointment-helpers.js). */
async function sendPushover({ title, message, url, urlTitle }) {
  const { PUSHOVER_APP_TOKEN, PUSHOVER_USER_KEY } = process.env;
  if (!PUSHOVER_APP_TOKEN || !PUSHOVER_USER_KEY) return false;

  try {
    const body = new URLSearchParams({
      token: PUSHOVER_APP_TOKEN,
      user: PUSHOVER_USER_KEY,
      title: title || 'TK Webtalent',
      message: message || '',
    });
    if (url) body.set('url', url);
    if (urlTitle) body.set('url_title', urlTitle);

    const r = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) { console.error('[pushover] Fehler:', await r.text()); return false; }
    return true;
  } catch (e) {
    console.error('[pushover] Netzwerkfehler:', e.message);
    return false;
  }
}

/* ─── E-MAIL AN TIM: Angebot zur Freigabe ─────────────── */
function buildAdminReviewEmail(lead, reviewUrl) {
  const h1 = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
  const p  = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;
  const row = (label, val) => val ? `<p style="font-size:13px;color:#475569;margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}</p>` : '';

  return emailTpl(`
    ${h1('🆕 Neue Chatbot-Anfrage')}
    ${p('Ein KI-geführtes Erstgespräch ist abgeschlossen. Bitte prüfen und Angebot freigeben:')}
    ${emailBox(`${lead.suggested_price_eur} € vorgeschlagen`)}
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin:16px 0">
      ${row('Name', lead.name)}
      ${row('E-Mail', lead.email)}
      ${row('Beruf/Branche', lead.profession)}
      ${row('Bestehende Website', lead.current_website)}
      ${row('Hauptziel', lead.main_goal)}
      ${row('Projekt-Details', lead.project_details)}
      ${row('Budget-Hinweis (Kunde)', lead.budget_hint)}
    </div>
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13px;color:#92400E;margin:0"><strong>Preis-Begründung (intern):</strong> ${escapeHtml(lead.price_reasoning)}</p>
    </div>
    <a href="${reviewUrl}" style="display:block;text-align:center;padding:14px;background:#0F172A;color:#fff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;margin-top:8px">Anfrage prüfen & Angebot freigeben →</a>
  `);
}

/* ─── E-MAIL AN DEN KUNDEN: das eigentliche Angebot ───── */
function buildLeadOfferEmail(lead) {
  const h1 = t => `<p style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:6px">${t}</p>`;
  const p  = t => `<p style="font-size:14px;color:#475569;line-height:1.6;margin-top:8px">${t}</p>`;

  return emailTpl(`
    <p style="font-size:14px;color:#64748B;margin-bottom:12px">Hallo ${escapeHtml(lead.name)},</p>
    ${h1('Dein persönliches Angebot')}
    ${p('vielen Dank für deine Anfrage! Basierend auf dem, was du mir erzählt hast, habe ich dir folgendes Angebot zusammengestellt:')}
    ${emailBox(`${lead.suggested_price_eur} €`)}
    ${p('Das ist ein erster Richtwert – gerne besprechen wir die Details in einem kurzen, kostenlosen und unverbindlichen Gespräch, damit ich dir ein maßgeschneidertes Angebot machen kann.')}
    ${p('Am einfachsten buchst du dir direkt einen Termin über die Website oder antwortest einfach auf diese E-Mail.')}
    <p style="font-size:13px;color:#94A3B8;margin-top:20px">Viele Grüße<br>Tim von TK Webtalent</p>
  `);
}

module.exports = {
  SYSTEM_PROMPT,
  SUBMIT_LEAD_TOOL,
  FALLBACK_DONE_MESSAGE,
  MIN_PRICE,
  MAX_PRICE,
  sendPushover,
  buildAdminReviewEmail,
  buildLeadOfferEmail,
};
