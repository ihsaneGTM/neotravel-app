import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPipelineMap } from "@/lib/dashboard/office-data";
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
  metrics: { label: string; value: string | number }[];
  sections: Section[];
  links: { label: string; href: string }[];
  integration?: { providers: string[]; status: "connecte" | "a_connecter"; via: string };
}

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export async function getWorkflow(sb: SupabaseClient): Promise<Brick[]> {
  const map = await getPipelineMap(sb, MODELS.agent);
  const [{ count: convCount }, { count: convFlag }, { count: appelsCount }, { data: commsData }] = await Promise.all([
    sb.from("conversations").select("id", { count: "exact", head: true }),
    sb.from("conversations").select("id", { count: "exact", head: true }).eq("statut", "a_rappeler"),
    sb.from("appels").select("id", { count: "exact", head: true }),
    sb.from("commerciaux").select("nom, specialites, commissions_cumulees, charge_courante").order("commissions_cumulees", { ascending: true }),
  ]);
  const comms = (commsData ?? []) as { nom: string; specialites: string[] | null; commissions_cumulees: number; charge_courante: number }[];
  const resend = resendConfigured();
  const studio = studioConfigured().ok;
  const cadence = await getRelancesCadence(sb);
  const M = MATRICES_DEFAUT;

  // Coefficient saison condensé (regroupe les mois par coeff).
  const saisonRows = Object.entries(M.saison).map(([mois, s]) => [MOIS[Number(mois) - 1], `${s.libelle}`, `×${s.coeff}`]);
  const anticipationRows = M.anticipation.map((a) => [a.libelle, `×${a.coeff}`]);
  const capaciteRows = M.capacite.map((c) => [c.libelle, `×${c.coeff}`, c.type_vehicule.replace(/_/g, " ")]);

  return [
    {
      key: "chat",
      title: "Conversation IA",
      icon: "chat",
      tint: "#4f46e5",
      kind: "ia",
      x: 40,
      y: 70,
      live: map.captation.total > 0 || (convCount ?? 0) > 0,
      statusLabel: (convCount ?? 0) > 0 ? "LIVE" : "PRÊT",
      metrics: [
        { label: "Conversations", value: convCount ?? 0 },
        { label: "Leads créés", value: map.captation.total },
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
      tint: "#0ea5e9",
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
          type: "table",
          title: "Scoring — lib/pipeline/scoring.ts",
          columns: ["Dimension", "Définition", "Poids"],
          rows: SCORING.dimensions.map((d) => [d.label, d.desc, `${Math.round((SCORING.globalWeights[d.key as keyof typeof SCORING.globalWeights] ?? 0) * 100)} %`]),
        },
      ],
      links: studio ? [{ label: "Ajuster le scoring (Studio)", href: "/studio" }] : [],
    },
    {
      key: "attrib",
      title: "Attribution / CRM",
      icon: "users",
      tint: "#10b981",
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
      tint: "#e0a800",
      kind: "integration",
      x: 1000,
      y: 220,
      live: (appelsCount ?? 0) > 0,
      statusLabel: (appelsCount ?? 0) > 0 ? "LIVE" : "À CONNECTER",
      metrics: [
        { label: "Appels loggés", value: appelsCount ?? 0 },
        { label: "Auto", value: "Qualifié→Contacté" },
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
      tint: "#f59e0b",
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
      tint: "#8b5cf6",
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
      tint: "#64748b",
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
}
