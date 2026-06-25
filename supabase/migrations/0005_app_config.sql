-- ───────────────────────────────────────────────────────────────────────────
-- Migration 0005 — Variables de configuration éditables (depuis le Workflow)
-- À coller dans le SQL Editor Supabase.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
