/* ===================================================
   TK WEBTALENT – SERVERLESS FUNCTION: delete-customer
   Löscht einen Kunden vollständig (Auth-Nutzer, Profil
   und alle zugehörigen Daten). Darf nur von authenti-
   fizierten Admins aufgerufen werden.
   Der SUPABASE_SERVICE_ROLE_KEY bleibt ausschließlich
   serverseitig und wird niemals an den Browser gesendet.
   =================================================== */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  /* CORS-Header für gleiche Domain */
  res.setHeader('Access-Control-Allow-Origin',  'https://tk-webtalent.de');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Methode nicht erlaubt.' });

  /* ── Service-Role-Client (serverseitig) ── */
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  /* ── Bearer Token aus dem Request-Header ── */
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht autorisiert.' });
  }
  const token = authHeader.slice(7);

  /* ── Caller-Token verifizieren ── */
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Ungültige oder abgelaufene Sitzung.' });
  }

  /* ── Admin-Rolle prüfen (serverseitig, RLS umgangen via Service Role) ── */
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
    return res.status(403).json({ error: 'Keine Admin-Berechtigung.' });
  }

  /* ── Eingaben validieren ── */
  const { customerId } = req.body || {};
  if (!customerId) {
    return res.status(400).json({ error: 'Kunden-ID fehlt.' });
  }

  /* ── Zu löschenden Kunden prüfen ── */
  const { data: customer, error: customerErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', customerId)
    .single();

  if (customerErr || !customer) {
    return res.status(404).json({ error: 'Kunde nicht gefunden.' });
  }
  if (customer.role !== 'customer') {
    return res.status(400).json({ error: 'Nur Kundenkonten können gelöscht werden.' });
  }

  /* ── Zugehörige Daten löschen (unabhängig von DB-Cascade-Regeln) ── */
  await Promise.all([
    supabaseAdmin.from('messages').delete().eq('customer_id', customerId),
    supabaseAdmin.from('appointments').delete().eq('customer_id', customerId),
    supabaseAdmin.from('projects').delete().eq('customer_id', customerId)
  ]);

  await supabaseAdmin.from('profiles').delete().eq('id', customerId);

  /* ── Auth-Nutzer löschen (Login damit endgültig gesperrt) ── */
  const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(customerId);
  if (deleteAuthErr) {
    return res.status(500).json({ error: 'Kunde wurde entfernt, Auth-Konto konnte aber nicht gelöscht werden: ' + deleteAuthErr.message });
  }

  return res.status(200).json({ success: true });
};
