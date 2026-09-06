/* ===================================================
   TK WEBTALENT – KI-ERSTEINSCHÄTZUNG (ersteinschaetzung.html)
   Nimmt die 5 Quiz-Antworten entgegen und lässt Claude daraus
   zwei Texte schreiben: einen kurzen "Teaser" (wird sofort auf
   der Seite gezeigt) und eine vollständigere Einschätzung (geht
   nur per E-Mail an Tim, der sie prüft/anpasst, bevor er selbst
   antwortet – die KI ersetzt nicht den persönlichen Kontakt).

   POST { branche, website, ziel, tempo, budget } → { teaser, full }
   =================================================== */

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `Du hilfst Tim, dem Gründer von TK Webtalent (Ein-Personen-Webdesign-Studio für Selbstständige, Handwerker und Dienstleister), eine kurze Ersteinschätzung für einen Interessenten zu formulieren, der gerade einen 5-Fragen-Quiz auf der Website ausgefüllt hat.

Ton: persönlich, direkt, ehrlich, ohne Agentur-Floskeln – wie Tim selbst schreiben würde. Erste Person ("ich"). Keine erfundenen Fakten über das konkrete Unternehmen des Interessenten – nur allgemeine, aber spürbar individuelle Einschätzungen basierend auf den Quiz-Antworten.

Du bekommst genau ein Tool zur Verfügung: "give_assessment". Rufe es immer auf, nie normalen Text.
- "teaser": 2–3 Sätze. Ein konkreter, hilfreicher Gedanke zu ihrer Situation – genug, um echten Mehrwert zu zeigen, aber bewusst nicht die komplette Einschätzung. Endet so, dass Neugier auf mehr entsteht.
- "full": 3–5 kurze Absätze. Geht auf Branche, aktuellen Website-Status, Ziel, Zeitrahmen und Budget-Vorstellung ein, nennt 2–3 konkrete, sinnvolle nächste Schritte. Kein Preis-Versprechen (Tim macht individuelle Angebote). Endet mit einem Hinweis, dass Tim sich gerne persönlich meldet.`;

const GIVE_ASSESSMENT_TOOL = {
  name: 'give_assessment',
  description: 'Liefert die zweiteilige Ersteinschätzung.',
  input_schema: {
    type: 'object',
    properties: {
      teaser: { type: 'string', description: 'Kurzer Teaser, 2-3 Sätze.' },
      full: { type: 'string', description: 'Vollständigere Einschätzung, 3-5 Absätze.' },
    },
    required: ['teaser', 'full'],
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'server_not_configured' });

  const { branche, website, ziel, tempo, budget } = req.body || {};
  if (!branche || !website || !ziel || !tempo || !budget) {
    return res.status(400).json({ error: 'Fehlende Angaben' });
  }

  const userMsg = `Branche: ${branche}\nAktuelle Website: ${website}\nHauptziel: ${ziel}\nZeitrahmen: ${tempo}\nBudget-Vorstellung: ${budget}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [GIVE_ASSESSMENT_TOOL],
        tool_choice: { type: 'tool', name: 'give_assessment' },
        output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!r.ok) {
      console.error('[generate-assessment] Anthropic:', await r.text());
      return res.status(502).json({ error: 'ai_unavailable' });
    }

    const data = await r.json();
    const toolUse = data.content.find(b => b.type === 'tool_use' && b.name === 'give_assessment');
    if (!toolUse || !toolUse.input.teaser || !toolUse.input.full) {
      return res.status(502).json({ error: 'ai_bad_response' });
    }

    return res.status(200).json({ teaser: toolUse.input.teaser, full: toolUse.input.full });
  } catch (e) {
    console.error('[generate-assessment] Fehler:', e.message);
    return res.status(502).json({ error: 'ai_unavailable' });
  }
};
