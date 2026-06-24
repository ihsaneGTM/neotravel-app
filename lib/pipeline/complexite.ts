/**
 * Évaluation de la complexité d'une demande (matrice des cas).
 * Pilote l'affichage de l'estimation (simple uniquement) et l'escalade humaine.
 */
export type Complexite = "simple" | "complexe" | "urgence" | "incoherent";

export interface EvalComplexite {
  complexite: Complexite;
  /** L'estimation indicative n'est montrée au prospect que si simple. */
  afficher_estimation: boolean;
  raisons: string[];
}

const MS_JOUR = 86_400_000;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

export interface DemandeComplexite {
  type_deplacement: string;
  nb_voyageurs: number;
  date_depart: string;
  date_retour?: string;
  date_demande?: string;
  etapes?: string[];
}

export function evaluerComplexite(d: DemandeComplexite, aujourdhui: Date = new Date()): EvalComplexite {
  const dep = parse(d.date_depart);
  const dem = d.date_demande ? parse(d.date_demande) : aujourdhui;

  // 1. Incohérences (garde-fou → correction demandée).
  const incoherences: string[] = [];
  if (Number.isNaN(dep.getTime())) incoherences.push("date de départ invalide");
  if (!(d.nb_voyageurs > 0)) incoherences.push("nombre de voyageurs ≤ 0");
  if (d.date_retour) {
    const ret = parse(d.date_retour);
    if (!Number.isNaN(ret.getTime()) && ret < dep) incoherences.push("retour avant le départ");
  }
  if (!Number.isNaN(dep.getTime()) && dep < dem) incoherences.push("date de départ déjà passée");
  if (incoherences.length) return { complexite: "incoherent", afficher_estimation: false, raisons: incoherences };

  // 2. Complexe (flux manuel) : circuit, étapes, > 85 passagers.
  const complexes: string[] = [];
  if (d.type_deplacement === "circuit") complexes.push("circuit multi-étapes");
  if ((d.etapes?.length ?? 0) > 0) complexes.push("étapes intermédiaires");
  if (d.nb_voyageurs > 85) complexes.push("> 85 passagers (multi-véhicules)");
  if (complexes.length) return { complexite: "complexe", afficher_estimation: false, raisons: complexes };

  // 3. Urgence (< 48h) : chiffrable mais pas de devis auto → notification commerciale.
  const ecartJours = Math.round((dep.getTime() - dem.getTime()) / MS_JOUR);
  if (ecartJours < 2) {
    return { complexite: "urgence", afficher_estimation: false, raisons: [`départ dans ${ecartJours} j (< 48h)`] };
  }

  // 4. Simple → estimation affichable.
  return { complexite: "simple", afficher_estimation: true, raisons: [] };
}
