# NeoTravel — Automatisation du cycle commercial

Prototype (Livrable 2) — automatise la chaîne **captation → qualification → tarification → devis → relances → pilotage** pour une PME d'intermédiation en transport de groupe.

## Stack (Option B)
- **Next.js** (App Router, TypeScript) — front + agent
- **Vercel AI SDK** — agent conversationnel (streaming + tool calling), modèle **Claude** via **Vercel AI Gateway**
- **Supabase** (Postgres) — CRM (entreprises, clients, demandes, devis, relances, commerciaux, statut_historique, matrices)
- **Vercel Cron** + **Resend** — relances email planifiées (pas de n8n)
- Déploiement **Vercel**

## Règle d'or
L'IA **décide et met en forme** ; le **code calcule**. Le prix vient **toujours** du tool déterministe `calculer_devis()`, jamais du LLM.

## Setup
```bash
cp .env.example .env.local   # puis renseigner les clés
npm install
npm run dev
```

> Le plan de build détaillé et les specs sont dans `docs/`.
