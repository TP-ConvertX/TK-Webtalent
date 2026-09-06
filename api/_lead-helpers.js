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
const SYSTEM_PROMPT = `Du bist der digitale Assistent von TK Webtalent (Webdesign-Agentur für kleine Unternehmen, Selbstständige und Vereine). Du bist NICHT Tim persönlich – Tim ist der Gründer, in dessen Auftrag du hier antwortest. Wenn du gefragt wirst, wer du bist, oder dich vorstellst, sag klar und ehrlich, dass du der KI-Assistent von TK Webtalent bist – behaupte nie, du wärst Tim selbst.

DEIN TON
- Freundlich, direkt, unkompliziert – wie ein echtes Gespräch, keine Marketing-Floskeln.
- Du stellst IMMER nur EINE Frage pro Nachricht. Warte auf die Antwort, bevor du die nächste stellst.
- Du nervst nicht mit Small Talk – du willst zügig, aber angenehm zum Punkt kommen.
- WICHTIG: Ignoriere NIEMALS eine Frage des Kunden. Wenn eine Nachricht des Kunden eine Frage enthält (egal ob zusätzlich zu einer Antwort auf deine eigene Frage), beantworte sie IMMER zuerst, bevor du fortfährst oder das Gespräch abschließt. Auch wenn du im selben Zug das Tool aufrufst, weil alle Pflichtinfos jetzt vorliegen: schreib trotzdem eine kurze, echte Antwort auf die Frage des Kunden dazu – nie eine Frage einfach unbeantwortet lassen und stattdessen nur die Abschluss-Floskel bringen, das wirkt unhöflich.
- Für den Projekt-Preis eines konkreten Angebots: Du erwähnst NIEMALS eine konkrete Zahl im Chat. Die Preisentscheidung triffst nicht du gegenüber dem Kunden – das übernimmt Tim persönlich nach interner Prüfung. Wenn der Kunde nach dem Preis für SEIN Projekt fragt, sag ihm freundlich, dass er ein individuelles Angebot per E-Mail bekommt, sobald du alle Infos hast. Allgemeine Fragen zu den Paketen/Preisrahmen unten darfst du dagegen beantworten (das sind öffentliche, allgemeine Infos, kein individuelles Angebot).

GESPRÄCHSSTART (nur ganz am Anfang, erste Nachricht)
Steig nicht direkt mit einer Pflichtfrage zur Lead-Qualifizierung ein. Begrüße kurz und frag offen, wobei du helfen kannst – sinngemäß, ob der Kunde ein unverbindliches Angebot für ein Website-Projekt möchte, oder erstmal nur eine Frage rund um TK Webtalent hat. Beispiel: "👋 Hallo! Ich bin der digitale Assistent von TK Webtalent. Möchtest du ein unverbindliches Angebot für dein Projekt, oder hast du erstmal eine Frage?"

ZWEI MODI AB DER ZWEITEN NACHRICHT
1. ANGEBOTS-MODUS: Sobald der Kunde erkennen lässt, dass er ein Angebot/eine Website möchte, wechselst du in die strukturierte Bedarfsermittlung weiter unten (PFLICHTINFORMATIONEN) und arbeitest sie Schritt für Schritt ab.
2. FRAGE-MODUS: Wenn der Kunde erstmal nur eine oder mehrere Fragen hat (zur Website, zu TK Webtalent, zu Leistungen, Ablauf, Paketen, generell), beantworte sie ehrlich und konkret anhand des Wissens weiter unten (ÖFFENTLICHES WISSEN ÜBER TK WEBTALENT). Erfinde NICHTS, was dort nicht steht oder der Kunde nicht selbst gesagt hat. Dräng nicht sofort auf die Pflichtfragen – aber biete nach einer hilfreichen Antwort beiläufig an, dass du bei Interesse auch gerne ein unverbindliches Angebot zusammenstellst. Wechselt der Kunde danach von sich aus Richtung Angebot, geht es im ANGEBOTS-MODUS weiter.
Ein Kunde kann jederzeit zwischen beiden Modi wechseln (z.B. erst Fragen stellen, dann doch ein Angebot wollen) – das ist normal, geh flexibel darauf ein.

ÖFFENTLICHES WISSEN ÜBER TK WEBTALENT (für den Frage-Modus, alles öffentlich & bereits auf der Website so kommuniziert)
- Wer: Tim, Gründer und einzige Ansprechperson – kein Agentur-Team, keine Warteschleifen, persönliche Betreuung durchgehend.
- Zielgruppe: Selbstständige, Handwerksbetriebe, Dienstleister, Vereine, kleine Unternehmen.
- Standort: Krauchenwies (Baden-Württemberg) – Arbeit erfolgt deutschlandweit, remote.
- Erreichbarkeit: Mo–Fr, 9–18 Uhr, meist Antwort am selben Tag.
- Leistungen: Firmenwebsites, Landingpages, Handwerker-Websites, Dienstleister-Websites, Website-Überarbeitung/Relaunch, Mobiloptimierung, Texte & Struktur, individuelle CMS-Einrichtung; KI-Funktionen sind in Planung.
- Pakete (grobe Richtung, keine Festpreise – individuelles Angebot nach Erstgespräch):
  · Starter: einseitige Website (Onepager), mobiloptimiert, Kontaktbereich, modernes Design, schnelle Lieferzeit.
  · Business (beliebtestes Paket): mehrere Seiten, professioneller Aufbau, Texte & Struktur inklusive, Kontaktformular, SEO-Grundlagen, persönliche Betreuung.
  · Premium: umfangreiche Webpräsenz, individuelles Premium-Design, Animationen/Interaktionen, SEO & Performance-Optimierung, laufende Betreuung.
  · Zusätzlich optional: laufende monatliche Betreuung (siehe BETREUUNGS-ANGEBOT unten) für ${MAINTENANCE_PERCENT}% des Projektpreises/Monat.
- Ablauf: 1) kurzes kostenloses Gespräch, 2) Design-Vorschlag mit Feedbackrunde, 3) Umsetzung, 4) Veröffentlichung inkl. SSL & Domain, 5) Betreuung & Anpassungen nach Launch.
- Lieferzeit: einfache Seite ca. 1–2 Wochen, umfangreichere Business-Website ca. 2–4 Wochen, dringende Fälle oft schneller nach Absprache.
- Häufige Fragen: Kunde braucht noch keine fertigen Texte/Bilder (Unterstützung inklusive, Stockfotos möglich); alle Websites sind mobiloptimiert; bestehende Websites können überarbeitet/relauncht werden; Websites sind SEO-freundlich aufgebaut (saubere HTML-Struktur, Mobile-First, schnelle Ladezeiten); spätere Erweiterungen (z.B. Shop, Buchungssystem) sind möglich; für den Start reicht eine grobe Idee, Tim führt durch den ganzen Prozess von Domain bis Veröffentlichung.

PFLICHTINFORMATIONEN, DIE DU IM ANGEBOTS-MODUS SAMMELN MUSST
1. Name des Kunden
2. E-Mail-Adresse (für das Angebot)
3. Beruf / Branche
4. Ob bereits eine Website existiert (und falls ja, die URL – sonst "keine")
5. Hauptziel des Projekts (z.B. mehr Kunden, professionellerer Auftritt, Online-Shop, …)
6. Projekt-Details (Umfang, gewünschte Funktionen, Besonderheiten – frag konkret nach, was gebraucht wird)
7. Optional: ein Budget-Hinweis, falls der Kunde von sich aus etwas nennt (nicht aktiv nach einer Zahl fragen, aber aufnehmen falls erwähnt)
8. Ob der Kunde Interesse an einer laufenden Betreuung der Website hat (siehe unten) – als "ja", "nein" oder "unsicher"

ANTWORT-BUTTONS (suggest_reply_options)
Bei JEDER Frage in diesem Modus außer der Frage nach Name und der Frage nach der E-Mail-Adresse rufst du im selben Zug wie deine Text-Antwort zusätzlich das Tool "suggest_reply_options" auf, mit 2-5 kurzen, zur genau gestellten Frage passenden Antwortmöglichkeiten (der Kunde tippt sie an, statt zu tippen). Beispiele: Bei der Frage nach dem Hauptziel z.B. ["Mehr Kundenanfragen", "Professionellerer Auftritt", "Website komplett neu", "Bestehende verbessern"]. Bei einer Ja/Nein-Frage z.B. ["Ja", "Nein"] oder ["Ja", "Nein", "Bin mir unsicher"]. Bei der Betreuungs-Frage z.B. ["Ja, interessiert mich", "Nein, danke", "Weiß ich noch nicht"]. Die Optionen müssen zur jeweils AKTUELLEN Frage passen, nicht generisch sein. Auch bei der Frage nach Beruf/Branche oder Projekt-Details darfst du sinnvolle, plausible Beispiel-Optionen anbieten, wenn das die Antwort erleichtert – der Kunde kann trotzdem frei tippen, die Buttons sind nur ein Angebot, keine Pflicht.

BETREUUNGS-ANGEBOT
Bevor du zum Abschluss kommst, erwähnst du aktiv, dass Tim neben der einmaligen Erstellung auch eine laufende monatliche Betreuung der Website anbietet, und fragst, ob das grundsätzlich interessant wäre. Bring 2-3 überzeugende, konkrete Argumente, warum sich das lohnt, z.B.:
- Regelmäßige Sicherheits-Updates, damit die Website nicht angreifbar oder veraltet wird
- Kleine Änderungen (Texte, Bilder, Öffnungszeiten, Angebote) werden einfach & unkompliziert übernommen, ohne dass jedes Mal extra abgerechnet wird
- Technischer Support, falls mal etwas nicht funktioniert – ohne dass der Kunde sich selbst darum kümmern muss
- Regelmäßige Backups zur Absicherung
Falls der Kunde konkret fragt, was die Betreuung kostet: Das darfst du beantworten – sag, dass sie pauschal ${MAINTENANCE_PERCENT}% des späteren Website-Preises pro Monat kostet. Nenne dabei aber KEINE konkrete Euro-Zahl (die kennst du zu diesem Zeitpunkt im Gespräch noch gar nicht sicher, und der finale Projekt-Preis wird erst später von Tim festgelegt).
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

/* ─── TOOL-SCHEMA: Antwort-Buttons ─────────────────────
   Optional, zusätzlich zum normalen Text-Reply aufrufbar: liefert
   2-5 kurze, antippbare Antwortoptionen passend zur gerade gestellten
   Frage. Wird NIE zusammen mit Name-/E-Mail-Fragen benutzt (dort ist
   freie Texteingabe nötig). */
const SUGGEST_OPTIONS_TOOL = {
  name: 'suggest_reply_options',
  description: 'Liefert 2-5 kurze Antwortoptionen als Tap-Buttons für die soeben gestellte Frage. NIEMALS bei der Frage nach Name oder E-Mail-Adresse aufrufen – dort ist freier Text nötig. Bei geschlossenen Auswahlfragen (Ziel, Branche, aktuelle Website ja/nein, Budget-Größenordnung, Interesse an Betreuung, etc.) IMMER zusätzlich zur Text-Antwort aufrufen.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 5,
        description: 'Kurze, tippbare Antwortmöglichkeiten (je 1-4 Wörter), passend zur aktuellen Frage.',
      },
    },
    required: ['options'],
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
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:14px;color:#166534;margin:0"><strong>🔧 Optional: Laufende Betreuung</strong><br>Damit deine Website auch nach dem Launch aktuell, sicher und gepflegt bleibt, biete ich eine laufende Betreuung für <strong>${maintenancePriceEur(lead.suggested_price_eur)} € im Monat</strong> an – inklusive Sicherheits-Updates, unkomplizierten kleinen Änderungen und technischem Support. Völlig unverbindlich, du entscheidest.</p>
    </div>
    ${p('Am einfachsten buchst du dir direkt einen Termin über die Website oder antwortest einfach auf diese E-Mail.')}
    <p style="font-size:13px;color:#94A3B8;margin-top:20px">Viele Grüße<br>Tim von TK Webtalent</p>
  `);
}

module.exports = {
  SYSTEM_PROMPT,
  SUBMIT_LEAD_TOOL,
  SUGGEST_OPTIONS_TOOL,
  FALLBACK_DONE_MESSAGE,
  MIN_PRICE,
  MAX_PRICE,
  MAINTENANCE_PERCENT,
  maintenancePriceEur,
  sendPushover,
  buildAdminReviewEmail,
  buildLeadOfferEmail,
};
