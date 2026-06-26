import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUTS, type Statut } from "@/lib/ui/statuts";
import { computeScore, niveauUrgence } from "@/lib/pipeline/scoring";
import { leadAction, isCommercialAction } from "@/lib/pipeline/lead-action";

/** Compte, par demande, le total de relances et celles « échues » (envoyées ou dont la date est passée). */
async function relancesParDemande(sb: SupabaseClient): Promise<Map<string, { total: number; dues: number }>> {
  const { data } = await sb.from("relances").select("demande_id, statut, planifiee_pour");
  const now = Date.now();
  const m = new Map<string, { total: number; dues: number }>();
  for (const r of (data ?? []) as { demande_id: string; statut: string; planifiee_pour: string | null }[]) {
    const e = m.get(r.demande_id) ?? { total: 0, dues: 0 };
    e.total++;
    if (r.statut === "envoyee" || (r.planifiee_pour && new Date(r.planifiee_pour).getTime() <= now)) e.dues++;
    m.set(r.demande_id, e);
  }
  return m;
}

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
  clients: { prenom: string | null; nom: string; email: string | null; telephone: string | null } | null;
  commerciaux: { nom: string } | null;
}

const SELECT =
  "id, statut, canal, type_prestation, complexite, ville_depart, ville_arrivee, nb_voyageurs, date_depart, date_demande, date_retour, options, commentaire, budget_indicatif, valeur_panier_estimee, created_at, clients(prenom, nom, email, telephone), commerciaux(nom)";

const nomClient = (d: DemandeRow) => [d.clients?.prenom, d.clients?.nom].filter(Boolean).join(" ") || "Prospect";

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
  a_envoyer: { demande_id: string; client: string; trajet: string; prix_ttc: number }[];
  /** Série quotidienne sur 30 j (réelle, depuis created_at) — pour le graphe d'activité + courbe pipeline. */
  daily: { date: string; leads: number; pipeline: number }[];
  /** Variation vs période précédente de même longueur (%), null si base nulle. */
  deltas: { new_leads: number | null; quotes: number | null; pipeline: number | null };
  /** Période active (echo pour l'UI). */
  period: Period;
}

export interface FollowupItem {
  id: string;
  objet: string;
  planifiee_pour: string;
  statut: string;
  type: string;
  client: string;
  trajet: string;
  demande_id: string;
  overdue: boolean;
}
export interface FollowupsData {
  overdue: number;
  pending: number;
  completed: number;
  items: FollowupItem[];
}

export async function getFollowups(sb: SupabaseClient): Promise<FollowupsData> {
  const { data } = await sb
    .from("relances")
    .select("id, objet, planifiee_pour, statut, type, demande_id, demandes(ville_depart, ville_arrivee, clients(prenom, nom))")
    .order("planifiee_pour", { ascending: true });
  const rows = (data ?? []) as unknown as {
    id: string; objet: string | null; planifiee_pour: string; statut: string; type: string; demande_id: string;
    demandes: { ville_depart: string; ville_arrivee: string | null; clients: { prenom: string | null; nom: string | null } | null } | null;
  }[];
  const now = Date.now();
  const items: FollowupItem[] = rows.map((r) => ({
    id: r.id,
    objet: r.objet ?? "Relance",
    planifiee_pour: r.planifiee_pour,
    statut: r.statut,
    type: r.type,
    client: [r.demandes?.clients?.prenom, r.demandes?.clients?.nom].filter(Boolean).join(" ") || "Prospect",
    trajet: r.demandes?.ville_arrivee ? `${r.demandes.ville_depart} → ${r.demandes.ville_arrivee}` : r.demandes?.ville_depart ?? "—",
    demande_id: r.demande_id,
    overdue: r.statut === "planifiee" && new Date(r.planifiee_pour).getTime() < now,
  }));
  return {
    overdue: items.filter((i) => i.overdue).length,
    pending: items.filter((i) => i.statut === "planifiee").length,
    completed: items.filter((i) => i.statut === "envoyee").length,
    items,
  };
}

export interface ConversationItem {
  id: string;
  statut: string;
  complexite: string | null;
  client: string | null;
  demande_id: string | null;
  dernier_message: string | null;
  nb_messages: number;
  updated_at: string;
  transcript: { role: string; text: string }[];
}

export async function getConversations(sb: SupabaseClient): Promise<ConversationItem[]> {
  const { data } = await sb
    .from("conversations")
    .select("id, statut, complexite, demande_id, dernier_message, nb_messages, updated_at, transcript, clients(prenom, nom)")
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as {
    id: string; statut: string; complexite: string | null; demande_id: string | null;
    dernier_message: string | null; nb_messages: number; updated_at: string;
    transcript: { role: string; text: string }[] | null;
    clients: { prenom: string | null; nom: string | null } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    statut: r.statut,
    complexite: r.complexite,
    client: r.clients ? [r.clients.prenom, r.clients.nom].filter(Boolean).join(" ") || null : null,
    demande_id: r.demande_id,
    dernier_message: r.dernier_message,
    nb_messages: r.nb_messages,
    updated_at: r.updated_at,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
  }));
}

export interface AnalyticsData {
  total: number;
  pipeline_value: number;
  win_rate: number | null;
  avg_score: number;
  quotes_sent: number;
  funnel: { label: string; value: number; note: string }[];
  sources: { label: string; value: number }[];
  score_dist: { label: string; value: number }[];
  by_purpose: { label: string; value: number; hex: string }[];
  team: { nom: string; leads: number; pipeline: number; avg: number }[];
}

const PURPOSE_HEX = ["#4f46e5", "#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];
const PRESTATION_LABEL: Record<string, string> = {
  transfert: "Transfert",
  navette: "Navette",
  scolaire: "Scolaire",
  seminaire: "Séminaire",
  tourisme: "Tourisme",
  mise_a_disposition: "Mise à disposition",
};

export async function getAnalytics(sb: SupabaseClient): Promise<AnalyticsData> {
  const [demandes, devisRes, commsRes] = await Promise.all([
    fetchDemandes(sb),
    sb.from("devis").select("id", { count: "exact", head: true }),
    sb.from("commerciaux").select("id, nom"),
  ]);
  const total = demandes.length;
  const counts = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  for (const d of demandes) if (counts[d.statut] != null) counts[d.statut]++;

  const order: Statut[] = ["new", "qualified", "contacted", "quote_sent", "negotiation", "won"];
  const rank = (s: Statut) => order.indexOf(s); // lost => -1
  const reached = (stage: Statut) => demandes.filter((d) => rank(d.statut) >= rank(stage)).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const funnel = [
    { label: "Tous les leads", value: total, note: `${total} (100%)` },
    { label: "Qualifiés", value: reached("qualified"), note: `${reached("qualified")} (${pct(reached("qualified"))}%)` },
    { label: "Contactés", value: reached("contacted"), note: `${reached("contacted")} (${pct(reached("contacted"))}%)` },
    { label: "Devis envoyé", value: reached("quote_sent"), note: `${reached("quote_sent")} (${pct(reached("quote_sent"))}%)` },
    { label: "Gagnés", value: counts.won, note: `${counts.won} (${pct(counts.won)}%)` },
  ];

  const pipeline_value = demandes.filter((d) => d.statut !== "won" && d.statut !== "lost").reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const scores = demandes.map(scoreOf);
  const avg_score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const win_rate = counts.won + counts.lost === 0 ? null : Math.round((counts.won / (counts.won + counts.lost)) * 100);

  const canalMap = new Map<string, number>();
  for (const d of demandes) canalMap.set(d.canal, (canalMap.get(d.canal) ?? 0) + 1);
  const sources = [...canalMap.entries()].map(([k, v]) => ({ label: CANAL_LABEL[k] ?? k, value: v }));

  const buckets = [0, 0, 0, 0];
  for (const sc of scores) buckets[sc >= 76 ? 3 : sc >= 51 ? 2 : sc >= 26 ? 1 : 0]++;
  const score_dist = [
    { label: "0-25", value: buckets[0] },
    { label: "26-50", value: buckets[1] },
    { label: "51-75", value: buckets[2] },
    { label: "76-100", value: buckets[3] },
  ];

  const purposeMap = new Map<string, number>();
  for (const d of demandes) purposeMap.set(d.type_prestation, (purposeMap.get(d.type_prestation) ?? 0) + 1);
  const by_purpose = [...purposeMap.entries()].map(([k, v], i) => ({ label: PRESTATION_LABEL[k] ?? k, value: v, hex: PURPOSE_HEX[i % PURPOSE_HEX.length] }));

  const comms = (commsRes.data ?? []) as { id: string; nom: string }[];
  // Agrégat par nom de commercial (le select demandes ramène commerciaux(nom)).
  const byNom = new Map<string, { leads: number; pipeline: number }>();
  for (const d of demandes) {
    const nom = d.commerciaux?.nom ?? "Non attribué";
    const cur = byNom.get(nom) ?? { leads: 0, pipeline: 0 };
    cur.leads++;
    cur.pipeline += Number(d.valeur_panier_estimee) || 0;
    byNom.set(nom, cur);
  }
  // Inclure les commerciaux sans lead.
  for (const c of comms) if (!byNom.has(c.nom)) byNom.set(c.nom, { leads: 0, pipeline: 0 });
  const team = [...byNom.entries()]
    .map(([nom, v]) => ({ nom, leads: v.leads, pipeline: v.pipeline, avg: v.leads ? Math.round(v.pipeline / v.leads) : 0 }))
    .sort((a, b) => b.pipeline - a.pipeline);

  return { total, pipeline_value, win_rate, avg_score, quotes_sent: devisRes.count ?? 0, funnel, sources, score_dist, by_purpose, team };
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
  /** Un devis ferme est généré et prêt à envoyer (pour distinguer "générer" vs "envoyer"). */
  devis_pret: boolean;
  /** Avancement des relances (pour les colonnes « En cours de relance » / « À rappeler »). */
  relances_total: number;
  relances_dues: number;
}

/** Ensemble des demande_id ayant un devis ferme NON encore envoyé (prêt à envoyer). */
async function devisFermesPrets(sb: SupabaseClient): Promise<Set<string>> {
  const { data } = await sb.from("devis").select("demande_id").eq("type", "ferme").is("envoye_at", null);
  return new Set(((data ?? []) as { demande_id: string }[]).map((r) => r.demande_id));
}

export async function getLeads(sb: SupabaseClient): Promise<LeadListItem[]> {
  const [demandes, prets, relances] = await Promise.all([fetchDemandes(sb), devisFermesPrets(sb), relancesParDemande(sb)]);
  return demandes.map((d) => {
    const rel = relances.get(d.id) ?? { total: 0, dues: 0 };
    return {
      id: d.id,
      client: nomClient(d),
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
      devis_pret: prets.has(d.id),
      relances_total: rel.total,
      relances_dues: rel.dues,
    };
  });
}

/** Nombre de leads en attente d'une action COMMERCIALE (pour la pastille sidebar). */
export async function getLeadActionCount(sb: SupabaseClient): Promise<number> {
  const [{ data }, relances] = await Promise.all([sb.from("demandes").select("id, statut"), relancesParDemande(sb)]);
  const rows = (data ?? []) as { id: string; statut: Statut }[];
  // Source unique de vérité : owner === 'commercial' (inclut « À rappeler » des relances échues).
  return rows.filter((r) => {
    const rel = relances.get(r.id) ?? { total: 0, dues: 0 };
    return isCommercialAction(leadAction(r.statut, { relancesTotal: rel.total, relancesDues: rel.dues }));
  }).length;
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

/** Filtre de période global du dashboard. */
export type Period = "today" | "yesterday" | "7d" | "14d" | "30d";
export const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "7d", label: "7 jours" },
  { key: "14d", label: "14 jours" },
  { key: "30d", label: "30 jours" },
];

export function periodWindow(period: Period) {
  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startTs = start.getTime();
  const DAY = 86_400_000;
  if (period === "today") return { from: startTs, to: now, prevFrom: startTs - DAY, prevTo: startTs };
  if (period === "yesterday") return { from: startTs - DAY, to: startTs, prevFrom: startTs - 2 * DAY, prevTo: startTs - DAY };
  const d = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  return { from: now - d * DAY, to: now, prevFrom: now - 2 * d * DAY, prevTo: now - d * DAY };
}

export async function getDashboard(sb: SupabaseClient, period: Period = "30d"): Promise<DashboardData> {
  const [demandes, , devisDatesRes, relancesRes, aEnvoyerRes] = await Promise.all([
    fetchDemandes(sb),
    sb.from("devis").select("id", { count: "exact", head: true }),
    sb.from("devis").select("created_at"),
    sb.from("relances").select("id, statut, objet, planifiee_pour").order("planifiee_pour", { ascending: true }),
    sb
      .from("devis")
      .select("demande_id, prix_ttc, created_at, demandes(ville_depart, ville_arrivee, clients(prenom, nom))")
      .eq("type", "ferme")
      .is("envoye_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const win = periodWindow(period);
  const inWin = (iso: string | null | undefined, from = win.from, to = win.to) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };
  // Sous-ensemble des demandes créées dans la période (pilote tous les agrégats analytiques).
  const demandesIn = demandes.filter((d) => inWin(d.created_at));

  const counts = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  for (const d of demandesIn) if (counts[d.statut] != null) counts[d.statut]++;

  const active = demandesIn.filter((d) => d.statut !== "won" && d.statut !== "lost");
  const pipeline_value = active.reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const scores = demandesIn.map(scoreOf);
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

  // Leads par canal (sur la période)
  const canalMap = new Map<string, number>();
  for (const d of demandesIn) canalMap.set(d.canal, (canalMap.get(d.canal) ?? 0) + 1);
  const by_canal = [...canalMap.entries()].map(([k, v]) => ({ label: CANAL_LABEL[k] ?? k, value: v }));

  // Opportunités prioritaires : leads actifs triés par score.
  const opportunities = active
    .map((d) => ({
      id: d.id,
      client: nomClient(d),
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

  // Devis ferme générés mais PAS encore envoyés (à prévisualiser puis envoyer).
  const aEnvoyerRows = (aEnvoyerRes.data ?? []) as unknown as {
    demande_id: string;
    prix_ttc: number;
    demandes: { ville_depart: string; ville_arrivee: string | null; clients: { prenom: string | null; nom: string | null } | null } | null;
  }[];
  const seen = new Set<string>();
  const a_envoyer = aEnvoyerRows
    .filter((r) => (seen.has(r.demande_id) ? false : seen.add(r.demande_id)))
    .slice(0, 6)
    .map((r) => ({
      demande_id: r.demande_id,
      client: [r.demandes?.clients?.prenom, r.demandes?.clients?.nom].filter(Boolean).join(" ") || "Prospect",
      trajet: r.demandes?.ville_arrivee ? `${r.demandes.ville_depart} → ${r.demandes.ville_arrivee}` : r.demandes?.ville_depart ?? "—",
      prix_ttc: Number(r.prix_ttc) || 0,
    }));

  // ── Série quotidienne sur la fenêtre de période (depuis created_at) ───────────
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const DAY = 86_400_000;
  const startDay = new Date(win.from);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(win.to);
  endDay.setHours(0, 0, 0, 0);
  const dayList: string[] = [];
  for (let t = startDay.getTime(); t <= endDay.getTime(); t += DAY) dayList.push(dayKey(t));
  const leadsByDay = new Map<string, number>();
  for (const d of demandesIn) {
    const k = (d.created_at ?? "").slice(0, 10);
    if (k) leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1);
  }
  // Pipeline cumulé sur la fenêtre : somme des paniers actifs créés jusqu'à chaque jour.
  const activeWithDate = active
    .map((d) => ({ t: new Date(d.created_at ?? win.to).getTime(), v: Number(d.valeur_panier_estimee) || 0 }))
    .sort((a, b) => a.t - b.t);
  const daily = dayList.map((date) => {
    const end = new Date(date + "T23:59:59").getTime();
    const pipeline = activeWithDate.reduce((s, x) => (x.t <= end ? s + x.v : s), 0);
    return { date, leads: leadsByDay.get(date) ?? 0, pipeline };
  });

  // ── Deltas vs période précédente de même longueur ─────────────────────────────
  const pct = (cur: number, prev: number): number | null => (prev <= 0 ? (cur > 0 ? 100 : null) : Math.round(((cur - prev) / prev) * 1000) / 10);
  const prevIn = demandes.filter((d) => inWin(d.created_at, win.prevFrom, win.prevTo));
  const leadsCur = demandesIn.length;
  const leadsPrev = prevIn.length;
  const prevPipeline = prevIn
    .filter((d) => d.statut !== "won" && d.statut !== "lost")
    .reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const devisDates = (devisDatesRes.data ?? []) as { created_at: string }[];
  const devisCur = devisDates.filter((d) => inWin(d.created_at)).length;
  const devisPrev = devisDates.filter((d) => inWin(d.created_at, win.prevFrom, win.prevTo)).length;

  return {
    total: demandes.length,
    new_leads: counts.new,
    qualified: counts.qualified,
    quotes_generated: devisCur,
    pipeline_value,
    avg_score,
    conversion_rate,
    pending_followups: pending.length,
    overdue_followups: overdue.length,
    funnel: STATUTS.map((statut) => ({ statut, count: counts[statut] })),
    by_canal,
    opportunities,
    upcoming,
    a_envoyer,
    daily,
    deltas: { new_leads: pct(leadsCur, leadsPrev), quotes: pct(devisCur, devisPrev), pipeline: pct(pipeline_value, prevPipeline) },
    period,
  };
}
