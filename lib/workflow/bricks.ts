import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUTS, type Statut } from "@/lib/ui/statuts";
import { getPipelineMap, periodWindow, type Period } from "@/lib/dashboard/office-data";
import { MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { MATRICES_DEFAUT } from "@/lib/pricing/calculer-devis";
import { SCORING } from "@/lib/pipeline/scoring";
import { resendConfigured } from "@/lib/email/resend";
import { studioConfigured } from "@/lib/studio/config";
import { getRelancesCadence } from "@/lib/config/app-config";

// ── Types sérialisables (passés au composant client) ────────────────────────
export type IconName = "chat" | "gauge" | "users" | "phone" | "file" | "bell" | "chart";
export type Section =
  | { type: "note"; text: string }
  | { type: "kv"; title?: string; rows: { k: string; v: string }[] }
  | { type: "table"; title?: string; columns: string[]; rows: string[][] }
  | { type: "code"; title?: string; text: string }
  | { type: "cadence"; title?: string; offsets: number[] };

export interface SubPath {
  key: string;
  label: string;
  tint: string;
  count: number;
  note: string;
}

export interface Brick {
  key: string;
  title: string;
  icon: IconName;
  tint: string;
  kind: "ia" | "code" | "integration" | "data";
  x: number;
  y: number;
  live: boolean;
  statusLabel: string;
  metrics: { label: string; value: string | number; now?: boolean }[];
  sections: Section[];
  links: { label: string; href: string }[];
  integration?: { providers: string[]; status: "connecte" | "a_connecter"; via: string };
  /** Branches de sortie visibles sur le canvas (ex: Conversation IA → 3 chemins). */
  subpaths?: SubPath[];
  /** Compteurs live (badges « ici » / « période ») — injectés par getWorkflow. */
  badges?: BrickLive;
}

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// ── Funnel TEMPS RÉEL par brique ────────────────────────────────────────────
// Chaque brique expose 2 chiffres : `now` (actuellement à cette étape, live) et
// `period` (volume passé par l'étape sur la période choisie), pour les badges.
export interface BrickLive {
  now: number;
  nowLabel: string;
  period: number;
  periodLabel: string;
  live: boolean;
  statusLabel: string;
}
export type WorkflowLive = Record<string, BrickLive>;

const STATUT_ORDER: Record<Statut, number> = { new: 0, qualified: 1, contacted: 2, quote_sent: 3, negotiation: 4, won: 5, lost: 6 };
const CONV_ACTIVE_MS = 5 * 60 * 1000; // conversation active si dernier message < 5 min

/**
 * Compteurs live du pipeline. `now` = snapshot (statut courant / conversations actives) ;
 * `period` = volume de leads ayant atteint l'étape sur la période (created_at dans la fenêtre).
 */
export async function getWorkflowLive(sb: SupabaseClient, period: Period = "today"): Promise<WorkflowLive> {
  const now = Date.now();
  const win = periodWindow(period);
  const inWin = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= win.from && t < win.to;
  };

  const [convRes, demRes, relRes] = await Promise.all([
    sb.from("conversations").select("statut, updated_at, created_at"),
    sb.from("demandes").select("id, statut, commercial_id, created_at"),
    sb.from("relances").select("statut, planifiee_pour, created_at"),
  ]);

  // Conversations : actives (< 5 min) en snapshot ; lancées sur la période
  const convs = (convRes.data ?? []) as { statut: string; updated_at: string; created_at: string }[];
  const convActive = convs.filter((c) => c.statut === "en_cours" && now - new Date(c.updated_at).getTime() < CONV_ACTIVE_MS).length;
  const convPeriod = convs.filter((c) => inWin(c.created_at)).length;

  // Demandes : statut courant (snapshot) + sous-ensemble période
  const dem = (demRes.data ?? []) as { id: string; statut: Statut; commercial_id: string | null; created_at: string }[];
  const cur = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  let attributed = 0;
  for (const d of dem) {
    if (cur[d.statut] != null) cur[d.statut]++;
    if (d.commercial_id) attributed++;
  }
  const demInPeriod = dem.filter((d) => inWin(d.created_at));
  // « parcouru jusqu'à » selon le statut courant (lost compté comme ayant atteint « qualifié »)
  const effOrder = (s: Statut) => (s === "lost" ? STATUT_ORDER.qualified : STATUT_ORDER[s]);
  const periodReached = (s: Statut) => demInPeriod.filter((d) => effOrder(d.statut) >= STATUT_ORDER[s]).length;

  // Relances
  const rel = (relRes.data ?? []) as { statut: string; planifiee_pour: string | null }[];
  const pending = rel.filter((r) => r.statut === "planifiee");
  const overdue = pending.filter((r) => r.planifiee_pour && new Date(r.planifiee_pour).getTime() < now).length;

  const won = cur.won;
  const conv = won + cur.lost === 0 ? null : Math.round((won / (won + cur.lost)) * 100);

  return {
    chat: { now: convActive, nowLabel: "en ligne", period: convPeriod, periodLabel: "lancées", live: convActive > 0 || convPeriod > 0, statusLabel: convActive > 0 ? `${convActive} en ligne` : "LIVE" },
    qualif: { now: cur.new, nowLabel: "à qualifier", period: demInPeriod.length, periodLabel: "leads", live: dem.length > 0, statusLabel: "LIVE" },
    attrib: { now: cur.qualified, nowLabel: "en attente", period: periodReached("qualified"), periodLabel: "qualifiés", live: attributed > 0, statusLabel: attributed > 0 ? "LIVE" : "PRÊT" },
    appel: { now: cur.contacted, nowLabel: "à cette étape", period: periodReached("contacted"), periodLabel: "contactés", live: cur.contacted > 0, statusLabel: cur.contacted > 0 ? "LIVE" : "À CONNECTER" },
    devis: { now: cur.quote_sent, nowLabel: "à cette étape", period: periodReached("quote_sent"), periodLabel: "devis", live: cur.quote_sent > 0, statusLabel: cur.quote_sent > 0 ? "LIVE" : "PRÊT" },
    relances: { now: pending.length, nowLabel: "en attente", period: overdue, periodLabel: "en retard", live: pending.length > 0, statusLabel: pending.length > 0 ? "LIVE" : "PRÊT" },
    pilotage: { now: won, nowLabel: "gagnés", period: periodReached("won"), periodLabel: "gagnés", live: won > 0 || conv != null, statusLabel: conv == null ? "LIVE" : `${conv}% conv.` },
  };
}
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export async function getWorkflow(sb: SupabaseClient, period: Period = "today"): Promise<Brick[]> {
  const map = await getPipelineMap(sb, MODELS.agent);
  const [{ count: convCount }, { count: convFlag }, { data: compData }, { data: appelsData }, { data: commsData }] = await Promise.all([
    sb.from("conversations").select("id", { count: "exact", head: true }),
    sb.from("conversations").select("id", { count: "exact", head: true }).eq("statut", "a_rappeler"),
    sb.from("demandes").select("complexite").not("complexite", "is", null),
    sb.from("appels").select("duree_sec"),
    sb.from("commerciaux").select("nom, specialites, commissions_cumulees, charge_courante").order("commissions_cumulees", { ascending: true }),
  ]);
  const comms = (commsData ?? []) as { nom: string; specialites: string[] | null; commissions_cumulees: number; charge_courante: number }[];

  // Complexité : distribution des chemins de sortie de la conversation IA
  const compRows = (compData ?? []) as { complexite: string }[];
  const compCount = compRows.reduce((acc, d) => { acc[d.complexite] = (acc[d.complexite] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const appelsCount = (appelsData ?? []).length;
  const durées = (appelsData ?? []).map((a) => (a as { duree_sec: number | null }).duree_sec).filter((d): d is number => d != null);
  const avgDuree = durées.length > 0 ? Math.round(durées.reduce((a, b) => a + b, 0) / durées.length) : null;
  const fmtDuree = (s: number) => `${Math.floor(s / 60)}min ${s % 60}s`;
  const resend = resendConfigured();
  const studio = studioConfigured().ok;
  const cadence = await getRelancesCadence(sb);
  const M = MATRICES_DEFAUT;
  const live = await getWorkflowLive(sb, period); // badges live « ici » / « période » par brique

  // Coefficient saison condensé (regroupe les mois par coeff).
  const saisonRows = Object.entries(M.saison).map(([mois, s]) => [MOIS[Number(mois) - 1], `${s.libelle}`, `×${s.coeff}`]);
  const anticipationRows = M.anticipation.map((a) => [a.libelle, `×${a.coeff}`]);
  const capaciteRows = M.capacite.map((c) => [c.libelle, `×${c.coeff}`, c.type_vehicule.replace(/_/g, " ")]);

  const bricks: Brick[] = [
    {
      key: "chat",
      title: "Conversation IA",
      icon: "chat",
      tint: "#2c3a1b",
      kind: "ia",
      x: 40,
      y: 70,
      live: map.captation.total > 0 || (convCount ?? 0) > 0,
      statusLabel: (convCount ?? 0) > 0 ? "LIVE" : "PRÊT",
      metrics: [
        { label: "Conversations", value: convCount ?? 0 },
        { label: "Leads créés", value: map.captation.total },
      ],
      subpaths: [
        { key: "simple", label: "Standard", tint: "#2c6e2f", count: compCount["simple"] ?? 0, note: "Parcours nominal — devis estimation + attribution auto" },
        { key: "complexe", label: "Complexe", tint: "#b4452f", count: compCount["complexe"] ?? 0, note: "Escalade commerciale — circuit multi-étapes, PMR, >85 passagers" },
        { key: "urgence", label: "Urgent", tint: "#c2a02e", count: compCount["urgence"] ?? 0, note: "Départ < 48 h — notification commerciale prioritaire" },
        { key: "incoherent", label: "Incohérent", tint: "#6f7163", count: compCount["incoherent"] ?? 0, note: "Données invalides — boucle de correction par l'agent" },
      ],
      sections: [
        { type: "note", text: "Point d'entrée. L'agent qualifie le besoin, capte le contact (email obligatoire) et crée le lead. Il ne communique jamais de prix." },
        {
          type: "kv",
          title: "Paramètres",
          rows: [
            { k: "Modèle", v: MODELS.agent },
            { k: "Outils exposés", v: "enregistrer_demande" },
            { k: "UI interactive", v: "QCM + formulaire de contact" },
            { k: "Garde-fous", v: "anti prompt-injection · aucun prix au lead" },
            { k: "À rappeler", v: `${convFlag ?? 0} conversation(s)` },
          ],
        },
        { type: "code", title: "Prompt système — lib/ai/prompts.ts", text: SYSTEM_PROMPT },
      ],
      links: [
        { label: "Voir les conversations", href: "/conversations" },
        ...(studio ? [{ label: "Modifier le prompt (Studio)", href: "/studio" }] : []),
      ],
      integration: { providers: ["Vercel AI Gateway"], status: "connecte", via: "api" },
    },
    {
      key: "qualif",
      title: "Qualification & scoring",
      icon: "gauge",
      tint: "#4a6a1f",
      kind: "code",
      x: 360,
      y: 220,
      live: map.qualification.progresses > 0,
      statusLabel: map.qualification.progresses > 0 ? "LIVE" : "PRÊT",
      metrics: [
        { label: "Leads avancés", value: map.qualification.progresses },
        { label: "Score moyen", value: map.qualification.avg_score },
      ],
      sections: [
        { type: "note", text: "Chaque lead passe par la matrice de complexité (routage) puis un scoring multi-facteurs (priorité)." },
        {
          type: "table",
          title: "Matrice de complexité — lib/pipeline/complexite.ts",
          columns: ["Cas", "Déclencheur", "Action"],
          rows: [
            ["Incohérent", "date passée · retour < départ · 0 voyageur", "correction demandée"],
            ["Complexe", "circuit · étapes · > 85 passagers", "escalade commerciale (flux manuel)"],
            ["Urgence", "départ < 48 h", "notification commerciale, pas de devis auto"],
            ["Simple", "aucun des cas ci-dessus", "parcours nominal + estimation interne"],
          ],
        },
        {
          type: "note",
          text: `Score = urgence d'action commerciale (qui traiter en premier). Départ ≤ ${SCORING.urgentDepartJours} j ⇒ « Urgent » : score forcé à 100 (priorité absolue). Sinon : pondération de la pression délai et de la taille du deal.`,
        },
        {
          type: "table",
          title: "Scoring — lib/pipeline/scoring.ts",
          columns: ["Critère", "Définition", "Poids"],
          rows: [
            ["Pression délai (SLA)", `chrono demande → devis, cible ${SCORING.slaTargetH} h (≈100 à l'approche, 100 au-delà ; nul une fois le devis envoyé)`, `${Math.round(SCORING.poids.sla * 100)} %`],
            ["Taille du deal", `panier ÷ ${SCORING.dealCapEur.toLocaleString("fr-FR")} € (plafonné à 100)`, `${Math.round(SCORING.poids.deal * 100)} %`],
            ["Urgent (départ imminent)", `départ ≤ ${SCORING.urgentDepartJours} j → score = 100, priorité absolue`, "override"],
          ],
        },
      ],
      links: studio ? [{ label: "Ajuster le scoring (Studio)", href: "/studio" }] : [],
    },
    {
      key: "attrib",
      title: "Attribution / CRM",
      icon: "users",
      tint: "#6b8f2a",
      kind: "code",
      x: 680,
      y: 70,
      live: map.attribution.attribues > 0,
      statusLabel: map.attribution.attribues > 0 ? "LIVE" : "PRÊT",
      metrics: [
        { label: "Attribués", value: map.attribution.attribues },
        { label: "Commerciaux", value: map.attribution.commerciaux },
      ],
      sections: [
        { type: "note", text: "À l'enregistrement, le lead est attribué automatiquement avec un résumé enrichi pour le commercial." },
        {
          type: "kv",
          title: "Règle d'attribution — lib/pipeline/attribution.ts",
          rows: [
            { k: "1.", v: "filtrer par spécialité (type de prestation)" },
            { k: "2.", v: "commissions cumulées les plus faibles (équité)" },
            { k: "3.", v: "départage par charge courante" },
          ],
        },
        {
          type: "table",
          title: "Commerciaux",
          columns: ["Nom", "Spécialités", "Commissions", "Charge"],
          rows: comms.map((c) => [c.nom, (c.specialites ?? []).join(", ") || "—", eur(Number(c.commissions_cumulees) || 0), String(c.charge_courante)]),
        },
      ],
      links: [{ label: "Ouvrir le CRM", href: "/leads" }],
    },
    {
      key: "appel",
      title: "Appel commercial",
      icon: "phone",
      tint: "#c2a02e",
      kind: "integration",
      x: 1000,
      y: 220,
      live: (appelsCount ?? 0) > 0,
      statusLabel: (appelsCount ?? 0) > 0 ? "LIVE" : "À CONNECTER",
      metrics: [
        { label: "Appels loggés", value: appelsCount },
        { label: "Durée moy.", value: avgDuree != null ? fmtDuree(avgDuree) : "—" },
      ],
      sections: [
        { type: "note", text: "Le commercial rappelle le prospect. L'appel est enregistré par la téléphonie ; un webhook le journalise dans le CRM et fait passer le lead de « Qualifié » à « Contacté » automatiquement." },
        { type: "note", text: "⚠️ Mode actuel : SIMULATION (démo). Dès qu'un lead passe en « Qualifié », une retranscription d'appel est générée automatiquement (clé Vercel AI Gateway), puis le lead passe en « Contacté ». Le branchement réel Aircall/Ringover remplacera la simulation." },
        {
          type: "kv",
          title: "Intégration (webhook entrant)",
          rows: [
            { k: "Fournisseurs", v: "Aircall · Ringover" },
            { k: "Mécanisme", v: "Webhook → table appels" },
            { k: "Effet", v: "statut Qualifié → Contacté (auto)" },
            { k: "Endpoint réel", v: "/api/webhooks/appel (à connecter)" },
            { k: "Mode actuel", v: "Simulation (démo) via /api/appel/simuler" },
          ],
        },
      ],
      links: [],
      integration: { providers: ["Aircall", "Ringover"], status: "a_connecter", via: "webhook" },
    },
    {
      key: "devis",
      title: "Devis",
      icon: "file",
      tint: "#a8902a",
      kind: "code",
      x: 1320,
      y: 70,
      live: map.devis.count > 0,
      statusLabel: map.devis.count > 0 ? "LIVE" : "PRÊT",
      metrics: [
        { label: "Devis", value: map.devis.count },
        { label: "Pipeline", value: eur(map.devis.pipeline) },
      ],
      sections: [
        { type: "note", text: "Moteur déterministe calculer_devis(). Estimation interne (score panier) puis devis ferme envoyé par le commercial, avec preuve (Resend)." },
        {
          type: "kv",
          title: "Paramètres globaux — lib/pricing/calculer-devis.ts",
          rows: [
            { k: "Marge", v: `+${Math.round(M.marge * 100)} %` },
            { k: "TVA", v: `${Math.round(M.tva * 100)} %` },
            { k: "Seuil grille", v: `${M.seuil_grille_km} km` },
            { k: "Au-delà", v: `(km × 2) × ${M.prix_km_au_dela} €/km` },
          ],
        },
        { type: "table", title: "Coefficient saison", columns: ["Mois", "Saison", "Coeff"], rows: saisonRows },
        { type: "table", title: "Anticipation", columns: ["Palier", "Coeff"], rows: anticipationRows },
        { type: "table", title: "Capacité", columns: ["Tranche", "Coeff", "Véhicule"], rows: capaciteRows },
      ],
      links: [
        { label: "Ouvrir le simulateur", href: "/simulateur" },
        ...(studio ? [{ label: "Ajuster la grille (Studio)", href: "/studio" }] : []),
      ],
      integration: { providers: ["Resend"], status: resend ? "connecte" : "a_connecter", via: "api" },
    },
    {
      key: "relances",
      title: "Relances",
      icon: "bell",
      tint: "#b4452f",
      kind: "integration",
      x: 1640,
      y: 220,
      live: map.relances.pending > 0,
      statusLabel: map.relances.pending > 0 ? "LIVE" : resend ? "PRÊT" : "À CONNECTER",
      metrics: [
        { label: "En attente", value: map.relances.pending },
        { label: "En retard", value: map.relances.overdue },
      ],
      sections: [
        { type: "note", text: "Relances email automatiques planifiées à l'envoi du devis, jusqu'à conversion ou clôture. La cadence est modifiable ci-dessous (variable lue par le code)." },
        { type: "cadence", title: "Cadence des relances — jours après l'envoi", offsets: cadence },
        {
          type: "kv",
          title: "Envoi",
          rows: [
            { k: "Fournisseur email", v: "Resend" },
            { k: "Déclencheur d'envoi", v: "Vercel Cron (à activer)" },
            { k: "Statut Resend", v: resend ? "connecté" : "à connecter" },
          ],
        },
      ],
      links: [{ label: "Centre de relances", href: "/follow-ups" }],
      integration: { providers: ["Resend", "Vercel Cron"], status: resend ? "connecte" : "a_connecter", via: "api" },
    },
    {
      key: "pilotage",
      title: "Pilotage",
      icon: "chart",
      tint: "#38471f",
      kind: "data",
      x: 1960,
      y: 70,
      live: map.pilotage.won > 0 || map.pilotage.conversion != null,
      statusLabel: "LIVE",
      metrics: [
        { label: "Gagnés", value: map.pilotage.won },
        { label: "Conversion", value: map.pilotage.conversion == null ? "—" : `${map.pilotage.conversion} %` },
      ],
      sections: [
        { type: "note", text: "KPIs alimentés en continu par les transitions de statut." },
        {
          type: "kv",
          title: "Sources des indicateurs",
          rows: [
            { k: "Funnel", v: "statut courant des demandes" },
            { k: "Délais < 48 h", v: "table statut_historique (transitions)" },
            { k: "Conversion", v: "won / (won + lost)" },
            { k: "Équité", v: "commissions_cumulees par commercial" },
          ],
        },
      ],
      links: [
        { label: "Ouvrir le dashboard", href: "/dashboard" },
        { label: "Analytics", href: "/analytics" },
      ],
    },
  ];

  // Conserve les métriques descriptives d'origine + attache les badges live.
  return bricks.map((b) => ({
    ...b,
    badges: live[b.key],
    live: live[b.key]?.live ?? b.live,
    statusLabel: live[b.key]?.statusLabel ?? b.statusLabel,
  }));
}
