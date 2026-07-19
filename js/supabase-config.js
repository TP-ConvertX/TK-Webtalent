/* ===================================================
   TK WEBTALENT – SUPABASE KONFIGURATION
   Trage hier deine Supabase-Zugangsdaten ein.
   Der Anon Key ist für den Browser bestimmt und sicher öffentlich.
   Der Service Role Key darf NIEMALS hier stehen.
   =================================================== */

const SUPABASE_URL      = 'https://dwcmmghuaswwmsojitls.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hKg2lc-bdM87f5EXjsEqcQ_RArHVqi_';

// Interner API-Endpunkt (Vercel Serverless Function)
const API_CREATE_USER = '/api/create-user';
