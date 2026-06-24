/**
 * NeoTravel — Moteur de devis déterministe.
 *
 * SOURCE DE VÉRITÉ : « REGLES DE CALCUL COTATION DEVIS NEOTRAVEL ».
 * RÈGLE D'OR : ce module NE FAIT AUCUN appel LLM. Le prix vient TOUJOURS d'ici.
 *
 * Chaîne de calcul (ORDRE imposé) :
 *   1. BASE
 *      - Transfert simple (aller) :
 *          • ≤ 180 km → grille forfait par tranche de 10 km (≤30 km = 250 €).
 *          • > 180 km → (km × 2) × 2,5 € (km parcourus aller + retour à vide).
 *      - Aller/retour → transfert simple × 2.
 *      - Circuit → non tarifé automatiquement (flux manuel commercial).
 *   2. × coeff saison (mois de date_depart)
 *   3. × coeff anticipation (écart date_demande → date_depart)
 *   4. × coeff capacité (nb_passagers ; > 85 ⇒ flux manuel)
 *   5. × marge commerciale (+15 %)  → arrondi HT à l'euro
 *   6. + TVA 10 % (transport de voyageurs)  → TTC
 *
 * Tout est paramétrable (matrices injectables) — « doivent être pilotables ».
 * Chaque ligne (`lignes[]`) et coefficient (`coefficients[]`) est tracé (audit).
 */

// ──────────────────────────────────────────────────────────────────────────
// Types d'entrée / sortie
// ──────────────────────────────────────────────────────────────────────────

export type TypeDeplacement = "aller_simple" | "aller_retour" | "circuit";
export type TypeVehicule = "minibus" | "autocar_standard" | "autocar_grand_tourisme";

export interface DevisInput {
  /** Nombre de passagers (entier strictement positif ; > 85 ⇒ flux manuel). */
  nb_passagers: number;
  /** Date de départ (ISO `YYYY-MM-DD` ou Date). */
  date_depart: string | Date;
  /** Date d'émission de la demande (ISO `YYYY-MM-DD` ou Date). */
  date_demande: string | Date;
  /** Type de déplacement ; défaut `aller_simple`. */
  type_deplacement?: TypeDeplacement;
  /** Distance d'un aller, en km (la grille / formule s'applique à cet aller). */
  distance_km?: number;
  /** Date de retour (AR) — sert au contrôle de cohérence. */
  date_retour?: string | Date;
}

export interface LigneDevis {
  libelle: string;
  /** Montant HT en euros (peut être négatif : remise saison/anticipation/capacité). */
  montant: number;
}

export interface CoefficientDevis {
  nom: string;
  /** Valeur multiplicative appliquée (ex 1.10 = +10 %). */
  valeur: number;
  detail?: string;
}

export interface DevisResult {
  prix_ht: number;
  tva: number;
  prix_ttc: number;
  lignes: LigneDevis[];
  coefficients: CoefficientDevis[];
  devise: "EUR";
  meta: {
    type_deplacement: TypeDeplacement;
    type_vehicule: TypeVehicule;
    distance_km: number;
    base_ht: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Erreur structurée (garde-fous métier)
// ──────────────────────────────────────────────────────────────────────────

export type DevisErrorCode =
  | "PASSAGERS_INVALIDES" //   nb_passagers <= 0 ou non entier
  | "CAPACITE_DEPASSEE" //     > 85 passagers ⇒ multi-véhicules / flux manuel
  | "DATES_INVALIDES" //       date non parsable / mois inconnu
  | "DATES_INCOHERENTES" //    retour < départ
  | "DATE_PASSEE" //           départ < demande
  | "DISTANCE_INVALIDE" //     distance manquante / <= 0
  | "CALCUL_MANUEL"; //        circuit ⇒ non tarifé automatiquement (commercial)

export class DevisError extends Error {
  readonly code: DevisErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: DevisErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DevisError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DevisError.prototype);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Matrices (injectables — table Supabase `matrices` en production)
// ──────────────────────────────────────────────────────────────────────────

export interface PricingMatrices {
  /** Grille forfait transfert simple : tranches `km_max` croissantes (≤ 180). */
  forfait: Array<{ km_max: number; prix: number }>;
  /** Seuil de bascule grille → formule (180 km). */
  seuil_grille_km: number;
  /** Au-delà du seuil : (km × 2) × prix_km_au_dela. */
  prix_km_au_dela: number;
  /** Coefficient saison par mois (1..12). */
  saison: Record<number, { coeff: number; libelle: string }>;
  /** Paliers d'anticipation, du plus urgent au plus lointain (premier match). */
  anticipation: Array<{
    code: "DD_PRIORITAIRE" | "DD_URGENT" | "DD_NORMAL" | "DD_3MOISETPLUS";
    jours_min: number; // borne basse incluse (écart date_demande → date_depart)
    jours_max: number | null; // borne haute exclue ; null = +∞
    coeff: number;
    libelle: string;
  }>;
  /** Paliers de capacité, du plus petit au plus grand (premier match). */
  capacite: Array<{
    pax_min: number; // borne basse incluse
    pax_max: number | null; // borne haute incluse
    coeff: number;
    libelle: string;
    type_vehicule: TypeVehicule;
  }>;
  /** Plafond passagers mono-flux (au-delà ⇒ CAPACITE_DEPASSEE / flux manuel). */
  capacite_max: number; // 85
  /** Marge commerciale appliquée AVANT la TVA (0.15 = +15 %). */
  marge: number;
  /** Taux de TVA (0.10 = 10 %). */
  tva: number;
}

/** Matrices par défaut — strictement conformes aux règles officielles NeoTravel. */
export const MATRICES_DEFAUT: PricingMatrices = {
  // Grille forfait transfert simple jusqu'à 180 km (≤30 km = 250 € plancher).
  forfait: [
    { km_max: 10, prix: 250 },
    { km_max: 20, prix: 250 },
    { km_max: 30, prix: 250 },
    { km_max: 40, prix: 320 },
    { km_max: 50, prix: 350 },
    { km_max: 60, prix: 390 },
    { km_max: 70, prix: 430 },
    { km_max: 80, prix: 500 },
    { km_max: 90, prix: 540 },
    { km_max: 100, prix: 580 },
    { km_max: 110, prix: 620 },
    { km_max: 120, prix: 660 },
    { km_max: 130, prix: 700 },
    { km_max: 140, prix: 740 },
    { km_max: 150, prix: 780 },
    { km_max: 160, prix: 820 },
    { km_max: 170, prix: 860 },
    { km_max: 180, prix: 900 },
  ],
  seuil_grille_km: 180,
  prix_km_au_dela: 2.5,
  saison: {
    1: { coeff: 0.93, libelle: "basse" }, //   janvier
    2: { coeff: 0.93, libelle: "basse" }, //   février
    3: { coeff: 1.1, libelle: "haute" }, //    mars
    4: { coeff: 1.1, libelle: "haute" }, //    avril
    5: { coeff: 1.15, libelle: "très haute" }, // mai
    6: { coeff: 1.15, libelle: "très haute" }, // juin
    7: { coeff: 1.1, libelle: "haute" }, //    juillet
    8: { coeff: 0.93, libelle: "basse" }, //   août
    9: { coeff: 1.0, libelle: "moyenne" }, //  septembre
    10: { coeff: 1.0, libelle: "moyenne" }, // octobre
    11: { coeff: 0.93, libelle: "basse" }, //  novembre
    12: { coeff: 1.0, libelle: "moyenne" }, // décembre
  },
  // Seuils en jours non fournis par le doc (« pilotables ») — interprétation retenue.
  anticipation: [
    { code: "DD_PRIORITAIRE", jours_min: 0, jours_max: 2, coeff: 1.1, libelle: "prioritaire (<48h)" },
    { code: "DD_URGENT", jours_min: 2, jours_max: 7, coeff: 1.05, libelle: "urgent (2-7j)" },
    { code: "DD_NORMAL", jours_min: 7, jours_max: 90, coeff: 0.95, libelle: "normal (7j-3mois)" },
    { code: "DD_3MOISETPLUS", jours_min: 90, jours_max: null, coeff: 0.9, libelle: "anticipé (>3mois)" },
  ],
  capacite: [
    { pax_min: 1, pax_max: 19, coeff: 0.95, libelle: "≤19 (-5%)", type_vehicule: "minibus" },
    { pax_min: 20, pax_max: 53, coeff: 1.0, libelle: "20-53 (0%)", type_vehicule: "autocar_standard" },
    { pax_min: 54, pax_max: 63, coeff: 1.15, libelle: "54-63 (+15%)", type_vehicule: "autocar_grand_tourisme" },
    { pax_min: 64, pax_max: 67, coeff: 1.2, libelle: "64-67 (+20%)", type_vehicule: "autocar_grand_tourisme" },
    { pax_min: 68, pax_max: 85, coeff: 1.4, libelle: "68-85 (+40%)", type_vehicule: "autocar_grand_tourisme" },
  ],
  capacite_max: 85,
  marge: 0.15,
  tva: 0.1,
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function parseDate(value: string | Date, champ: string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new DevisError("DATES_INVALIDES", `Date invalide pour « ${champ} » : ${String(value)}`, { champ, valeur: value });
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function diffJours(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function pct(coeff: number): string {
  const delta = Math.round((coeff - 1) * 100);
  return delta === 0 ? "0%" : `${delta > 0 ? "+" : ""}${delta}%`;
}

/** Prix de base d'un transfert simple (aller) selon grille / formule. */
function transfertSimple(distance_km: number, m: PricingMatrices): { base: number; libelle: string } {
  if (distance_km <= m.seuil_grille_km) {
    const row = m.forfait.find((r) => distance_km <= r.km_max);
    if (!row) {
      throw new DevisError("DISTANCE_INVALIDE", `Pas de tranche forfait pour ${distance_km} km.`, { distance_km });
    }
    return { base: row.prix, libelle: `Forfait transfert simple — ≤ ${row.km_max} km` };
  }
  const base = distance_km * 2 * m.prix_km_au_dela;
  return {
    base,
    libelle: `Transfert simple > ${m.seuil_grille_km} km — (${distance_km} × 2) × ${m.prix_km_au_dela} €/km`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Moteur
// ──────────────────────────────────────────────────────────────────────────

export function calculerDevis(input: DevisInput, matrices: PricingMatrices = MATRICES_DEFAUT): DevisResult {
  const type_deplacement: TypeDeplacement = input.type_deplacement ?? "aller_simple";

  // ── 1. Circuit ⇒ flux manuel (non couvert par les règles de cotation auto) ──
  if (type_deplacement === "circuit") {
    throw new DevisError(
      "CALCUL_MANUEL",
      "Un circuit (multi-étapes) n'est pas tarifé automatiquement : transfert vers un commercial.",
      { type_deplacement }
    );
  }

  // ── 2. Validation passagers ─────────────────────────────────────────────
  if (!Number.isInteger(input.nb_passagers) || input.nb_passagers <= 0) {
    throw new DevisError("PASSAGERS_INVALIDES", "Le nombre de passagers doit être un entier strictement positif.", {
      nb_passagers: input.nb_passagers,
    });
  }
  if (input.nb_passagers > matrices.capacite_max) {
    throw new DevisError(
      "CAPACITE_DEPASSEE",
      `${input.nb_passagers} passagers > ${matrices.capacite_max} : multi-véhicules ⇒ flux manuel commercial.`,
      { nb_passagers: input.nb_passagers, plafond: matrices.capacite_max }
    );
  }

  // ── 3. Validation dates ─────────────────────────────────────────────────
  const dDemande = parseDate(input.date_demande, "date_demande");
  const dDepart = parseDate(input.date_depart, "date_depart");
  if (dDepart < dDemande) {
    throw new DevisError("DATE_PASSEE", "La date de départ est antérieure à la date de la demande.", {
      date_demande: input.date_demande,
      date_depart: input.date_depart,
    });
  }
  if (input.date_retour != null) {
    const dRetour = parseDate(input.date_retour, "date_retour");
    if (dRetour < dDepart) {
      throw new DevisError("DATES_INCOHERENTES", "La date de retour est antérieure à la date de départ.", {
        date_depart: input.date_depart,
        date_retour: input.date_retour,
      });
    }
  }

  // ── 4. Validation distance ──────────────────────────────────────────────
  const distance = input.distance_km;
  if (distance == null || !(distance > 0)) {
    throw new DevisError("DISTANCE_INVALIDE", "Distance manquante ou invalide.", { distance_km: input.distance_km });
  }

  // ── 5. Base (transfert simple, × 2 si aller/retour) ─────────────────────
  const lignes: LigneDevis[] = [];
  const ts = transfertSimple(distance, matrices);
  const base = type_deplacement === "aller_retour" ? ts.base * 2 : ts.base;
  lignes.push({
    libelle: type_deplacement === "aller_retour" ? `${ts.libelle} × 2 (aller/retour)` : ts.libelle,
    montant: round2(base),
  });

  // ── 6. Coefficients multiplicatifs (saison → anticipation → capacité) ────
  const coefficients: CoefficientDevis[] = [];
  let courant = base;

  const mois = dDepart.getUTCMonth() + 1;
  const sa = matrices.saison[mois];
  if (!sa) throw new DevisError("DATES_INVALIDES", `Aucun coefficient saison pour le mois ${mois}.`, { mois });
  coefficients.push({ nom: "saison", valeur: sa.coeff, detail: `${sa.libelle} (${pct(sa.coeff)})` });
  const apresSaison = courant * sa.coeff;
  lignes.push({ libelle: `Saison ${sa.libelle} (${pct(sa.coeff)})`, montant: round2(apresSaison - courant) });
  courant = apresSaison;

  const ecart = diffJours(dDemande, dDepart);
  const an = matrices.anticipation.find((p) => ecart >= p.jours_min && (p.jours_max == null || ecart < p.jours_max));
  if (!an) throw new DevisError("DATES_INCOHERENTES", `Aucun palier d'anticipation pour un écart de ${ecart} jours.`, { ecart });
  coefficients.push({ nom: "anticipation", valeur: an.coeff, detail: `${an.libelle} (${pct(an.coeff)})` });
  const apresAntic = courant * an.coeff;
  lignes.push({ libelle: `Anticipation ${an.libelle} (${pct(an.coeff)})`, montant: round2(apresAntic - courant) });
  courant = apresAntic;

  const cap = matrices.capacite.find(
    (p) => input.nb_passagers >= p.pax_min && (p.pax_max == null || input.nb_passagers <= p.pax_max)
  );
  if (!cap) throw new DevisError("CAPACITE_DEPASSEE", `Aucun palier de capacité pour ${input.nb_passagers} passagers.`, { nb_passagers: input.nb_passagers });
  coefficients.push({ nom: "capacite", valeur: cap.coeff, detail: cap.libelle });
  const apresCap = courant * cap.coeff;
  lignes.push({ libelle: `Capacité ${cap.libelle}`, montant: round2(apresCap - courant) });
  courant = apresCap;

  // ── 7. Sous-total HT → marge → arrondi HT → TVA → TTC ───────────────────
  const sousTotalHT = courant;
  lignes.push({ libelle: "Sous-total HT (avant marge)", montant: round2(sousTotalHT) });

  coefficients.push({ nom: "marge", valeur: 1 + matrices.marge, detail: pct(1 + matrices.marge) });
  lignes.push({ libelle: `Marge commerciale (${pct(1 + matrices.marge)})`, montant: round2(sousTotalHT * matrices.marge) });

  const prix_ht = Math.round(sousTotalHT * (1 + matrices.marge));
  lignes.push({ libelle: "Prix HT (arrondi)", montant: prix_ht });

  coefficients.push({ nom: "tva", valeur: 1 + matrices.tva, detail: `${(matrices.tva * 100).toFixed(0)}%` });
  const tva = round2(prix_ht * matrices.tva);
  lignes.push({ libelle: `TVA (${(matrices.tva * 100).toFixed(0)}%)`, montant: tva });

  const prix_ttc = round2(prix_ht + tva);
  lignes.push({ libelle: "Prix TTC", montant: prix_ttc });

  return {
    prix_ht,
    tva,
    prix_ttc,
    lignes,
    coefficients,
    devise: "EUR",
    meta: { type_deplacement, type_vehicule: cap.type_vehicule, distance_km: distance, base_ht: round2(base) },
  };
}
