# Nouveautés depuis le cadrage initial (V2)

Ce document recense les fonctionnalités ajoutées **au-delà du plan de build initial** (`PLAN.md`), ainsi que les **divergences assumées** par rapport aux règles du dossier de cadrage. À intégrer dans la V2 du dossier pour la soutenance.

## 1. Pilotage du temps d'attente (SLA)
L'enjeu n°1 identifié : ne pas faire attendre les prospects (historique : ~50 % des demandes traitées en > 48 h ; objectif : tout traiter le jour même).
- **SLA d'attente** sur chaque demande : ancienneté depuis la demande **et** temps passé dans la colonne actuelle (journal `statut_historique`). Seuils 24 h (objectif) / 48 h (critique), mis en valeur sur la fiche.
- **Analytics → Délai de réponse** : délai moyen et médian *demande → envoi du devis*, **% envoyés < 24 h** et **< 48 h** (mesurés sur les `envoye_at` réels). KPI renommé « Taux de gain » → **« Taux de conversion »**.

## 2. Scoring repensé et configurable
- Score = **pression SLA (24 h)** × poids + **taille du deal** × poids. Un départ imminent force le score à **100** (priorité absolue, carte en terracotta).
- Transparent (décomposition affichée sur la fiche) et **configurable** dans **Workflow** (poids, seuil SLA, plafond deal, fenêtre « urgent »), persisté dans `app_config`.
- Tri Kanban prioritaire : urgents → rappel humain demandé → score.

## 3. Pipeline Kanban
- Vue **Kanban par défaut**, filtres de statut masqués en Kanban (redondants).
- **Drag-and-drop** des leads entre colonnes.
- Badges **« Urgent »** et **« Rappel demandé »**.

## 4. Trajets multi-villes
- Géocodage **multi-points** (Nominatim, sans forçage pays) + routage **OSRM** multi-étapes : un trajet « Marseille → Berlin → Madrid » n'est plus écrasé en « Marseille → Madrid ».
- Tout trajet avec ville(s) intermédiaire(s) est traité comme un **circuit**, même si le prospect dit « aller-retour ».
- **Distance éditable** par le commercial ; « Modifier le lead » → **« Modifier la demande »**.

## 5. Éditeur de devis (modal)
- Aperçu type logiciel d'édition : **coefficients éditables** (saison, anticipation, capacité, marge) + **remise** (% ou €), preview live.
- Capacité **> 85 pax** = cas personnalisé → **coefficient manuel** mis en valeur (pas de rattachement automatique à la tranche 68-85).
- **Le prix vient toujours du serveur** : le client n'envoie que les paramètres, le serveur recalcule (règle d'or).

## 6. Signature en ligne
- Page publique **`/devis/[id]`** : le prospect consulte et **signe** le devis, ou demande une modification.
- Lien inclus dans l'email de devis (+ PDF joint). Signature → statut **Gagné**.

## 7. Conversation IA sur la fiche
- La conversation ayant généré le lead est consultable directement depuis la fiche demande (transcript repliable, partagé avec la page Conversations).

## 8. Agent conversationnel — ajustements
- **Type de prestation** : plus jamais demandé au prospect ; déduit s'il est mentionné, sinon reclassé par le commercial.
- **Dates en français** partout (« 6 novembre 2026 ») ; **heure de départ** demandée et reportée sur le devis.
- **Demande de contact humain** : si le prospect veut un conseiller, l'IA récupère son téléphone et marque la demande (badge + colonne de suivi).

## 9. Relances par email
- Template d'email de relance (ton adapté J+1 / J+3 / J+7) avec lien de signature.
- **Envoi manuel** (bouton « Envoyer la relance ») **et automatique** via **cron Vercel quotidien** (`/api/cron/relances`, protégé par `CRON_SECRET`).
- Garde-fous : pas de relance sur un deal clos (annulée), ni vers une adresse de démo factice.

## 10. Qualification automatique & colonne « Nouveau »
Clarification du flux après la conversation IA :
- **Cas simple** (qualifiable automatiquement) → l'IA passe la demande en **Qualifié** + l'attribue, puis l'appel auto la fait passer en **Contacté** (1ʳᵉ action commerciale).
- **Cas complexe** (> 85 pax, circuit, départ < 48 h, incohérent) **ou demande de rappel humain** → la demande **reste en « Nouveau »** = à trier par un humain. « Nouveau » devient donc **actionnable** : bouton **« Prendre en charge »** (→ Qualifié).
- Règle de cohérence : une conversation **terminée** implique un lead **≥ Qualifié** ; un lead « Nouveau » n'a qu'une conversation **escaladée (« à rappeler »)**. Le seed de démo respecte désormais cette règle.

---

## Divergences assumées vs dossier de cadrage
À mentionner explicitement à la soutenance.

1. **Estimation provisoire par email (cas simple).** Le dossier pose : « l'IA ne communique jamais de prix ». Décision produit pour accélérer les cas simples : un **email système** envoie une **estimation indicative, non contractuelle**, et l'IA informe le prospect qu'il va la recevoir. Le prix n'est **jamais écrit dans le chat** ; le devis ferme reste établi/communiqué par le commercial. La frontière « l'IA ne dit pas de prix dans la conversation » est donc préservée, mais on assume l'envoi d'un montant indicatif par email.

2. **Statut « Gagné » = preuve de signature.** Faute de migration DB dédiée (pas de CLI Supabase dans l'environnement), la signature est matérialisée par le passage au statut `won` + une note, sans nouvelle colonne.

3. **Authentification interne.** MVP sans auth réelle sur l'espace interne (hors périmètre prototype).
