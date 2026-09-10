/* ===================================================
   TK WEBTALENT – ADMIN: TERMIN ANLEGEN (server-seitig)
   Läuft über den Service Role Key statt eines direkten
   Client-Inserts, damit Termine für BELIEBIGE Personen
   angelegt werden können (customer_id: null + guest_name/
   guest_email) – unabhängig davon, wie die RLS-Policies für
   Kunden-Inserts im Detail aussehen. Nur für Admins.
   =================================================== */

const { createClient } = require('@supabase/supabase-js');
const { APPT_TYPES } = require('./_appointment-helpers');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  /* ── Bearer Token + Admin-Rolle prüfen ── */
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  const token = authHeader.slice(7);

  const { data: { user }, error: authErr } = await sbAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'invalid_session' });

  const { data: callerProfile, error: profileErr } = await sbAdmin
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
    return res.status(403).json({ error: 'forbidden' });
  }

  /* ── Eingaben validieren ── */
  const { date, time, appointmentType, address, notes, customerId, guestName, guestEmail } = req.body || {};

  if (!date || !time) return res.status(400).json({ error: 'Datum und Uhrzeit fehlen.' });
  if (!APPT_TYPES.includes(appointmentType)) return res.status(400).json({ error: 'Ungültige Terminart.' });
  if (appointmentType === 'persoenlich' && !address) return res.status(400).json({ error: 'Adresse fehlt.' });
  if (!customerId && !guestName) return res.status(400).json({ error: 'Bitte Kunde oder Name angeben.' });
  if (customerId && guestName) return res.status(400).json({ error: 'Entweder Kunde ODER Name, nicht beides.' });

  const { data: inserted, error: insertErr } = await sbAdmin.from('appointments').insert({
    customer_id:      customerId || null,
    guest_name:       customerId ? null : String(guestName).trim(),
    guest_email:      customerId ? null : (guestEmail ? String(guestEmail).trim() : null),
    appointment_date: date,
    appointment_time: time.length === 5 ? time + ':00' : time,
    status:           'confirmed',
    notes:            notes ? String(notes).trim() : null,
    appointment_type: appointmentType,
    appointment_address: appointmentType === 'persoenlich' ? address : null,
  }).select('id').single();

  if (insertErr) {
    if (insertErr.code === '23505') return res.status(409).json({ error: 'slot_taken' });
    console.error('[admin-book-appointment] insert error:', insertErr);
    return res.status(500).json({ error: insertErr.message });
  }

  return res.status(200).json({ ok: true, id: inserted.id });
};
