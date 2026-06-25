-- ───────────────────────────────────────────────────────────────────────────
-- Migration 0003 — Persistance des conversations IA (inbox type Crisp)
-- À coller dans le SQL Editor Supabase.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists conversations (
  id            text primary key,                 -- id généré côté client (useChat)
  statut        text not null default 'en_cours', -- en_cours | terminee | a_rappeler
  client_id     uuid references clients(id) on delete set null,
  demande_id    uuid references demandes(id) on delete set null,
  complexite    text,
  transcript    jsonb not null default '[]'::jsonb, -- [{role, text}]
  dernier_message text,
  nb_messages   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversations_updated_idx on conversations (updated_at desc);
create index if not exists conversations_statut_idx on conversations (statut);
