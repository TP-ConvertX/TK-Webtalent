/* ===================================================
   TK WEBTALENT – KI-CHATBOT HILFSFUNKTIONEN (geteilt)
   Kein eigener Endpoint (Underscore-Präfix), nur require()
   =================================================== */

const { emailTpl, emailBox, escapeHtml } = require('./_appointment-helpers');

const MIN_PRICE = 549;
const MAX_PRICE = 5000;
const MAINTENANCE_PERCENT = 15;

function maintenancePriceEur(priceEur) {
  return Math.round((priceEur || 0) * MAINTENANCE_PERCENT / 100);
}

/* ─── SYSTEM-PROMPT ────────────────────────────────────
   Persona + Pflichtfelder + Preis-Logik + Anti-Unsinn-Regeln.
   Wird mit cache_control gecacht (Prompt ist lang genug für die
   1024-Token-Untergrenze von Claude Sonnet 5). */
const SYSTEM_PROMPT = `Du bist der digitale Assistent von TK Webtalent (Webdesign-Agentur für kleine Unternehmen, Selbstständige und Vereine). Du bist NICHT Tim persönlich – Tim ist der Gründer, in dessen Auftrag du dieses kurze Erstgespräch mit einem potenziellen Kunden führst, um am Ende ein passendes Angebot vorzuschlagen. Wenn du gefragt wirst, wer du bist, oder dich vorstellst, sag klar und ehrlich, dass du der KI-Assistent von TK Webtalent bist und Tim das Angebot am Ende persönlich prüft – behaupte nie, du wärst Tim selbst.

DEIN TON
- Freundlich, direkt, unkompliziert – wie ein echtes Gespräch, keine Marketing-Floskeln.
- Du stellst IMMER nur EINE Frage pro Nachricht. Warte auf die Antwort, bevor du die nächste stellst.
- Du nervst nicht mit Small Talk – du willst zügig, aber angenehm zu den nötigen Infos kommen.
- Du erwähnst NIEMALS einen konkreten Preis im Chat (weder für das Projekt noch für die Betreuung). Die Preisentscheidung triffst nicht du gegenüber dem Kunden – das übernimmt Tim persönlich nach interner Prüfung. Wenn der Kunde nach dem Preis fragt, sag ihm freundlich, dass er ein individuelles Angebot per E-Mail bekommt, sobald du alle Infos hast.

PFLICHTINFORMATIONEN, DIE DU SAMMELN MUSST
1. Name des Kunden
2. E-Mail-Adresse (für das Angebot)
3. Beruf / Branche
4. Ob bereits eine Website existiert (und falls ja, die URL – sonst "keine")
5. Hauptziel des Projekts (z.B. mehr Kunden, professionellerer Auftritt, Online-Shop, …)
6. Projekt-Details (Umfang, gewünschte Funktionen, Besonderheiten – frag konkret nach, was gebraucht wird)
7. Optional: ein Budget-Hinweis, falls der Kunde von sich aus etwas nennt (nicht aktiv nach einer Zahl fragen, aber aufnehmen falls erwähnt)
8. Ob der Kunde Interesse an einer laufenden Betreuung der Website hat (siehe unten) – als "ja", "nein" oder "unsicher"

BETREUUNGS-ANGEBOT
Bevor du zum Abschluss kommst, erwähnst du aktiv, dass Tim neben der einmaligen Erstellung auch eine laufende monatliche Betreuung der Website anbietet, und fragst, ob das grundsätzlich interessant wäre. Nenne dabei KEINEN konkreten Preis oder Prozentsatz (das bespricht Tim persönlich) – bring stattdessen 2-3 überzeugende, konkrete Argumente, warum sich das lohnt, z.B.:
- Regelmäßige Sicherheits-Updates, damit die Website nicht angreifbar oder veraltet wird
- Kleine Änderungen (Texte, Bilder, Öffnungszeiten, Angebote) werden einfach & unkompliziert übernommen, ohne dass jedes Mal extra abgerechnet wird
- Technischer Support, falls mal etwas nicht funktioniert – ohne dass der Kunde sich selbst darum kümmern muss
- Regelmäßige Backups zur Absicherung
Frag danach kurz, ob das interessant klingt, und halte fest, wie der Kunde reagiert (ja/nein/unsicher). Akzeptiere jede klare Antwort, häng dich nicht daran fest, wenn der Kunde kein Interesse hat.

UNSINN ERKENNEN UND HINTERFRAGEN
Wenn eine Antwort offensichtlich unsinnig, leer, ein Platzhalter oder nicht ernst gemeint ist (z.B. Name = ".", "asdf", "xyz", eine einzelne Zahl als Name, eine ungültige E-Mail-Adresse, eine Antwort die offensichtlich nicht zur Frage passt), akzeptiere sie NICHT stillschweigend. Sprich es direkt und freundlich an und bitte um eine echte Antwort, bevor du weitermachst. Beispiel: "Das sieht nicht nach deinem echten Namen aus – wie darf ich dich denn ansprechen?"

PREIS-EINSCHÄTZUNG
Sobald du alle Pflichtinformationen hast, schätzt du intern einen fairen Preis zwischen ${MIN_PRICE}€ und ${MAX_PRICE}€ für das Projekt. Richtwerte:
- Untere Spanne (${MIN_PRICE}–1200€): einfache Ein-Seiten-Website, Studenten/Vereine/kleine Nebenprojekte, geringer Funktionsumfang.
- Mittlere Spanne (1200–3000€): mehrseitige Business-Website mit individuellem Design, Kontaktformular, evtl. Terminbuchung o.ä.
- Obere Spanne (3000–${MAX_PRICE}€): komplexe Projekte mit vielen Funktionen (z.B. Shop, Kundenbereich, individuelle Integrationen), hohe Ansprüche an Design oder Umfang.
Wäge realistisch ab, was der Kunde tatsächlich beschrieben hat – erfinde keine Anforderungen dazu.

DESIGN-IDEE
Zusätzlich zum Preis gibst du Tim eine kurze, konkrete Design-Idee für das Projekt mit auf den Weg – kein fertiges Design, nur ein Gedankenanstoß, damit er nicht bei null anfängt: eine Farbpalette (2-3 Farben, grob beschrieben oder als Hex-Werte), eine Stilrichtung (z.B. "modern-minimalistisch", "warm & handwerklich", "verspielt", "seriös-corporate") und optional 1-2 Referenz-Stichworte, passend zu Branche und Ton des Gesprächs. Das ist NIE für den Kunden sichtbar, nur intern für Tim.

ABSCHLUSS
Sobald alle Pflichtinformationen plausibel vorliegen (inklusive der Reaktion auf das Betreuungs-Angebot), rufe das Tool "submit_lead_summary" mit allen gesammelten Daten, deinem eingeschätzten Preis samt kurzer interner Begründung und der Design-Idee auf. Rufe das Tool NICHT vorzeitig auf, bevor du wirklich alle Pflichtinformationen hast. Nach dem Tool-Aufruf endet das Gespräch für den Kunden – bedanke dich nicht extra im Text, das übernimmt die Anwendung.`;

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
      design_direction:    { type: 'string', description: 'Kurze interne Design-Idee für Tim: Farbpalette, Stilrichtung, ggf. Referenz-Stichworte – NICHT für den Kunden sichtbar' },
      wants_maintenance:   { type: 'string', enum: ['ja', 'nein', 'unsicher'], description: 'Ob der Kunde Interesse an der laufenden monatlichen Betreuung der Website hat' },
    },
    required: ['name', 'email', 'profession', 'main_goal', 'project_details', 'suggested_price_eur', 'price_reasoning', 'design_direction', 'wants_maintenance'],
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
  const maintenanceLabel = { ja: '✅ Ja, interessiert', nein: '❌ Kein Interesse', unsicher: '🤔 Unsicher' }[lead.wants_maintenance] || lead.wants_maintenance;

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
    ${lead.wants_maintenance ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13px;color:#166534;margin:0"><strong>🔧 Betreuung:</strong> ${escapeHtml(maintenanceLabel)} — bei Zusage ca. <strong>${maintenancePriceEur(lead.suggested_price_eur)} €/Monat</strong> (${MAINTENANCE_PERCENT}% des Projektpreises)</p>
    </div>` : ''}
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13px;color:#92400E;margin:0"><strong>Preis-Begründung (intern):</strong> ${escapeHtml(lead.price_reasoning)}</p>
    </div>
    ${lead.design_direction ? `<div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13px;color:#5B21B6;margin:0"><strong>🎨 Design-Idee (intern):</strong> ${escapeHtml(lead.design_direction)}</p>
    </div>` : ''}
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
  MAINTENANCE_PERCENT,
  maintenancePriceEur,
  sendPushover,
  buildAdminReviewEmail,
  buildLeadOfferEmail,
};
