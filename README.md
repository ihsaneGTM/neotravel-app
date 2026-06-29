# NeoTravel — Automatisation du cycle commercial

Prototype qui automatise la chaîne **captation → qualification → tarification → devis → signature → relances → pilotage** pour une PME d'intermédiation en transport de groupe en autocar.

## Stack
- **Next.js** (App Router, TypeScript, Tailwind v4) — front + agent
- **Vercel AI SDK** — agent conversationnel (streaming + tool calling), modèle **Claude** via **Vercel AI Gateway**
- **Supabase** (Postgres) — CRM (clients, demandes, devis, relances, commerciaux, conversations, statut_historique, app_config)
- **Resend** + **Vercel Cron** — emails transactionnels (devis, estimation, relances planifiées) — pas de n8n
- **OSRM / Nominatim** — distances routières multi-villes
- Déploiement **Vercel**

## Règle d'or
L'IA **décide et met en forme** ; le **code calcule**. Le prix vient **toujours** du moteur déterministe `calculerDevis()` (serveur), jamais du LLM. Le client n'envoie que des *paramètres* ; le serveur recalcule.

## Setup
```bash
cp .env.example .env.local   # puis renseigner les clés (voir ci-dessous)
npm install
npm run dev
```

### Variables d'environnement
| Variable | Rôle |
|---|---|
| `AI_GATEWAY_API_KEY`, `LLM_MODEL` | Agent Claude via Vercel AI Gateway |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase serveur (bypass RLS) — **jamais exposé au client** |
| `RESEND_API_KEY` | Envoi d'emails (devis, estimation, relances) |
| `EMAIL_FROM` | Expéditeur — **domaine vérifié dans Resend** requis pour écrire à n'importe quel prospect |
| `CRON_SECRET` | Protège `/api/cron/relances` — chaîne aléatoire, **même valeur en local et sur Vercel** |
| `NEXT_PUBLIC_PROD_URL` | URL prod (liens de signature dans les emails) |

> Tous les secrets restent dans `.env.local` (gitignoré) et dans les *Environment Variables* Vercel. Rien n'est committé.

## Email & relances
- **Devis** : envoyé depuis la fiche demande (PDF joint + lien de signature public). À l'envoi, le statut passe à *Devis envoyé* et 3 relances sont planifiées (cadence configurable dans **Workflow → Relances**, défaut J+1 / J+3 / J+7).
- **Estimation provisoire** : pour les demandes *simples*, un email indicatif (non contractuel) est envoyé automatiquement en fin de conversation ; l'IA en informe le prospect.
- **Relances** : envoyées par email soit **manuellement** (bouton « Envoyer la relance » dans le centre de relances), soit **automatiquement** par le **cron quotidien** (`vercel.json` → `/api/cron/relances`, 8h UTC). Un deal gagné/perdu annule ses relances ; les adresses de démo factices ne sont jamais contactées.

### Activer le cron sur Vercel
1. Génère un secret : `openssl rand -hex 32`.
2. Mets-le dans `.env.local` **et** dans Vercel → Settings → Environment Variables (`CRON_SECRET`, Production), puis redéploie.
3. Vercel appelle `/api/cron/relances` chaque jour avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## Données de démo
```bash
node --env-file=.env.local scripts/seed-demo.mjs    # ~60 leads + conversations + devis + relances (marqués @demo.neotravel.test)
node --env-file=.env.local scripts/purge-demo.mjs   # purge réversible (n'enlève que la démo)
```

## Documentation
- `docs/PLAN.md` — plan de build et architecture
- `docs/NOUVEAUTES.md` — nouveautés depuis le cadrage initial (V2) et divergences assumées
- `docs/specs/` — specs détaillées (infra, schéma, pricing, agent, frontend)
