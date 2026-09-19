-- TK Webtalent – Vertriebspartner-Bewerbungsfunnel
-- Einmalig im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query).
--
-- Beide Tabellen werden ausschließlich über den Service-Role-Key aus
-- api/submit-sales-application.js bzw. api/track-funnel-event.js beschrieben
-- (Server-Endpunkte, kein direkter Client-Insert). RLS ist deshalb aktiv,
-- aber bewusst ohne Policies für anon/authenticated – der Service-Role-Key
-- umgeht RLS ohnehin, alle anderen Zugriffe werden so verweigert.

-- ── VOLLSTÄNDIGE BEWERBUNGEN ──────────────────────────────────────────
-- Wird nur angelegt, wenn ein Kandidat den Funnel bis zum Kontaktformular
-- durchläuft (alle Vorqualifikations-Fragen bestanden hat).
create table if not exists sales_applications (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  vorname                     text not null,
  nachname                    text not null,
  email                       text not null,
  telefon                     text not null,
  linkedin                    text,
  website                     text,

  vertriebserfahrung          text not null,
  vertriebserfahrung_details  text[],
  vertriebsdauer              text,
  bisherige_produkte          text,

  kaltakquise                 text not null,
  akquiseart                  text[],

  high_ticket_erfahrung       text not null,
  high_ticket_details         text,
  hoechster_verkaufswert      text,

  telefonakquise_bereit       text not null,
  zeit_pro_woche              text not null,
  provisionsmodell_akzeptiert text not null,
  selbststaendig              text not null,

  vertriebsstaerken           text[],
  motivation                  text,

  interne_einstufung          text not null,
  status                      text not null default 'Neu'
);

alter table sales_applications enable row level security;

-- ── ANONYME FUNNEL-STATISTIK ──────────────────────────────────────────
-- Ein Event pro erreichter Etappe / pro Ausstieg. Enthält bewusst KEINE
-- personenbezogenen Daten, damit auch automatisch beendete Bewerbungen
-- anonym in die Conversion-Auswertung einfließen dürfen.
create table if not exists funnel_events (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  funnel          text not null default 'vertriebspartner',
  event           text not null,        -- started | question_reached | exited | contact_reached | submitted
  question_number int,
  session_id      text
);

alter table funnel_events enable row level security;

create index if not exists funnel_events_funnel_event_idx on funnel_events (funnel, event);
