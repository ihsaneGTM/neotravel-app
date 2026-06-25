-- ───────────────────────────────────────────────────────────────────────────
-- Migration 0002 — Contact complet (prénom) + traçabilité d'envoi des devis
-- À coller dans le SQL Editor Supabase.
-- ───────────────────────────────────────────────────────────────────────────

-- Prénom du client (séparé du nom)
alter table clients add column if not exists prenom text;

-- Traçabilité de l'envoi réel du devis (preuve)
alter table devis add column if not exists destinataire text;   -- email destinataire
alter table devis add column if not exists resend_id text;       -- id message Resend (preuve)
-- (les colonnes envoye_at, numero, pdf_url existent déjà dans 0001)
