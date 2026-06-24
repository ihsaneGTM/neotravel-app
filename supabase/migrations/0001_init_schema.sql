-- =============================================================================
-- NeoTravel — Schéma Postgres complet (Supabase)
-- Livrable 2 — CRM cycle commercial intermédiation transport autocar
-- =============================================================================
-- Règle d'or : l'IA décide/met en forme, le CODE calcule. Le prix vient toujours
-- du tool déterministe calculer_devis() (lookup sur la table `matrices`), jamais
-- du LLM. Ce schéma stocke les coefficients de pricing comme données auditables.
--
-- Ordre : extensions -> enums -> fonction updated_at -> tables -> trigger
--         statut_historique -> index -> seed matrices -> note RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
-- gen_random_uuid() est fourni par pgcrypto (présent par défaut sur Supabase).
create extension if not exists "pgcrypto";


-- =============================================================================
-- 1. ENUMS
-- =============================================================================

-- Pipeline statut d'une demande : chaque transition est journalisée (trigger).
create type statut_demande as enum (
  'new',
  'qualified',
  'contacted',
  'quote_sent',
  'negotiation',
  'won',
  'lost'
);

-- Nature du déplacement.
create type type_deplacement as enum (
  'aller_simple',
  'aller_retour',
  'circuit'
);

-- Type de prestation = sert au filtre de spécialité pour l'attribution.
create type type_prestation as enum (
  'transfert',
  'navette',
  'scolaire',
  'seminaire',
  'tourisme',
  'mise_a_disposition'
);

-- Segment client.
create type type_client as enum (
  'particulier',
  'asso',
  'collectivite',
  'entreprise'
);

-- Canal d'entrée de la demande.
create type canal_demande as enum (
  'conversation_ia',
  'telephone',
  'email',
  'formulaire',
  'autre'
);

-- Complexité = pilote le parcours (devis auto vs escalade humaine).
create type complexite_demande as enum (
  'simple',       -- trajet direct, 1 journée, >7j, <=85 pax -> devis auto
  'complexe',     -- plusieurs jours / étapes / circuit -> prix bloqué + escalade
  'urgence',      -- <48h -> pas de devis auto, notification
  'incoherent'    -- garde-fou (retour<départ, 0 pax, date passée) -> correction
);

-- Type de devis.
create type type_devis as enum (
  'estimation',   -- pré-tarification indicative (même tool calculer_devis)
  'ferme'         -- tarification finale après appel commercial
);

-- Type de relance (séquence email Resend / Vercel Cron).
create type type_relance as enum (
  'j1',
  'j3',
  'j7',
  'relance_negociation',
  'relance_personnalisee'
);

-- Statut d'une relance.
create type statut_relance as enum (
  'planifiee',
  'envoyee',
  'echec',
  'annulee'
);


-- =============================================================================
-- 2. Fonction générique : maintien de updated_at
-- =============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 entreprises  — clients B2B (asso/collectivité/entreprise) rattachés
-- -----------------------------------------------------------------------------
create table entreprises (
  id            uuid primary key default gen_random_uuid(),
  raison_sociale text        not null,
  siret         text,
  type_client   type_client  not null default 'entreprise',
  adresse       text,
  code_postal   text,
  ville         text,
  email_contact text,
  telephone     text,
  notes         text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  constraint entreprises_siret_format
    check (siret is null or siret ~ '^[0-9]{14}$')
);

create trigger trg_entreprises_updated_at
  before update on entreprises
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.2 commerciaux  — équipe de vente (attribution + commissions)
-- -----------------------------------------------------------------------------
create table commerciaux (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text    not null,
  email               text    not null unique,
  telephone           text,
  actif               boolean not null default true,
  -- spécialités : filtre n°1 de l'attribution (intersection avec type_prestation)
  specialites         type_prestation[] not null default '{}',
  -- charge_courante : départage (critère n°2 d'attribution)
  charge_courante     integer not null default 0,
  -- commissions_cumulees : critère n°1 d'attribution (on attribue au plus faible)
  commissions_cumulees numeric(12,2) not null default 0,
  taux_commission     numeric(5,4) not null default 0.05,  -- ex 0.05 = 5%
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint commerciaux_charge_positive       check (charge_courante >= 0),
  constraint commerciaux_commissions_positives check (commissions_cumulees >= 0),
  constraint commerciaux_taux_valide           check (taux_commission >= 0 and taux_commission <= 1)
);

create trigger trg_commerciaux_updated_at
  before update on commerciaux
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.3 clients  — personne contact (RGPD : minimisation + consentement)
-- -----------------------------------------------------------------------------
create table clients (
  id               uuid primary key default gen_random_uuid(),
  entreprise_id    uuid references entreprises(id) on delete set null,  -- nullable (particulier)
  type_client      type_client not null default 'particulier',
  nom              text not null,
  email            text,
  telephone        text,
  -- RGPD : consentement explicite avant toute prospection / relance
  consentement_rgpd boolean   not null default false,
  consentement_date timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- au moins un moyen de contact
  constraint clients_contact_present
    check (email is not null or telephone is not null),
  constraint clients_email_format
    check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.4 demandes  — le cœur du pipeline
-- -----------------------------------------------------------------------------
create table demandes (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id) on delete set null,
  commercial_id     uuid references commerciaux(id) on delete set null,  -- attribution

  -- Statut pipeline (le trigger journalise chaque changement)
  statut            statut_demande not null default 'new',

  -- ---- Champs métier collectés en conversation ----
  type_deplacement  type_deplacement not null,
  ville_depart      text not null,
  ville_arrivee     text,                       -- null possible pour mise_a_disposition
  etapes            text[] not null default '{}',
  date_depart       date not null,
  date_retour       date,
  heure_depart      time,
  heure_retour      time,
  nb_voyageurs      integer not null,
  type_prestation   type_prestation not null,
  options           text[] not null default '{}',
  budget_indicatif  numeric(12,2),
  commentaire       text,
  type_client       type_client not null default 'particulier',

  -- ---- Champs déduits (non demandés au client) ----
  date_demande      date not null default current_date,
  distance_km       numeric(10,2),
  type_vehicule     text,                        -- déduit du nb_voyageurs
  nuitees           integer,                     -- déduit des dates (circuit/séjour)
  nuit_chauffeur    boolean not null default false,
  urgence           boolean not null default false, -- date_demande vs date_depart <48h

  -- ---- Pilotage / routage ----
  complexite        complexite_demande not null default 'simple',
  canal             canal_demande not null default 'conversation_ia',
  -- panier estimé : sert au routage haut panier (estimation masquée + escalade)
  valeur_panier_estimee numeric(12,2),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- ---- Garde-fous (cohérence) ----
  constraint demandes_nb_voyageurs_positif
    check (nb_voyageurs > 0),
  constraint demandes_distance_positive
    check (distance_km is null or distance_km >= 0),
  constraint demandes_nuitees_positives
    check (nuitees is null or nuitees >= 0),
  -- retour >= départ quand un retour est fourni
  constraint demandes_dates_coherentes
    check (date_retour is null or date_retour >= date_depart),
  -- aller_retour exige une date de retour
  constraint demandes_ar_date_retour
    check (type_deplacement <> 'aller_retour' or date_retour is not null),
  constraint demandes_budget_positif
    check (budget_indicatif is null or budget_indicatif >= 0),
  constraint demandes_panier_positif
    check (valeur_panier_estimee is null or valeur_panier_estimee >= 0)
);

create trigger trg_demandes_updated_at
  before update on demandes
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.5 devis  — sortie de calculer_devis() (estimation) puis devis ferme
-- -----------------------------------------------------------------------------
create table devis (
  id            uuid primary key default gen_random_uuid(),
  demande_id    uuid not null references demandes(id) on delete cascade,
  commercial_id uuid references commerciaux(id) on delete set null,

  type          type_devis not null default 'estimation',
  numero        text unique,                 -- ex DEV-2026-00042 (devis ferme)

  -- Montants (sortie déterministe du moteur)
  prix_ht       numeric(12,2) not null,
  tva           numeric(12,2) not null,
  prix_ttc      numeric(12,2) not null,
  taux_tva      numeric(5,4) not null default 0.10,
  devise        text not null default 'EUR',

  -- Détail auditable
  lignes        jsonb not null default '[]'::jsonb,   -- [{libelle, montant}]
  coefficients  jsonb not null default '[]'::jsonb,   -- [{nom, valeur}]

  -- Check IA anti-erreur avant envoi auto
  check_ia_ok      boolean not null default false,
  check_ia_message text,

  -- Estimation masquée (haut panier / cas complexe) : non communiquée au client
  masque        boolean not null default false,

  pdf_url       text,
  envoye_at     timestamptz,
  valide_jusqu_au date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint devis_montants_positifs
    check (prix_ht >= 0 and tva >= 0 and prix_ttc >= 0),
  constraint devis_devise_iso
    check (char_length(devise) = 3)
);

create trigger trg_devis_updated_at
  before update on devis
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.6 relances  — séquence email planifiée (Vercel Cron + Resend)
-- -----------------------------------------------------------------------------
create table relances (
  id            uuid primary key default gen_random_uuid(),
  demande_id    uuid not null references demandes(id) on delete cascade,
  devis_id      uuid references devis(id) on delete set null,

  type          type_relance not null,
  statut        statut_relance not null default 'planifiee',

  planifiee_pour timestamptz not null,
  envoyee_at     timestamptz,
  canal          text not null default 'email',
  destinataire   text,
  objet          text,
  corps          text,
  resend_id      text,                       -- id message Resend (traçabilité)
  erreur         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_relances_updated_at
  before update on relances
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.7 attributions  — historique d'affectation demande -> commercial
-- -----------------------------------------------------------------------------
-- Trace l'algorithme : spécialité -> commissions_cumulees mini -> charge_courante.
create table attributions (
  id              uuid primary key default gen_random_uuid(),
  demande_id      uuid not null references demandes(id) on delete cascade,
  commercial_id   uuid not null references commerciaux(id) on delete cascade,
  -- snapshot des critères au moment de l'attribution (audit)
  motif           text,
  commissions_au_moment numeric(12,2),
  charge_au_moment      integer,
  attribue_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 3.8 statut_historique  — journal des transitions de pipeline (KPIs)
-- -----------------------------------------------------------------------------
create table statut_historique (
  id             uuid primary key default gen_random_uuid(),
  demande_id     uuid not null references demandes(id) on delete cascade,
  ancien_statut  statut_demande,              -- null à la création
  nouveau_statut statut_demande not null,
  changed_at     timestamptz not null default now(),
  par            text                          -- 'ia' | 'cron' | email commercial | 'system'
);


-- -----------------------------------------------------------------------------
-- 3.9 matrices  — paramètres de pricing (lookup déterministe calculer_devis)
-- -----------------------------------------------------------------------------
-- categorie : 'base' | 'saison' | 'anticipation' | 'capacite' | 'option' | 'tva' | 'marge'
-- cle        : identifiant de la règle dans la catégorie
-- valeur     : coefficient multiplicatif (saison/anticipation/capacite/marge/tva)
--              ou montant unitaire (base, options)
create table matrices (
  id          uuid primary key default gen_random_uuid(),
  categorie   text not null,
  cle         text not null,
  libelle     text not null,
  -- coefficient (ex 1.10 pour +10%) OU montant unitaire EUR selon la catégorie
  valeur      numeric(12,4) not null,
  unite       text,                            -- ex 'pct' | 'eur' | 'eur_par_km' | 'eur_par_jour' | 'eur_par_nuit'
  -- bornes optionnelles (capacité / anticipation) pour le lookup par intervalle
  borne_min   numeric(12,2),
  borne_max   numeric(12,2),
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint matrices_categorie_cle_unique unique (categorie, cle)
);

create trigger trg_matrices_updated_at
  before update on matrices
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.10 logs  — journal applicatif (appels tool, check IA, prompt-injection, etc.)
-- -----------------------------------------------------------------------------
create table logs (
  id           uuid primary key default gen_random_uuid(),
  demande_id   uuid references demandes(id) on delete set null,
  niveau       text not null default 'info',   -- 'debug'|'info'|'warn'|'error'
  type_event   text not null,                  -- ex 'tool_calculer_devis'|'check_ia'|'prompt_injection'|'attribution'
  message      text,
  payload      jsonb,                          -- entrée/sortie tool, etc.
  acteur       text,                           -- 'ia'|'cron'|'commercial'|'system'
  created_at   timestamptz not null default now()
);


-- =============================================================================
-- 4. TRIGGER : journalisation des transitions de statut des demandes
-- =============================================================================
-- À chaque UPDATE qui modifie demandes.statut, on insère une ligne dans
-- statut_historique. On capte aussi l'INSERT initial (ancien = null).
create or replace function log_statut_demande()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into statut_historique (demande_id, ancien_statut, nouveau_statut, par)
    values (new.id, null, new.statut, 'system');
    return new;
  elsif (tg_op = 'UPDATE' and new.statut is distinct from old.statut) then
    insert into statut_historique (demande_id, ancien_statut, nouveau_statut, par)
    values (new.id, old.statut, new.statut, coalesce(current_setting('app.acteur', true), 'system'));
    return new;
  end if;
  return new;
end;
$$;

create trigger trg_demandes_log_statut_ins
  after insert on demandes
  for each row execute function log_statut_demande();

create trigger trg_demandes_log_statut_upd
  after update of statut on demandes
  for each row execute function log_statut_demande();


-- =============================================================================
-- 5. INDEX
-- =============================================================================
-- Demandes : funnel par statut, KPIs délai, vue commercial.
create index idx_demandes_statut          on demandes (statut);
create index idx_demandes_date_demande    on demandes (date_demande);
create index idx_demandes_date_depart     on demandes (date_depart);
create index idx_demandes_commercial      on demandes (commercial_id);
create index idx_demandes_client          on demandes (client_id);
create index idx_demandes_complexite      on demandes (complexite);

-- Historique : reconstruction du funnel / délais par demande.
create index idx_statut_hist_demande      on statut_historique (demande_id);
create index idx_statut_hist_changed_at   on statut_historique (changed_at);

-- Devis : retrouver les devis d'une demande, devis non vérifiés.
create index idx_devis_demande            on devis (demande_id);
create index idx_devis_commercial         on devis (commercial_id);
create index idx_devis_type               on devis (type);

-- Relances : worker Cron qui scanne les relances dues.
create index idx_relances_demande         on relances (demande_id);
create index idx_relances_planif_statut   on relances (statut, planifiee_pour);

-- Attributions : charge par commercial.
create index idx_attributions_demande     on attributions (demande_id);
create index idx_attributions_commercial  on attributions (commercial_id);

-- Clients / entreprises.
create index idx_clients_entreprise       on clients (entreprise_id);
create index idx_clients_email            on clients (email);

-- Logs : tri chronologique + filtre par event.
create index idx_logs_demande             on logs (demande_id);
create index idx_logs_created_at          on logs (created_at);
create index idx_logs_type_event          on logs (type_event);


-- =============================================================================
-- 6. SEED — matrices de pricing (valeurs fournies)
-- =============================================================================
-- Coefficients = facteur multiplicatif (1.10 = +10%, 0.93 = -7%).
-- Montants     = EUR unitaires (base, options).

-- --- 6.1 Grille forfait TRANSFERT SIMPLE (≤ 180 km) ---
-- Règle officielle : prix forfait par tranche de 10 km. AR = simple × 2.
-- Lookup : première tranche dont borne_max >= distance_aller.
insert into matrices (categorie, cle, libelle, valeur, unite, borne_max) values
  ('forfait', 'tr_010', 'Forfait <= 10 km',  250.00, 'eur', 10),
  ('forfait', 'tr_020', 'Forfait <= 20 km',  250.00, 'eur', 20),
  ('forfait', 'tr_030', 'Forfait <= 30 km',  250.00, 'eur', 30),
  ('forfait', 'tr_040', 'Forfait <= 40 km',  320.00, 'eur', 40),
  ('forfait', 'tr_050', 'Forfait <= 50 km',  350.00, 'eur', 50),
  ('forfait', 'tr_060', 'Forfait <= 60 km',  390.00, 'eur', 60),
  ('forfait', 'tr_070', 'Forfait <= 70 km',  430.00, 'eur', 70),
  ('forfait', 'tr_080', 'Forfait <= 80 km',  500.00, 'eur', 80),
  ('forfait', 'tr_090', 'Forfait <= 90 km',  540.00, 'eur', 90),
  ('forfait', 'tr_100', 'Forfait <= 100 km', 580.00, 'eur', 100),
  ('forfait', 'tr_110', 'Forfait <= 110 km', 620.00, 'eur', 110),
  ('forfait', 'tr_120', 'Forfait <= 120 km', 660.00, 'eur', 120),
  ('forfait', 'tr_130', 'Forfait <= 130 km', 700.00, 'eur', 130),
  ('forfait', 'tr_140', 'Forfait <= 140 km', 740.00, 'eur', 140),
  ('forfait', 'tr_150', 'Forfait <= 150 km', 780.00, 'eur', 150),
  ('forfait', 'tr_160', 'Forfait <= 160 km', 820.00, 'eur', 160),
  ('forfait', 'tr_170', 'Forfait <= 170 km', 860.00, 'eur', 170),
  ('forfait', 'tr_180', 'Forfait <= 180 km', 900.00, 'eur', 180);

-- --- 6.1b Au-delà de 180 km : (km_aller × 2) × 2,5 €/km ---
insert into matrices (categorie, cle, libelle, valeur, unite, borne_min) values
  ('base', 'seuil_grille_km', 'Seuil grille -> formule',           180.00, 'km',         180),
  ('base', 'prix_km_au_dela', 'Prix/km au-dela de 180 km (km x 2)', 2.50,  'eur_par_km', 180);

-- --- 6.2 Saison (selon mois de date_depart) ---
-- basse: nov, jan, fev, aout (-7%) ; moyenne: dec, oct, sep (0%) ;
-- haute: mars, avr, juil (+10%) ; tres haute: mai, juin (+15%).
insert into matrices (categorie, cle, libelle, valeur, unite) values
  ('saison', 'basse',      'Saison basse (nov, jan, fév, août)',     0.93, 'pct'),
  ('saison', 'moyenne',    'Saison moyenne (déc, oct, sep)',         1.00, 'pct'),
  ('saison', 'haute',      'Saison haute (mars, avr, juil)',         1.10, 'pct'),
  ('saison', 'tres_haute', 'Saison très haute (mai, juin)',          1.15, 'pct');

-- --- 6.3 Anticipation (jours entre date_demande et date_depart) ---
-- Seuils OFFICIELS (doc v2) en jours d'écart date_demande -> date_depart.
insert into matrices (categorie, cle, libelle, valeur, unite, borne_min, borne_max) values
  ('anticipation', 'DD_PRIORITAIRE',  'Prioritaire (<= 14 j)',        1.10, 'pct', 0,   14),
  ('anticipation', 'DD_URGENT',       'Urgent (15-30 j)',             1.05, 'pct', 15,  30),
  ('anticipation', 'DD_NORMAL',       'Normal (31-90 j)',             0.95, 'pct', 31,  90),
  ('anticipation', 'DD_3MOISETPLUS',  'Plus de 90 j',                 0.90, 'pct', 91,  99999);

-- --- 6.4 Capacité (nb passagers) ---
-- >85 : multi-véhicules => cas complexe, pas de coefficient de devis auto.
insert into matrices (categorie, cle, libelle, valeur, unite, borne_min, borne_max) values
  ('capacite', 'cap_minibus', '<= 19 passagers',  0.95, 'pct', 1,  19),
  ('capacite', 'cap_standard','19-53 passagers',  1.00, 'pct', 19, 53),
  ('capacite', 'cap_grand',   '53-63 passagers',  1.15, 'pct', 53, 63),
  ('capacite', 'cap_xl',      '63-67 passagers',  1.20, 'pct', 63, 67),
  ('capacite', 'cap_double',  '67-85 passagers',  1.40, 'pct', 67, 85);

-- --- 6.5 Options : NON tarifées par les règles officielles ---
-- Les règles de cotation ne définissent pas d'options (guide, nuit chauffeur…).
-- Toute demande spéciale relève du flux manuel commercial (escalade).

-- --- 6.6 TVA & marge ---
insert into matrices (categorie, cle, libelle, valeur, unite) values
  ('tva',   'taux_standard', 'TVA transport de voyageurs', 1.10, 'pct'),  -- 10%
  ('marge', 'commerciale',   'Marge commerciale',          1.15, 'pct');  -- +15% avant TVA


-- =============================================================================
-- 7. NOTE RLS (MVP)
-- =============================================================================
-- Pour le MVP, tout l'accès aux données se fait côté serveur (route handlers /
-- server actions Next.js + Vercel Cron) avec la clé SUPABASE service_role, qui
-- bypass RLS. On NE relie PAS de session utilisateur Supabase Auth côté client.
--
-- Garde-fou recommandé : activer RLS sur chaque table SANS policy permissive,
-- de sorte qu'aucune clé anon/authenticated ne puisse lire/écrire. Seul le
-- service_role (serveur) accède aux données.
--
--   alter table entreprises       enable row level security;
--   alter table commerciaux       enable row level security;
--   alter table clients           enable row level security;
--   alter table demandes          enable row level security;
--   alter table devis             enable row level security;
--   alter table relances          enable row level security;
--   alter table attributions      enable row level security;
--   alter table statut_historique enable row level security;
--   alter table matrices          enable row level security;
--   alter table logs              enable row level security;
--
-- (Sans policy + RLS activé => deny par défaut pour anon/authenticated ;
--  service_role continue de tout voir. À durcir avec de vraies policies quand
--  l'app exposera un accès authentifié direct au client.)
-- =============================================================================
