/**
 * Scoring de lead NeoTravel — 100 % déterministe et TRANSPARENT.
 *
 * Le score traduit l'URGENCE D'ACTION commerciale (qui traiter en premier), pas
 * une « qualité » abstraite. Deux critères métier, plus une priorité absolue :
 *
 *   1. PRESSION DÉLAI (SLA demande→devis) — règle d'or : un devis doit partir
 *      dans les 24 h suivant la demande. Plus on approche de cette échéance sans
 *      avoir envoyé le devis, plus la pression monte (≈ 100 à l'approche des 24 h,
 *      et 100 au-delà). Une fois le devis envoyé, ce délai est résolu → pression 0.
 *   2. TAILLE DU DEAL — un gros panier pèse plus dans la balance.
 *
 *   PRIORITÉ ABSOLUE « URGENT » : si le départ est imminent (≤ urgentDepartJours),
 *   le score est forcé à 100 quel que soit le reste — le car part bientôt, il faut
 *   traiter en priorité.
 *
 * Tout est piloté par l'objet SCORING (affiché et réglable dans la page Workflow).
 */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Paramétrage du scoring — source UNIQUE (affichée/éditée dans le Workflow). */
export const SCORING = {
  /** Fenêtre cible demande → envoi du devis (heures). */
  slaTargetH: 24,
  /** Courbe de la pression délai (exposant ; > 1 = accélère vers l'échéance). */
  slaCurve: 1.4,
  /** Panier (€) atteignant 100 sur l'axe « taille du deal ». */
  dealCapEur: 15000,
  /** Pondération des deux axes (somme = 1). */
  poids: { sla: 0.6, deal: 0.4 },
  /** Départ à ≤ N jours ⇒ « Urgent » (score forcé à 100). */
  urgentDepartJours: 7,
} as const;

export interface ScoreInput {
  /** Horodatage de la demande (fin de conversation IA) — départ du chrono SLA. */
  created_at?: string | null;
  date_depart: string;
  date_demande?: string | null;
  valeur_panier_estimee?: number | null;
  /** Le devis a-t-il été envoyé ? (statut quote_sent et au-delà) → SLA résolu. */
  devisEnvoye?: boolean;
}

export interface LeadScore {
  /** Score global 0-100 (urgence d'action). */
  score: number;
  /** Départ imminent ⇒ priorité absolue (score forcé à 100). */
  urgent: boolean;
  /** Pression délai 0-100 (demande → 24 h). */
  slaPressure: number;
  /** Taille du deal 0-100. */
  dealSize: number;
  /** Heures écoulées depuis la demande. */
  heuresDepuisDemande: number;
  /** Jours avant le départ. */
  joursAvantDepart: number;
}

export function computeScore(d: ScoreInput): LeadScore {
  const now = Date.now();

  // Proximité du départ (référence : date de la demande, sinon maintenant).
  const dep = new Date(d.date_depart).getTime();
  const ref = d.date_demande ? new Date(d.date_demande).getTime() : now;
  const joursAvantDepart = Math.max(0, Math.round((dep - ref) / DAY));
  const urgent = joursAvantDepart <= SCORING.urgentDepartJours;

  // Pression délai : chrono depuis la demande, rapporté à la cible 24 h.
  const reqTs = d.created_at ? new Date(d.created_at).getTime() : ref;
  const heuresDepuisDemande = Math.max(0, (now - reqTs) / HOUR);
  const ratio = Math.min(1, heuresDepuisDemande / SCORING.slaTargetH);
  const slaPressureRaw = clamp(100 * Math.pow(ratio, SCORING.slaCurve));
  // Une fois le devis envoyé, le SLA demande→devis est tenu → plus de pression.
  const slaPressure = d.devisEnvoye ? 0 : slaPressureRaw;

  // Taille du deal : panier rapporté au plafond.
  const panier = Number(d.valeur_panier_estimee) || 0;
  const dealSize = clamp((panier / SCORING.dealCapEur) * 100);

  const score = urgent ? 100 : clamp(SCORING.poids.sla * slaPressure + SCORING.poids.deal * dealSize);

  return { score, urgent, slaPressure, dealSize, heuresDepuisDemande, joursAvantDepart };
}

/** Niveau d'urgence textuel (badge) à partir de la proximité du départ. */
export function niveauUrgence(date_depart: string, date_demande?: string | null): "Urgent" | "High" | "Medium" | "Low" {
  const dep = new Date(date_depart).getTime();
  const base = date_demande ? new Date(date_demande).getTime() : Date.now();
  const jours = Math.round((dep - base) / DAY);
  if (jours <= SCORING.urgentDepartJours) return "Urgent";
  if (jours <= 21) return "High";
  if (jours <= 60) return "Medium";
  return "Low";
}
