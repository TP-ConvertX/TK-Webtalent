/* ===================================================
   TK WEBTALENT – KI-CHATBOT (Lead-Qualifizierung)
   Stateless: Client schickt bei jedem Request die volle
   Nachrichten-Historie mit. Claude entscheidet selbst, wann
   genug Infos vorliegen (Tool-Aufruf "submit_lead_summary").
   Ruft das Tool NIE direkt eine Kunden-Mail aus – die geht
   erst nach manueller Freigabe durch Tim (api/lead-review.js).

   POST { messages: [{role, content}, ...] } → { reply, done, leadId? }
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const {
  SYSTEM_PROMPT,
  SUBMIT_LEAD_TOOL,
  FALLBACK_DONE_MESSAGE,
  MIN_PRICE,
  MAX_PRICE,
  sendPushover,
  buildAdminReviewEmail,
} = require('./_lead-helpers');

const MODEL = 'claude-sonnet-5';
const MAX_MESSAGES = 60; // grobe Obergrenze gegen ausufernde/missbräuchliche Konversationen
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function callClaude(messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [SUBMIT_LEAD_TOOL],
      tool_choice: { type: 'auto' },
      output_config: { effort: 'medium' },
      messages,
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Anthropic API ${r.status}: ${errText}`);
  }
  return r.json();
}

function validateLeadInput(input) {
  if (typeof input.suggested_price_eur !== 'number' || input.suggested_price_eur < MIN_PRICE || input.suggested_price_eur > MAX_PRICE) {
    return `suggested_price_eur muss eine Zahl zwischen ${MIN_PRICE} und ${MAX_PRICE} sein.`;
  }
  if (!input.email || !EMAIL_RE.test(input.email)) {
    return 'email ist keine gültige E-Mail-Adresse. Bitte beim Kunden nachfragen, falls sie fehlt oder ungültig aussieht, und das Tool erst danach erneut aufrufen.';
  }
  if (!input.name || !input.name.trim()) {
    return 'name darf nicht leer sein.';
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'server_not_configured' });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'invalid_messages' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'conversation_too_long' });
  }

  let convo = messages.map(m => ({ role: m.role, content: m.content }));

  let response;
  try {
    response = await callClaude(convo);
  } catch (e) {
    console.error('[chat] Anthropic-Fehler:', e.message);
    return res.status(502).json({ error: 'ai_unavailable' });
  }

  let toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'submit_lead_summary');

  /* Einmaliger interner Retry, falls die Tool-Eingabe offensichtlich
     unplausibel ist (z.B. Preis außerhalb der Spanne, kaputte E-Mail) –
     Claude bekommt die Chance, sich selbst zu korrigieren, ohne dass der
     Kunde davon etwas mitbekommt. */
  if (toolUse) {
    const validationError = validateLeadInput(toolUse.input);
    if (validationError) {
      convo = [
        ...convo,
        { role: 'assistant', content: response.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: validationError, is_error: true }] },
      ];
      try {
        response = await callClaude(convo);
      } catch (e) {
        console.error('[chat] Anthropic-Retry-Fehler:', e.message);
        return res.status(502).json({ error: 'ai_unavailable' });
      }
      toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'submit_lead_summary');
      if (toolUse && validateLeadInput(toolUse.input)) {
        // Zweiter Fehlschlag: nicht endlos weiter versuchen, normal weiterreden lassen
        toolUse = null;
      }
    }
  }

  if (toolUse) {
    const lead = toolUse.input;

    const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: inserted, error: insertErr } = await sbAdmin
      .from('leads')
      .insert({
        status: 'pending_review',
        conversation: convo,
        name: lead.name,
        email: lead.email,
        profession: lead.profession || null,
        current_website: lead.current_website || null,
        main_goal: lead.main_goal,
        project_details: lead.project_details,
        budget_hint: lead.budget_hint || null,
        suggested_price_eur: lead.suggested_price_eur,
        price_reasoning: lead.price_reasoning,
        design_direction: lead.design_direction || null,
        raw_tool_input: lead,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[chat] Supabase-Insert-Fehler:', insertErr.message);
      return res.status(500).json({ error: 'lead_save_failed' });
    }

    const leadId = inserted.id;
    const reviewUrl = `https://tk-webtalent.de/api/lead-review?id=${leadId}`;

    /* Best-effort: E-Mail + Push an Tim. WICHTIG: hier awaiten (nicht
       "fire and forget") – Vercel-Functions garantieren nach dem
       Senden der Response keine weitere Ausführung mehr. Jeder Aufruf
       ist einzeln try/catch-abgesichert, damit ein Fehler hier nie den
       Chat-Abschluss für den Kunden blockiert. */
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const FROM = process.env.FROM_EMAIL || 'TK Webtalent <kontakt@tp-convertx.de>';
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kunzelmanntim00@gmail.com';

    if (RESEND_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: ADMIN_EMAIL,
            subject: `🆕 Neue Anfrage: ${lead.name} (${lead.suggested_price_eur} €)`,
            html: buildAdminReviewEmail(lead, reviewUrl),
          }),
        });
        if (!r.ok) console.error('[chat] Resend (Admin):', await r.text());
      } catch (e) {
        console.error('[chat] E-Mail-Fehler (Admin):', e.message);
      }
    }

    await sendPushover({
      title: `Neue Anfrage: ${lead.name}`,
      message: `${lead.suggested_price_eur} € vorgeschlagen – ${lead.main_goal}`,
      url: reviewUrl,
      urlTitle: 'Anfrage prüfen',
    });

    return res.status(200).json({ reply: FALLBACK_DONE_MESSAGE, done: true, leadId });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  const reply = textBlock ? textBlock.text : 'Entschuldige, kannst du das nochmal anders formulieren?';

  return res.status(200).json({ reply, done: false });
};
