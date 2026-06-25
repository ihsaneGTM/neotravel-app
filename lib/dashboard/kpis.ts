import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * KPIs du dashboard de pilotage NeoTravel.
 * Source de vérité des délais/conversion = table `statut_historique`
 * (1 ligne par transition de statut). Le funnel = comptage par statut courant.
 */

export const STATUTS = [
  "new",
  "qualified",
  "contacted",
  "quote_sent",
  "negotiation",
  "won",
  "lost",
] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABEL: Record<Statut, string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  contacted: "Contacté",
  quote_sent: "Devis envoyé",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

const SEUIL_48H_MS = 48 * 3600 * 1000;

export interface CommercialKpi {
  id: string;
  nom: string;
  leads: number;
  charge_courante: number;
  commissions_cumulees: number;
  pipeline: number;
}

export interface LeadRecent {
  id: string;
  client: string;
  trajet: string;
  nb_voyageurs: number;
  statut: Statut;
  complexite: string;
  valeur: number | null;
  commercial: string | null;
  created_at: string;
}

export interface DashboardData {
  total: number;
  funnel: { statut: Statut; count: number }[];
  pct_pris_en_charge_48h: number | null;
  delai_moyen_h: number | null;
  nb_qualifies: number;
  taux_conversion: number | null; // won / (won + lost)
  pipeline_actif: number; // somme paniers hors won/lost
  ca_gagne: number; // somme paniers won
  commerciaux: CommercialKpi[];
  leads_recents: LeadRecent[];
}

type DemandeRow = {
  id: string;
  statut: Statut;
  created_at: string;
  valeur_panier_estimee: number | null;
  complexite: string;
  nb_voyageurs: number;
  ville_depart: string;
  ville_arrivee: string | null;
  commercial_id: string | null;
  commerciaux: { nom: string } | null;
  clients: { nom: string } | null;
};

export async function getDashboardData(sb: SupabaseClient): Promise<DashboardData> {
  const [{ data: demandesRaw }, { data: histRaw }, { data: commsRaw }] = await Promise.all([
    sb
      .from("demandes")
      .select(
        "id, statut, created_at, valeur_panier_estimee, complexite, nb_voyageurs, ville_depart, ville_arrivee, commercial_id, commerciaux(nom), clients(nom)"
      )
      .order("created_at", { ascending: false }),
    sb.from("statut_historique").select("demande_id, nouveau_statut, changed_at"),
    sb.from("commerciaux").select("id, nom, charge_courante, commissions_cumulees"),
  ]);

  const demandes = (demandesRaw ?? []) as unknown as DemandeRow[];
  const hist = (histRaw ?? []) as { demande_id: string; nouveau_statut: Statut; changed_at: string }[];
  const comms = (commsRaw ?? []) as {
    id: string;
    nom: string;
    charge_courante: number;
    commissions_cumulees: number;
  }[];

  // ── Funnel par statut courant ──────────────────────────────────────────
  const counts = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>;
  for (const d of demandes) if (counts[d.statut] != null) counts[d.statut]++;
  const funnel = STATUTS.map((statut) => ({ statut, count: counts[statut] }));

  // ── Délai de prise en charge (création → 1ère qualification) ───────────
  const createdAt = new Map(demandes.map((d) => [d.id, new Date(d.created_at).getTime()]));
  const premiereQualif = new Map<string, number>();
  for (const h of hist) {
    if (h.nouveau_statut === "qualified") {
      const t = new Date(h.changed_at).getTime();
      const prev = premiereQualif.get(h.demande_id);
      if (prev == null || t < prev) premiereQualif.set(h.demande_id, t);
    }
  }
  const delais: number[] = [];
  for (const [id, tQualif] of premiereQualif) {
    const tCreate = createdAt.get(id);
    if (tCreate != null) delais.push(tQualif - tCreate);
  }
  const nb_qualifies = delais.length;
  const pct_pris_en_charge_48h =
    nb_qualifies === 0 ? null : Math.round((delais.filter((d) => d <= SEUIL_48H_MS).length / nb_qualifies) * 100);
  const delai_moyen_h =
    nb_qualifies === 0 ? null : Math.round((delais.reduce((a, b) => a + b, 0) / nb_qualifies / 3600000) * 10) / 10;

  // ── Conversion & valeur ─────────────────────────────────────────────────
  const won = counts.won;
  const lost = counts.lost;
  const taux_conversion = won + lost === 0 ? null : Math.round((won / (won + lost)) * 100);
  const pipeline_actif = demandes
    .filter((d) => d.statut !== "won" && d.statut !== "lost")
    .reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);
  const ca_gagne = demandes
    .filter((d) => d.statut === "won")
    .reduce((s, d) => s + (Number(d.valeur_panier_estimee) || 0), 0);

  // ── Par commercial (équité des commissions) ─────────────────────────────
  const pipelineParComm = new Map<string, number>();
  const leadsParComm = new Map<string, number>();
  for (const d of demandes) {
    if (!d.commercial_id) continue;
    leadsParComm.set(d.commercial_id, (leadsParComm.get(d.commercial_id) ?? 0) + 1);
    pipelineParComm.set(
      d.commercial_id,
      (pipelineParComm.get(d.commercial_id) ?? 0) + (Number(d.valeur_panier_estimee) || 0)
    );
  }
  const commerciaux: CommercialKpi[] = comms
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      leads: leadsParComm.get(c.id) ?? 0,
      charge_courante: c.charge_courante,
      commissions_cumulees: Number(c.commissions_cumulees) || 0,
      pipeline: pipelineParComm.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  // ── Leads récents ───────────────────────────────────────────────────────
  const leads_recents: LeadRecent[] = demandes.slice(0, 12).map((d) => ({
    id: d.id,
    client: d.clients?.nom ?? "—",
    trajet: d.ville_arrivee ? `${d.ville_depart} → ${d.ville_arrivee}` : d.ville_depart,
    nb_voyageurs: d.nb_voyageurs,
    statut: d.statut,
    complexite: d.complexite,
    valeur: d.valeur_panier_estimee != null ? Number(d.valeur_panier_estimee) : null,
    commercial: d.commerciaux?.nom ?? null,
    created_at: d.created_at,
  }));

  return {
    total: demandes.length,
    funnel,
    pct_pris_en_charge_48h,
    delai_moyen_h,
    nb_qualifies,
    taux_conversion,
    pipeline_actif,
    ca_gagne,
    commerciaux,
    leads_recents,
  };
}
