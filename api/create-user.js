/* ===================================================
   TK WEBTALENT – SERVERLESS FUNCTION: create-user
   Erstellt einen neuen Auth-Nutzer und dessen Profil.
   Darf nur von authentifizierten Admins aufgerufen werden.
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
  const { email, password, full_name, company_name } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich.' });
  }

  const trimmedEmail = String(email).toLowerCase().trim();
  const trimmedName  = String(full_name).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen haben.' });
  }
  if (trimmedName.length < 2) {
    return res.status(400).json({ error: 'Bitte einen vollständigen Namen eingeben.' });
  }

  /* ── Auth-Nutzer anlegen ── */
  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email:         trimmedEmail,
    password:      String(password),
    email_confirm: false      /* Kunde muss E-Mail erst bestätigen, bevor Login möglich ist */
  });

  if (createErr) {
    if (createErr.message.includes('already registered')) {
      return res.status(400).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
    }
    return res.status(400).json({ error: 'Fehler beim Erstellen des Kontos: ' + createErr.message });
  }

  /* ── Profil in der Datenbank anlegen ── */
  const { error: profErr } = await supabaseAdmin.from('profiles').insert({
    id:           newUser.user.id,
    full_name:    trimmedName,
    company_name: company_name ? String(company_name).trim() : null,
    role:         'customer',
    active:       true
  });

  if (profErr) {
    /* Rollback: Auth-Nutzer wieder löschen */
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return res.status(500).json({ error: 'Fehler beim Anlegen des Profils. Bitte erneut versuchen.' });
  }

  /* ── Bestätigungsmail an den Kunden senden ── */
  await supabaseAdmin.auth.resend({
    type:  'signup',
    email: trimmedEmail,
    options: { emailRedirectTo: 'https://tk-webtalent.de/kunden-login' }
  });

  return res.status(200).json({
    success: true,
    userId:  newUser.user.id,
    message: `Konto für ${trimmedName} erstellt. Der Kunde muss die E-Mail-Adresse bestätigen, bevor der Login möglich ist.`
  });
};
