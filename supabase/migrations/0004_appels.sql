-- ───────────────────────────────────────────────────────────────────────────
-- Migration 0004 — Appels commerciaux (simulés en démo, puis webhook Aircall/Ringover)
-- À coller dans le SQL Editor Supabase.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists appels (
  id            uuid primary key default gen_random_uuid(),
  demande_id    uuid not null references demandes(id) on delete cascade,
  commercial_id uuid references commerciaux(id) on delete set null,
  source        text not null default 'simulation',  -- simulation | aircall | ringover
  simule        boolean not null default true,
  duree_sec     integer,
  transcript    text,
  resume        text,
  created_at    timestamptz not null default now()
);
create index if not exists appels_demande_idx on appels (demande_id);
