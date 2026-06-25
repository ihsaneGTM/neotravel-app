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

/** Paramétrage du scoring (source unique — affiché tel quel dans le Workflow). */
export const SCORING = {
  conversionWeights: { budget: 0.4, urgency: 0.3, completeness: 0.3 },
  globalWeights: { budget: 0.35, conversion: 0.25, volume: 0.2, urgency: 0.1, completeness: 0.1 },
  dimensions: [
    { key: "budget", label: "Budget potentiel", desc: "panier estimé ÷ 8 000 € (plafonné à 100)" },
    { key: "urgency", label: "Urgence", desc: "proximité du départ : ≤ 7 j = 100, ≥ 90 j = 20" },
    { key: "volume", label: "Volume", desc: "nb voyageurs ÷ 85" },
    { key: "completeness", label: "Complétude", desc: "email, tél, commentaire, options, budget, date retour" },
    { key: "conversion", label: "Probabilité de conversion", desc: "0,4·budget + 0,3·urgence + 0,3·complétude" },
  ],
} as const;

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
  const cw = SCORING.conversionWeights;
  const conversion = clamp(budget * cw.budget + urgency * cw.urgency + completeness * cw.completeness);

  // Score global : pondération métier.
  const gw = SCORING.globalWeights;
  const score = clamp(budget * gw.budget + conversion * gw.conversion + volume * gw.volume + urgency * gw.urgency + completeness * gw.completeness);

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
