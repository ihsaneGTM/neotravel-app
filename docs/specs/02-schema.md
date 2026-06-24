Schema written to `/Users/ihsane/Documents/Agents/Neotravel/neotravel-app/supabase/migrations/0001_init_schema.sql`.

Le SQL DDL complet est prêt à coller dans le SQL Editor de Supabase. Contenu et choix notables:

**Structure (8 sections, ordre d'exécution sûr):** extension `pgcrypto` → 9 enums → fonction `set_updated_at()` → 10 tables → trigger de journalisation statut → index → seed matrices → note RLS.

**Enums:** `statut_demande` (new→qualified→contacted→quote_sent→negotiation→won/lost), `type_deplacement`, `type_prestation`, `type_client`, `canal_demande`, `complexite_demande` (simple/complexe/urgence/incoherent), `type_devis` (estimation/ferme), `type_relance`, `statut_relance`.

**Tables (10):** entreprises, commerciaux, clients, demandes, devis, relances, attributions, statut_historique, matrices, logs — toutes PK `uuid default gen_random_uuid()`, `created_at`/`updated_at` + trigger `updated_at` sur celles qui sont éditées.

**Points conformes au cahier des charges:**
- `demandes`: tous les champs collectés + déduits (distance_km, type_vehicule, nuitees, nuit_chauffeur, urgence, date_demande) + `valeur_panier_estimee`, `complexite`, `canal`, `commercial_id`, `client_id`.
- `clients`: `consentement_rgpd` (+ `consentement_date`) + `entreprise_id` nullable.
- `commerciaux`: `specialites type_prestation[]`, `charge_courante`, `commissions_cumulees`, `taux_commission` — l'ordre d'attribution (spécialité → commissions mini → charge) est tracé dans `attributions` avec snapshot des critères.
- `devis`: `type`, montants, `lignes jsonb`, `coefficients jsonb`, `check_ia_ok`, `pdf_url` + `masque` pour l'estimation masquée haut panier.

**Garde-fous (CHECK):** `nb_voyageurs > 0`, `date_retour >= date_depart`, aller_retour exige une date de retour, format SIRET, format email, au moins un contact client. Couvre les cas limites "0 passager" et "date incohérente".

**Trigger statut_historique:** `log_statut_demande()` capte l'INSERT initial (ancien_statut null) et chaque UPDATE de `statut` (via `after update of statut`), avec `par` lu depuis `current_setting('app.acteur')` — le code applicatif peut faire `set_config('app.acteur', 'ia', true)` avant l'update.

**Index:** statut, date_demande, date_depart, commercial_id, client_id, complexite sur demandes; demande_id partout (devis, relances, attributions, statut_historique, logs); `(statut, planifiee_pour)` pour le worker Cron des relances.

**Seed matrices:** prix_par_km 2.50, prix_minimum 350; saison (0.93/1.00/1.10/1.15); anticipation avec bornes en jours (1.10/1.05/0.95/0.90); capacité avec bornes pax (0.95/1.00/1.15/1.20/1.40, >85 exclu = complexe); options (guide 80/jour, nuit chauffeur 120/nuit, péages forfait); TVA 1.10 et marge 1.15. Les coefficients sont stockés comme facteurs multiplicatifs (1.10 = +10%) pour un lookup déterministe direct par `calculer_devis()`.

**RLS MVP:** note expliquant l'accès via service_role côté serveur, avec les `alter table ... enable row level security` recommandés (deny-par-défaut pour anon/authenticated) fournis en commentaire prêts à activer.