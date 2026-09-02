-- TK Webtalent – Termin-Erinnerungen
-- Einmalig im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query).
-- Fügt die zwei Spalten hinzu, mit denen api/send-appointment-reminders.js
-- Doppelversand verhindert (nur Termine mit column IS NULL werden angeschrieben).

alter table appointments
  add column if not exists reminder_7d_sent_at  timestamptz,
  add column if not exists reminder_24h_sent_at timestamptz;
