> **⚠️ MISE À JOUR (décision produit) :** le chat **n'affiche aucun prix ni estimation** au prospect (le devis est communiqué par le commercial après son rappel). Les composants `EstimationCard` / « fourchette indicative » décrits ci-dessous sont **caducs**. L'estimation reste interne (score panier pour l'attribution). La page **`/simulateur`** (usage interne / démo) reste le seul écran qui détaille le calcul.

I have everything I need. This is a design deliverable, not a build task, so I'll return the architecture, key components, and load-bearing extracts directly. Below is the complete frontend design for NeoTravel.

---

# NeoTravel — Design Frontend (Next.js App Router)

## Parti pris esthétique

**Direction : "éditorial transport / sérénité opérationnelle".** Pas de purple-gradient-sur-blanc. Trois surfaces, une identité, mais des densités opposées assumées :

- **Landing** = claire, aérée, chaleureuse (le prospect doit avoir confiance). Fond crème, accent bleu nuit + ambre. La conversation est la pièce maîtresse, pas un widget de coin.
- **Espace commercial** = dense, fonctionnel, deux colonnes, actions 1-clic, lisibilité maximale.
- **Dashboard direction** = sombre, "salle de contrôle", KPIs en grandes capitales, l'objectif 100% < 48h omniprésent.

Tokens partagés (dans `app/globals.css`) :

```css
:root {
  --nt-ink: #14213d;        /* bleu nuit — texte/headers */
  --nt-cream: #fbf7f0;      /* fond landing */
  --nt-amber: #f4a259;      /* accent CTA / urgence douce */
  --nt-teal: #2a9d8f;       /* succès / won */
  --nt-coral: #e76f51;      /* urgence / lost */
  --nt-slate: #64748b;      /* meta */
  --radius: 0.85rem;
}
/* Polices : Fraunces (display, serif à caractère) + Geist Sans (corps) + Geist Mono (chiffres KPI).
   PAS d'Inter ni Space Grotesk. */
```

---

## 1. Arborescence des routes & composants

```
app/
├─ layout.tsx                      # html/body, fonts (Fraunces + Geist), <Toaster/>
├─ globals.css                     # tokens CSS ci-dessus + tailwind layers
│
├─ (public)/                       # groupe SANS auth — le prospect
│  ├─ layout.tsx                   # header léger logo + "Devis par téléphone"
│  └─ page.tsx                     # LANDING conversationnelle (server shell)
│
├─ (internal)/                     # groupe AVEC auth (middleware Supabase)
│  ├─ layout.tsx                   # sidebar nav interne + garde session
│  ├─ commercial/
│  │  ├─ page.tsx                  # liste des leads attribués (file de travail)
│  │  └─ [demandeId]/page.tsx      # VUE COMMERCIALE (résumé G / actions D)
│  └─ dashboard/
│     └─ page.tsx                  # DASHBOARD direction (KPIs)
│
└─ api/
   ├─ chat/route.ts                # agent Vercel AI SDK (streamText + tools)
   ├─ devis/calculer/route.ts      # appelle calculer_devis() déterministe
   ├─ devis/[id]/pdf/route.ts      # génère le PDF
   ├─ devis/[id]/envoyer/route.ts  # Resend
   └─ cron/relances/route.ts       # Vercel Cron (CRON_SECRET)

lib/
├─ supabase/
│  ├─ client.ts                    # createBrowserClient (anon) — composants client
│  ├─ server.ts                    # createServerClient (cookies) — RSC/route handlers
│  └─ admin.ts                     # service-role — JAMAIS importé côté client
├─ pricing/calculer-devis.ts       # moteur déterministe (matrices)
├─ types.ts                        # Demande, Devis, Statut, KPI…
└─ kpis.ts                         # requêtes statut_historique → KPIs

components/
├─ ui/                             # shadcn (button, card, badge, dialog, table…)
├─ chat/
│  ├─ conversation.tsx             # ★ useChat — pièce maîtresse landing
│  ├─ message-bubble.tsx
│  ├─ recap-card.tsx               # récap structuré rendu depuis un tool
│  ├─ estimation-card.tsx          # fourchette indicative (ou masquée si complexe)
│  └─ form-fallback.tsx            # formulaire structuré en repli
├─ commercial/
│  ├─ lead-summary.tsx             # colonne gauche (résumé enrichi)
│  ├─ action-rail.tsx              # colonne droite — actions 1-clic
│  ├─ devis-lines.tsx              # détail lignes + coefficients
│  └─ status-pill.tsx
└─ dashboard/
   ├─ kpi-card.tsx                 # ★ carte KPI
   ├─ funnel.tsx                   # funnel par statut courant
   ├─ sla-gauge.tsx                # jauge % traité < 48h vs objectif 100%
   └─ urgent-queue.tsx             # demandes urgentes + relances en attente
```

**Séparation des clients Supabase (règle de sécurité load-bearing) :**

- `lib/supabase/client.ts` → `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` : utilisé uniquement dans les composants `"use client"` (lecture soumise au RLS).
- `lib/supabase/server.ts` → `createServerClient` avec cookies, dans les RSC et route handlers (session utilisateur interne).
- `lib/supabase/admin.ts` → `createClient(url, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })` : **uniquement** dans les route handlers serveur (création de fiche CRM après conversation, écriture `statut_historique`, cron relances). Fichier marqué `import "server-only"` en tête pour interdire tout import client.

---

## Gestion du state

| Surface | State | Outil |
|---|---|---|
| Landing | flux conversation, messages, tool-results | `useChat` (`@ai-sdk/react`) — source unique |
| Landing | formulaire repli | `react-hook-form` + `zod` (mêmes champs que le JSON schema agent) |
| Commercial | données lead | RSC server-fetch (Supabase server) → props ; mutations via Server Actions + `revalidatePath` |
| Commercial | dialogues (PDF/envoi) | state local `useState` |
| Dashboard | KPIs | RSC server-fetch (`lib/kpis.ts`) ; rafraîchi via `revalidate` + bouton manuel (Cron gratuit limité) |

Pas de store global type Redux : RSC pour les données serveur, `useChat` pour la conversation, `useState`/RHF pour l'éphémère.

---

## 2. Composant chat — pièce maîtresse de la landing

L'idée clé pour respecter le wireframe ("conversation au centre, pas un widget en coin") : la conversation occupe une **colonne centrale large**, le formulaire est un `<details>`/accordéon **en dessous** (repli), et le bouton téléphone est **sticky en header**. Les `tool calls` de l'agent (`presenter_recap`, `presenter_estimation`) sont rendus comme des **cartes riches inline**, pas du texte.

`components/chat/conversation.tsx` :

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { MessageBubble } from "./message-bubble";
import { RecapCard } from "./recap-card";
import { EstimationCard } from "./estimation-card";
import { FormFallback } from "./form-fallback";
import { Button } from "@/components/ui/button";
import { Phone, Send } from "lucide-react";

export function Conversation() {
  const { messages, sendMessage, status } = useChat({ api: "/api/chat" });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="mx-auto w-full max-w-3xl">
      {/* En-tête éditorial — la conversation EST la page */}
      <header className="mb-8 text-center">
        <h1 className="font-display text-5xl leading-[1.05] text-[var(--nt-ink)]">
          Votre car, votre groupe.<br />
          <span className="text-[var(--nt-amber)]">Dites-nous tout.</span>
        </h1>
        <p className="mt-3 text-[var(--nt-slate)]">
          Décrivez votre trajet en quelques mots — on s'occupe du reste,
          un conseiller vous rappelle dans la journée.
        </p>
      </header>

      {/* Fil de conversation — surface centrale, pas un widget */}
      <div className="rounded-[var(--radius)] border border-[var(--nt-ink)]/10 bg-white/70 shadow-[0_20px_60px_-30px_rgba(20,33,61,.45)] backdrop-blur">
        <div className="flex max-h-[58vh] min-h-[42vh] flex-col gap-4 overflow-y-auto p-6">
          {messages.length === 0 && <Starters onPick={(t) => sendMessage({ text: t })} />}

          {messages.map((m) => (
            <div key={m.id} className="space-y-3">
              {m.parts.map((part, i) => {
                if (part.type === "text")
                  return <MessageBubble key={i} role={m.role} text={part.text} />;

                // Tool results → cartes riches inline (le CODE calcule, l'IA met en forme)
                if (part.type === "tool-presenter_recap" && part.state === "output-available")
                  return <RecapCard key={i} data={part.output} />;

                if (part.type === "tool-presenter_estimation" && part.state === "output-available")
                  return <EstimationCard key={i} data={part.output} />; // gère le cas "masqué"

                return null;
              })}
            </div>
          ))}

          {status === "submitted" && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        {/* Barre de saisie */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("msg") as HTMLInputElement;
            if (input.value.trim()) {
              sendMessage({ text: input.value });
              input.value = "";
            }
          }}
          className="flex items-center gap-2 border-t border-[var(--nt-ink)]/10 p-3"
        >
          <input
            name="msg"
            autoComplete="off"
            placeholder="Ex. : 45 personnes, Bordeaux → Arcachon le 12 juillet, aller-retour…"
            className="flex-1 bg-transparent px-3 py-2 text-[var(--nt-ink)] outline-none placeholder:text-[var(--nt-slate)]/60"
          />
          <Button type="submit" size="icon" disabled={status !== "ready"}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>

      {/* Téléphone TOUJOURS visible (alternative au chat) */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--nt-slate)]">
        <Phone className="size-4" />
        Vous préférez parler&nbsp;?
        <a href="tel:+33500000000" className="font-medium text-[var(--nt-ink)] underline">
          Devis par téléphone
        </a>
      </div>

      {/* Formulaire structuré EN REPLI (accordéon, jamais imposé) */}
      <details className="group mt-6 rounded-[var(--radius)] border border-dashed border-[var(--nt-ink)]/20 p-4">
        <summary className="cursor-pointer list-none font-medium text-[var(--nt-ink)]">
          Vous préférez un formulaire&nbsp;? <span className="text-[var(--nt-slate)]">(cliquez)</span>
        </summary>
        <div className="mt-4">
          <FormFallback />
        </div>
      </details>
    </section>
  );
}
```

Notes d'intégration importantes :
- `useChat` parle à `/api/chat` qui fait `streamText({ model: gateway("anthropic/claude-sonnet-4.5"), tools })`. Les tools `presenter_recap` / `presenter_estimation` ne calculent rien eux-mêmes : `presenter_estimation` appelle `calculer_devis()` côté serveur et renvoie la fourchette **ou** `{ masque: true, raison: "complexe" }` → la carte affiche alors "Un conseiller vous rappelle" au lieu d'un prix (cas complexe / haut panier).
- La création de la fiche CRM (Entreprise/Client/Demande) se fait via un tool serveur `creer_fiche` utilisant `lib/supabase/admin.ts` **après** capture du contact + consentement RGPD — jamais depuis le navigateur.

`EstimationCard` (le cas masqué est load-bearing — c'est la matrice des cas) :

```tsx
export function EstimationCard({ data }: { data: EstimationOutput }) {
  if (data.masque) {
    return (
      <div className="rounded-[var(--radius)] border-l-4 border-[var(--nt-amber)] bg-[var(--nt-amber)]/10 p-4">
        <p className="font-medium text-[var(--nt-ink)]">
          Votre demande mérite une étude sur mesure.
        </p>
        <p className="mt-1 text-sm text-[var(--nt-slate)]">
          Un conseiller spécialisé vous rappelle dans la journée pour affiner le devis.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius)] border border-[var(--nt-teal)]/30 bg-[var(--nt-teal)]/5 p-4">
      <span className="text-xs uppercase tracking-wide text-[var(--nt-slate)]">Estimation indicative</span>
      <p className="font-display text-3xl text-[var(--nt-ink)]">
        {data.fourchette_min}&nbsp;–&nbsp;{data.fourchette_max}&nbsp;€ <span className="text-base">TTC</span>
      </p>
      <p className="mt-1 text-xs text-[var(--nt-slate)]">
        Estimation non contractuelle — confirmée à l'appel.
      </p>
    </div>
  );
}
```

---

## 3. Vue commerciale — résumé enrichi (G) / actions 1-clic (D)

`app/(internal)/commercial/[demandeId]/page.tsx` (RSC, fetch serveur) :

```tsx
import { getServerSupabase } from "@/lib/supabase/server";
import { LeadSummary } from "@/components/commercial/lead-summary";
import { ActionRail } from "@/components/commercial/action-rail";
import { DevisLines } from "@/components/commercial/devis-lines";

export default async function Page({ params }: { params: Promise<{ demandeId: string }> }) {
  const { demandeId } = await params;
  const sb = await getServerSupabase();

  const { data: demande } = await sb
    .from("demandes")
    .select(`*, clients(*, entreprises(*)), devis(*), appels(*)`)
    .eq("id", demandeId)
    .single();

  const dernierDevis = demande?.devis?.at(-1) ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* GAUCHE — résumé enrichi du lead */}
      <LeadSummary demande={demande} />

      {/* DROITE — actions 1-clic + détail du devis */}
      <div className="space-y-6">
        <ActionRail demandeId={demandeId} devis={dernierDevis} statut={demande.statut} />
        {dernierDevis && <DevisLines devis={dernierDevis} />}
      </div>
    </div>
  );
}
```

`components/commercial/action-rail.tsx` — les 3 actions de la consigne (Calculer / PDF / Envoyer), chaînées sur l'état du devis, avec le check IA anti-erreur avant envoi :

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Calculator, FileText, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function ActionRail({ demandeId, devis, statut }: ActionRailProps) {
  const [pending, start] = useTransition();
  const [check, setCheck] = useState<CheckResult | null>(null);

  const calculer = () =>
    start(async () => {
      const r = await fetch(`/api/devis/calculer`, {
        method: "POST",
        body: JSON.stringify({ demandeId, mode: "ferme" }),
      });
      r.ok ? toast.success("Devis calculé") : toast.error("Erreur de calcul");
    });

  const envoyer = () =>
    start(async () => {
      // Check IA anti-erreur AVANT envoi (HITL)
      const c = await fetch(`/api/devis/${devis!.id}/check`).then((r) => r.json());
      setCheck(c);
      if (!c.ok) return toast.warning("Le check IA a relevé des points à vérifier");
      await fetch(`/api/devis/${devis!.id}/envoyer`, { method: "POST" });
      toast.success("Devis envoyé — relances programmées");
    });

  return (
    <div className="rounded-[var(--radius)] border bg-card p-5">
      <h2 className="font-display text-xl">Actions</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Le prix est calculé par le moteur, pas par l'IA. Vous validez avant envoi.
      </p>

      <div className="grid gap-3">
        <Button onClick={calculer} disabled={pending} className="justify-start" size="lg">
          <Calculator className="size-4" /> Calculer le devis (tarif ferme)
        </Button>

        <Button
          variant="secondary"
          disabled={!devis || pending}
          className="justify-start"
          size="lg"
          asChild
        >
          <a href={`/api/devis/${devis?.id}/pdf`} target="_blank">
            <FileText className="size-4" /> Générer le PDF
          </a>
        </Button>

        <Button
          variant="default"
          onClick={envoyer}
          disabled={!devis || pending}
          className="justify-start bg-[var(--nt-teal)] hover:bg-[var(--nt-teal)]/90"
          size="lg"
        >
          <Send className="size-4" /> Vérifier (IA) & envoyer
        </Button>
      </div>

      {check && (
        <div className="mt-4 flex gap-2 rounded-lg border-l-4 border-[var(--nt-amber)] bg-amber-50 p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-1">
            {check.alertes.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

`DevisLines` affiche le **détail des lignes + coefficients** (exigence explicite), directement issu de la sortie de `calculer_devis()` (`lignes[]`, `coefficients[]`) — un tableau lignes (base, distance, options) puis une liste de coefficients appliqués (saison +10%, anticipation −5%, capacité +15%…) avec sous-total HT, TVA 10%, marge +15%, TTC. C'est purement de l'affichage : aucune valeur recalculée côté client.

---

## 4. Dashboard direction — carte KPI

`components/dashboard/kpi-card.tsx` (chiffres en mono, ton "salle de contrôle") :

```tsx
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;        // déjà formaté ("96 %", "31 h", "18 %")
  target?: string;      // ex. "objectif 100 %"
  trend?: { dir: "up" | "down"; pct: string };
  tone?: "default" | "good" | "warn" | "bad";
};

const tones = {
  default: "border-white/10",
  good: "border-[var(--nt-teal)]/40 shadow-[0_0_0_1px_var(--nt-teal)]/20",
  warn: "border-[var(--nt-amber)]/50",
  bad: "border-[var(--nt-coral)]/50",
};

export function KpiCard({ label, value, target, trend, tone = "default" }: Props) {
  return (
    <div className={cn("rounded-[var(--radius)] border bg-[#101826] p-5", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
        {trend && (
          <span className={cn("text-xs font-medium",
            trend.dir === "up" ? "text-[var(--nt-teal)]" : "text-[var(--nt-coral)]")}>
            {trend.dir === "up" ? "▲" : "▼"} {trend.pct}
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-4xl tabular-nums text-white">{value}</p>
      {target && <p className="mt-1 text-xs text-slate-500">{target}</p>}
    </div>
  );
}
```

Le dashboard (RSC) consomme `lib/kpis.ts`, qui lit **`statut_historique`** (source de vérité, 1 ligne par transition) :

- **SLA < 48h** (`SlaGauge`) : part des demandes dont `new → contacted` s'est faite en < 48h, vs objectif 100% (jauge ambre→teal, le KPI vedette).
- **Funnel** (`Funnel`) : comptage par **statut courant** (new / qualified / contacted / quote_sent / negotiation / won / lost).
- **Délais moyens** : lead→contact et lead→devis (diff de timestamps entre transitions).
- **Taux de conversion** : won / (won + lost).
- **Relances en attente** + **demandes urgentes** (`UrgentQueue`) : liste actionnable, lien direct vers la vue commerciale.

`lib/kpis.ts` — extrait de la requête SLA (la logique métier load-bearing) :

```ts
export async function getSla48h(sb: SupabaseClient) {
  // Première transition vers "contacted" par demande, comparée à la création
  const { data } = await sb.rpc("delai_lead_to_contact"); // vue/RPC sur statut_historique
  const total = data.length;
  const dans48h = data.filter((d) => d.delai_heures <= 48).length;
  return { total, dans48h, pct: total ? Math.round((dans48h / total) * 100) : 0, objectif: 100 };
}
```

---

## Synthèse des décisions

- **Landing** : `useChat` au centre dans une colonne large, formulaire en `<details>` repli, téléphone sticky — conforme au wireframe (conversation = page, pas widget de coin). Les tool-results rendus en cartes (`RecapCard`, `EstimationCard`) matérialisent "l'IA met en forme, le code calcule".
- **Cas complexe / urgence** : `EstimationCard` à variante masquée → pas de prix, escalade — directement la matrice des cas.
- **Commercial** : layout 2 colonnes (résumé enrichi G / `ActionRail` D), 3 actions chaînées Calculer→PDF→Vérifier&Envoyer, check IA HITL avant envoi, détail lignes/coefficients depuis `calculer_devis()`.
- **Dashboard** : thème sombre, KPIs mono, tous dérivés de `statut_historique`, KPI vedette = SLA 48h vs objectif 100%.
- **Supabase** : 3 clients strictement séparés (`client` anon navigateur / `server` cookies RSC / `admin` service-role `server-only`), mutations via Server Actions + `revalidatePath`.
- **Polices** : Fraunces (display) + Geist Sans/Mono — délibérément hors des défauts génériques (pas d'Inter, pas de Space Grotesk).

Fichiers de référence consultés : `/Users/ihsane/Documents/Agents/Neotravel/neotravel-app/README.md`, `.env.example`, `/Users/ihsane/Documents/Agents/Neotravel/L1-cadrage-J2-metier.md`, et les mémoires `projet-neotravel.md` / `neotravel-pricing-matrices.md`.

Note sur le modèle : `.env.example` fixe `LLM_MODEL=anthropic/claude-sonnet-4.5` via Vercel AI Gateway — c'est l'id gateway à utiliser dans `/api/chat` (`gateway("anthropic/claude-sonnet-4.5")`). Le projet n'a pas encore de `package.json` ni de dossier `app/` ; les chemins ci-dessus sont la cible à créer.