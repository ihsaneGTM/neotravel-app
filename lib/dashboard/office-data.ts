import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUTS, type Statut } from "@/lib/ui/statuts";
import { computeScore, niveauUrgence } from "@/lib/pipeline/scoring";

export interface DemandeRow {
  id: string;
  statut: Statut;
  canal: string;
  type_prestation: string;
  complexite: string;
  ville_depart: string;
  ville_arrivee: string | null;
  nb_voyageurs: number;
  date_depart: string;
  date_demande: string | null;
  date_retour: string | null;
  options: string[] | null;
  commentaire: string | null;
  budget_indicatif: number | null;
  valeur_panier_estimee: number | null;
  created_at: string;
  clients: { nom: string; email: string | null; telephone: string | null } | null;
  commerciaux: { nom: string } | null;
}

const SELECT =
  "id, statut, canal, type_prestation, complexite, ville_depart, ville_arrivee, nb_voyageurs, date_depart, date_demande, date_retour, options, commentaire, budget_indicatif, valeur_panier_estimee, created_at, clients(nom, email, telephone), commerciaux(nom)";

export async function fetchDemandes(sb: SupabaseClient): Promise<DemandeRow[]> {
  const { data } = await sb.from("demandes").select(SELECT).order("created_at", { ascending: false });
  return (data ?? []) as unknown as DemandeRow[];
}

export function scoreOf(d: DemandeRow): number {
  return computeScore({
    valeur_panier_estimee: d.valeur_panier_estimee,
    nb_voyageurs: d.nb_voyageurs,
    date_depart: d.date_depart,
    date_demande: d.date_demande,
    date_retour: d.date_retour,
    options: d.options,
    commentaire: d.commentaire,
    budget_indicatif: d.budget_indicatif,
    email: d.clients?.email,
    telephone: d.clients?.telephone,
  }).score;
}

const trajet = (d: DemandeRow) => (d.ville_arrivee ? `${d.ville_depart} → ${d.ville_arrivee}` : d.ville_depart);

export interface DashboardData {
  total: number;
  new_leads: number;
  qualified: number;
  quotes_generated: number;
  pipeline_value: number;
  avg_score: number;
  conversion_rate: number | null;
  pending_followups: number;
  overdue_followups: number;
  funnel: { statut: Statut; count: number }[];
  by_canal: { label: string; value: number }[];
  opportunities: { id: string; client: string; trajet: string; urgence: string; score: number }[];
  upcoming: { id: string; objet: string; commercial: string | null; statut: string }[];
}

export interface LeadListItem {
  id: string;
  client: string;
  contact: string | null;
  statut: Statut;
  urgence: string;
  trajet: string;
  nb_voyageurs: number;
  date_depart: string;
  prestation: string;
  resume: string;
  score: number;
  valeur: number | null;
  commercial: string | null;
  created_at: string;
}

export async function getLeads(sb: SupabaseClient): Promise<LeadListItem[]> {
  const demandes = await fetchDemandes(sb);
  return demandes.map((d) => ({
    id: d.id,
    client: d.clients?.nom ?? "Prospect",
    contact: d.clients?.telephone ?? d.clients?.email ?? null,
    statut: d.statut,
    urgence: niveauUrgence(d.date_depart, d.date_demande),
    trajet: trajet(d),
    nb_voyageurs: d.nb_voyageurs,
    date_depart: d.date_depart,
    prestation: d.type_prestation,
    resume: d.commentaire?.trim() || `${d.type_prestation} — ${trajet(d)}, ${d.nb_voyageurs} voyageurs.`,
    score: scoreOf(d),
    valeur: d.valeur_panier_estimee != null ? Number(d.valeur_panier_estimee) : null,
    commercial: d.commerciaux?.nom ?? null,
    created_at: d.created_at,
  }));
}

export interface MapData {
  captation: { total: number; via_chat: number };
  qualification: { progresses: number; avg_score: number };
  attribution: { attribues: number; commerciaux: number };
  devis: { count: number; pipeline: number };
  relances: { pending: number; overdue: number };
  pilotage: { won: number; conversion: number | null };
  model_agent: string;
}

export async function getPipelineMap(sb: SupabaseClient, modelAgent: string): Promise<MapData> {
  const [demandes, devisRes, relancesRes, commsRes] = await Promise.all([
    fetchDemandes(sb),
    sb.from("devis").select("id", { count: "exact", head: true }),
    sb.from("relances").select("id, statut, planifiee_pour"),
    sb.from("commerciaux").select("id", { count: "exact", head: true }).eq("actif", true),
  ]);

  const counts = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  for (const d of demandes) if (counts[d.statut] != null) counts[d.statut]++;
  const scores = demandes.map(scoreOf);
  const avg_score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const progresses = demandes.filter((d) => d.statut !== "new").length;
  const attribues = demandes.filter((d) => d.commerciaux != null).length;
  const pipeline = demandes
    .filter((d) => d.statut !== "won" && d.statut !== "lost")
    .reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const rel = (relancesRes.data ?? []) as { statut: string; planifiee_pour: string | null }[];
  const pending = rel.filter((r) => r.statut === "planifiee");
  const overdue = pending.filter((r) => r.planifiee_pour && new Date(r.planifiee_pour).getTime() < Date.now());
  const conversion = counts.won + counts.lost === 0 ? null : Math.round((counts.won / (counts.won + counts.lost)) * 100);

  return {
    captation: { total: demandes.length, via_chat: demandes.filter((d) => d.canal === "conversation_ia").length },
    qualification: { progresses, avg_score },
    attribution: { attribues, commerciaux: commsRes.count ?? 0 },
    devis: { count: devisRes.count ?? 0, pipeline },
    relances: { pending: pending.length, overdue: overdue.length },
    pilotage: { won: counts.won, conversion },
    model_agent: modelAgent,
  };
}

const CANAL_LABEL: Record<string, string> = {
  conversation_ia: "Chat IA",
  formulaire: "Formulaire",
  telephone: "Téléphone",
  email: "Email",
  import: "Import",
};

export async function getDashboard(sb: SupabaseClient): Promise<DashboardData> {
  const [demandes, devisRes, relancesRes] = await Promise.all([
    fetchDemandes(sb),
    sb.from("devis").select("id", { count: "exact", head: true }),
    sb.from("relances").select("id, statut, objet, planifiee_pour").order("planifiee_pour", { ascending: true }),
  ]);

  const counts = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  for (const d of demandes) if (counts[d.statut] != null) counts[d.statut]++;

  const active = demandes.filter((d) => d.statut !== "won" && d.statut !== "lost");
  const pipeline_value = active.reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const scores = demandes.map(scoreOf);
  const avg_score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const won = counts.won;
  const lost = counts.lost;
  const conversion_rate = won + lost === 0 ? null : Math.round((won / (won + lost)) * 100);

  const relances = (relancesRes.data ?? []) as {
    id: string;
    statut: string;
    objet: string | null;
    planifiee_pour: string | null;
  }[];
  const pending = relances.filter((r) => r.statut === "planifiee");
  const overdue = pending.filter((r) => r.planifiee_pour && new Date(r.planifiee_pour).getTime() < Date.now());

  // Leads par canal
  const canalMap = new Map<string, number>();
  for (const d of demandes) canalMap.set(d.canal, (canalMap.get(d.canal) ?? 0) + 1);
  const by_canal = [...canalMap.entries()].map(([k, v]) => ({ label: CANAL_LABEL[k] ?? k, value: v }));

  // Opportunités prioritaires : leads actifs triés par score.
  const opportunities = active
    .map((d) => ({
      id: d.id,
      client: d.clients?.nom ?? "Prospect",
      trajet: trajet(d),
      urgence: niveauUrgence(d.date_depart, d.date_demande),
      score: scoreOf(d),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const upcoming = pending.slice(0, 5).map((r) => ({
    id: r.id,
    objet: r.objet ?? "Relance",
    commercial: null as string | null,
    statut: r.statut,
  }));

  return {
    total: demandes.length,
    new_leads: counts.new,
    qualified: counts.qualified,
    quotes_generated: devisRes.count ?? 0,
    pipeline_value,
    avg_score,
    conversion_rate,
    pending_followups: pending.length,
    overdue_followups: overdue.length,
    funnel: STATUTS.map((statut) => ({ statut, count: counts[statut] })),
    by_canal,
    opportunities,
    upcoming,
  };
}
