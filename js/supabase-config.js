/* ===================================================
   TK WEBTALENT – SUPABASE KONFIGURATION
   Trage hier deine Supabase-Zugangsdaten ein.
   Der Anon Key ist für den Browser bestimmt und sicher öffentlich.
   Der Service Role Key darf NIEMALS hier stehen.
   =================================================== */

const SUPABASE_URL      = 'https://DEIN-PROJEKT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'DEIN-ANON-KEY-HIER-EINTRAGEN';

// Interner API-Endpunkt (Vercel Serverless Function)
const API_CREATE_USER = '/api/create-user';
