/**
 * Scoring de lead NeoTravel — 100 % déterministe, dérivé des champs réels du lead.
 * Aucune donnée inventée : chaque dimension est une fonction explicite des données.
 * 5 dimensions (0-100) + score global pondéré.
 */

export interface ScoreInput {
  valeur_panier_estimee?: number | null;
  nb_voyageurs: number;
  date_depart: string;
  date_demande?: string | null;
  date_retour?: string | null;
  options?: string[] | null;
  commentaire?: string | null;
  budget_indicatif?: number | null;
  email?: string | null;
  telephone?: string | null;
}

export interface LeadScore {
  budget: number; // Budget Potential
  urgency: number; // Urgency
  volume: number; // Volume
  completeness: number; // Completeness
  conversion: number; // Conversion Likelihood
  score: number; // global 0-100
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeScore(d: ScoreInput): LeadScore {
  // Budget : panier estimé (plafonné à 8 000 € = 100).
  const panier = Number(d.valeur_panier_estimee) || 0;
  const budget = clamp((panier / 8000) * 100);

  // Urgency : proximité du départ (≤7j = 100, ≥90j = 20).
  const dep = new Date(d.date_depart).getTime();
  const base = d.date_demande ? new Date(d.date_demande).getTime() : Date.now();
  const jours = Math.max(0, Math.round((dep - base) / 86_400_000));
  const urgency = clamp(jours <= 7 ? 100 : jours >= 90 ? 20 : 100 - ((jours - 7) / 83) * 80);

  // Volume : nb de voyageurs (85 = 100, échelle linéaire).
  const volume = clamp((d.nb_voyageurs / 85) * 100);

  // Completeness : proportion d'infos clés présentes.
  const checks = [
    !!d.email,
    !!d.telephone,
    !!d.commentaire,
    (d.options?.length ?? 0) > 0,
    d.budget_indicatif != null,
    !!d.date_retour,
  ];
  const completeness = clamp((checks.filter(Boolean).length / checks.length) * 100);

  // Conversion Likelihood : composite pondéré (budget + urgence + complétude).
  const conversion = clamp(budget * 0.4 + urgency * 0.3 + completeness * 0.3);

  // Score global : pondération métier.
  const score = clamp(budget * 0.35 + conversion * 0.25 + volume * 0.2 + urgency * 0.1 + completeness * 0.1);

  return { budget, urgency, volume, completeness, conversion, score };
}

/** Niveau d'urgence textuel (badge) à partir de l'écart en jours. */
export function niveauUrgence(date_depart: string, date_demande?: string | null): "Urgent" | "High" | "Medium" | "Low" {
  const dep = new Date(date_depart).getTime();
  const base = date_demande ? new Date(date_demande).getTime() : Date.now();
  const jours = Math.round((dep - base) / 86_400_000);
  if (jours <= 7) return "Urgent";
  if (jours <= 21) return "High";
  if (jours <= 60) return "Medium";
  return "Low";
}
