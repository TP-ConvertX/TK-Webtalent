/* ===================================================
   TK WEBTALENT – ÖFFENTLICHE VERFÜGBARKEIT
   Gibt gebuchte Slots zurück (kein Auth nötig)
   =================================================== */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await sbAdmin
    .from('appointments')
    .select('appointment_date, appointment_time')
    .eq('status', 'confirmed')
    .gte('appointment_date', today);

  if (error) {
    console.error('[get-availability]', error);
    return res.status(500).json({ error: error.message });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ appointments: data || [] });
};
