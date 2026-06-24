/**
 * NeoTravel — Moteur de devis déterministe.
 *
 * RÈGLE D'OR : ce module NE FAIT AUCUN appel LLM. Le prix vient TOUJOURS d'ici.
 * L'IA décide / met en forme ; le code calcule.
 *
 * Chaîne de calcul (ORDRE imposé) :
 *   base distance (× 2 si AR, somme des étapes si circuit)
 *   → × coeff saison (selon mois de date_depart)
 *   → × coeff anticipation (selon écart date_demande → date_depart)
 *   → × coeff capacité (selon nb_passagers)
 *   → + options (additif : guide, nuit chauffeur, péages…)
 *   → sous-total HT
 *   → + marge commerciale 15 % (avant TVA)
 *   → arrondi à l'euro
 *   → + TVA 10 %
 *   → TTC
 *
 * Chaque ligne (`lignes[]`) et chaque coefficient (`coefficients[]`) est tracé
 * pour que le commercial puisse expliquer le devis (audit).
 */

// ──────────────────────────────────────────────────────────────────────────
// Types d'entrée / sortie
// ──────────────────────────────────────────────────────────────────────────

export type TypeDeplacement = "aller_simple" | "aller_retour" | "circuit";

/** Catalogue d'options additives (montant fixe ou par jour/nuit). */
export type OptionDevis =
  | { type: "guide" } //               +X € / jour de prestation
  | { type: "nuit_chauffeur" } //      +X € / nuit
  | { type: "peages"; trajet?: string }; // forfait selon trajet

export interface DevisInput {
  /** Nombre de passagers (entier strictement positif). */
  nb_passagers: number;
  /** Date de départ (ISO `YYYY-MM-DD` ou objet Date). */
  date_depart: string | Date;
  /** Date d'émission de la demande (ISO `YYYY-MM-DD` ou objet Date). */
  date_demande: string | Date;
  /** Type de déplacement ; par défaut `aller_simple`. */
  type_deplacement?: TypeDeplacement;
  /**
   * Distance en km.
   * - aller_simple / aller_retour : distance d'un aller (l'AR double en interne).
   * - circuit : facultatif si `etapes_km` est fourni (sinon distance totale).
   */
  distance_km?: number;
  /** Circuit : distances de chaque étape en km (sommées pour la base). */
  etapes_km?: number[];
  /** Date de retour (circuit / AR) — sert à déduire nb_jours et nuitées. */
  date_retour?: string | Date;
  /**
   * Nombre de jours de prestation (déduit des dates si absent).
   * Sert au coût du guide (par jour) et au plafond de nuits chauffeur.
   */
  nb_jours?: number;
  /**
   * Nombre de nuitées (déduit des dates si absent ; = nb_jours - 1, min 0).
   * Sert au coût « nuit chauffeur ».
   */
  nuitees?: number;
  /** Options additives. */
  options?: OptionDevis[];
}

export interface LigneDevis {
  libelle: string;
  /** Montant HT en euros (peut être négatif pour une remise). */
  montant: number;
}

export interface CoefficientDevis {
  nom: string;
  /** Valeur multiplicative appliquée (ex 1.10 pour +10 %). */
  valeur: number;
  /** Étiquette lisible (ex « haute (+10%) »). */
  detail?: string;
}

export interface DevisResult {
  prix_ht: number;
  tva: number;
  prix_ttc: number;
  lignes: LigneDevis[];
  coefficients: CoefficientDevis[];
  devise: "EUR";
  /** Métadonnées d'audit utiles au commercial / dashboard. */
  meta: {
    type_deplacement: TypeDeplacement;
    nb_jours: number;
    nuitees: number;
    type_vehicule: TypeVehicule;
    distance_facturee_km: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Erreur structurée
// ──────────────────────────────────────────────────────────────────────────

export type DevisErrorCode =
  | "PASSAGERS_INVALIDES" //   nb_passagers <= 0 ou non entier
  | "DATES_INVALIDES" //       date non parsable
  | "DATES_INCOHERENTES" //    retour < départ, ou départ < demande
  | "DATE_PASSEE" //           date_depart strictement avant date_demande
  | "DISTANCE_INVALIDE" //     distance manquante / <= 0
  | "CAPACITE_DEPASSEE" //     > 85 passagers ⇒ multi-véhicules (cas complexe)
  | "HORS_ZONE"; //            distance au-delà du rayon d'exploitation

export class DevisError extends Error {
  readonly code: DevisErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: DevisErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DevisError";
    this.code = code;
    this.details = details;
    // Conserve la chaîne de prototype après transpilation TS → ES5.
    Object.setPrototypeOf(this, DevisError.prototype);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Matrices de coefficients (injectables — voir note sur la représentation)
// ──────────────────────────────────────────────────────────────────────────

export type TypeVehicule = "minibus" | "autocar_standard" | "autocar_grand_tourisme";

export interface PricingMatrices {
  /** Base distance. */
  prix_par_km: number; //  ex 2.50 €/km
  prix_minimum: number; // ex 350 € (plancher de la base avant coefficients)
  /** Rayon d'exploitation max en km (au-delà ⇒ HORS_ZONE). null = pas de limite. */
  rayon_max_km: number | null;
  /** Coefficient saison par mois (clé = mois 1..12). Valeur multiplicative. */
  saison: Record<number, { coeff: number; libelle: string }>;
  /** Paliers d'anticipation, du plus urgent au plus lointain (premier match). */
  anticipation: Array<{
    code: "DD_PRIORITAIRE" | "DD_URGENT" | "DD_NORMAL" | "DD_3MOISETPLUS";
    /** Borne basse incluse, en jours (écart date_demande → date_depart). */
    jours_min: number;
    /** Borne haute exclue, en jours ; null = +∞. */
    jours_max: number | null;
    coeff: number;
    libelle: string;
  }>;
  /** Paliers de capacité, du plus petit au plus grand (premier match). */
  capacite: Array<{
    /** Borne basse incluse. */
    pax_min: number;
    /** Borne haute incluse ; null = +∞. */
    pax_max: number | null;
    coeff: number;
    libelle: string;
    type_vehicule: TypeVehicule;
  }>;
  /** Plafond passagers mono-véhicule (au-delà ⇒ CAPACITE_DEPASSEE). */
  capacite_max_mono_vehicule: number; // 85
  /** Tarifs des options. */
  options: {
    guide_par_jour: number; //          80 €
    nuit_chauffeur_par_nuit: number; // 120 €
    /** Forfait péages par défaut si non précisé via une table trajet. */
    peages_forfait_defaut: number;
  };
  /** Marge commerciale appliquée AVANT la TVA (ex 0.15). */
  marge: number;
  /** Taux de TVA (ex 0.10). */
  tva: number;
}

/**
 * Matrices par défaut, calibrées sur le devis de référence
 * (1628 € TTC — 21 pax, AR 260 km, saison haute, anticipation > 90 j).
 *
 * En production, ces valeurs sont lues depuis la table Supabase `matrices`
 * (lookup déterministe) et injectées via le 2ᵉ argument de `calculerDevis`.
 */
export const MATRICES_DEFAUT: PricingMatrices = {
  prix_par_km: 2.5,
  prix_minimum: 350,
  rayon_max_km: 1500,
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
  capacite_max_mono_vehicule: 85,
  options: {
    guide_par_jour: 80,
    nuit_chauffeur_par_nuit: 120,
    peages_forfait_defaut: 0,
  },
  marge: 0.15,
  tva: 0.1,
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** Parse une date ISO/Date en minuit UTC, ou lève DATES_INVALIDES. */
function parseDate(value: string | Date, champ: string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new DevisError("DATES_INVALIDES", `Date invalide pour le champ « ${champ} » : ${String(value)}`, {
      champ,
      valeur: value,
    });
  }
  // Normalise à minuit UTC pour des écarts en jours stables (pas d'effet fuseau).
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Nombre de jours calendaires entre deux dates (b - a). */
function diffJours(a: Date, b: Date): number {
  const MS_JOUR = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_JOUR);
}

/** Arrondi à 2 décimales (centimes) pour TVA / TTC. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ──────────────────────────────────────────────────────────────────────────
// Moteur
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calcule un devis déterministe.
 *
 * @param input  Données collectées (conversation IA + déductions).
 * @param matrices  Coefficients (par défaut : MATRICES_DEFAUT). Injectables
 *                  depuis la table Supabase `matrices` en production.
 * @throws {DevisError}  Pour tout cas non chiffrable (garde-fous métier).
 */
export function calculerDevis(input: DevisInput, matrices: PricingMatrices = MATRICES_DEFAUT): DevisResult {
  const type_deplacement: TypeDeplacement = input.type_deplacement ?? "aller_simple";

  // ── 1. Validation passagers ───────────────────────────────────────────
  if (!Number.isInteger(input.nb_passagers) || input.nb_passagers <= 0) {
    throw new DevisError("PASSAGERS_INVALIDES", "Le nombre de passagers doit être un entier strictement positif.", {
      nb_passagers: input.nb_passagers,
    });
  }
  if (input.nb_passagers > matrices.capacite_max_mono_vehicule) {
    throw new DevisError(
      "CAPACITE_DEPASSEE",
      `${input.nb_passagers} passagers > ${matrices.capacite_max_mono_vehicule} : multi-véhicules ⇒ cas complexe, pas de devis automatique.`,
      { nb_passagers: input.nb_passagers, plafond: matrices.capacite_max_mono_vehicule }
    );
  }

  // ── 2. Validation dates ────────────────────────────────────────────────
  const dDemande = parseDate(input.date_demande, "date_demande");
  const dDepart = parseDate(input.date_depart, "date_depart");
  if (dDepart < dDemande) {
    throw new DevisError("DATE_PASSEE", "La date de départ est antérieure à la date de la demande.", {
      date_demande: input.date_demande,
      date_depart: input.date_depart,
    });
  }
  let dRetour: Date | null = null;
  if (input.date_retour != null) {
    dRetour = parseDate(input.date_retour, "date_retour");
    if (dRetour < dDepart) {
      throw new DevisError("DATES_INCOHERENTES", "La date de retour est antérieure à la date de départ.", {
        date_depart: input.date_depart,
        date_retour: input.date_retour,
      });
    }
  }

  // ── 3. Déductions durée / nuitées ──────────────────────────────────────
  // nb_jours : priorité à l'input, sinon déduit des dates (min 1 jour).
  let nb_jours = input.nb_jours ?? (dRetour ? diffJours(dDepart, dRetour) + 1 : 1);
  if (nb_jours < 1) nb_jours = 1;
  // nuitees : priorité à l'input, sinon nb_jours - 1 (jamais négatif).
  const nuitees = input.nuitees ?? Math.max(0, nb_jours - 1);

  // ── 4. Base distance ───────────────────────────────────────────────────
  const lignes: LigneDevis[] = [];
  let distance_facturee_km: number;
  let base: number;

  if (type_deplacement === "circuit") {
    const etapes = input.etapes_km ?? (input.distance_km != null ? [input.distance_km] : undefined);
    if (!etapes || etapes.length === 0 || etapes.some((k) => !(k > 0))) {
      throw new DevisError("DISTANCE_INVALIDE", "Circuit : fournir des distances d'étapes strictement positives.", {
        etapes_km: input.etapes_km,
        distance_km: input.distance_km,
      });
    }
    distance_facturee_km = etapes.reduce((s, k) => s + k, 0);
    const baseBrute = distance_facturee_km * matrices.prix_par_km;
    base = Math.max(baseBrute, matrices.prix_minimum);
    lignes.push({
      libelle: `Base circuit ${etapes.length} étape(s) — ${distance_facturee_km} km × ${matrices.prix_par_km} €/km${
        base > baseBrute ? ` (plancher ${matrices.prix_minimum} €)` : ""
      }`,
      montant: base,
    });
  } else {
    const aller = input.distance_km;
    if (aller == null || !(aller > 0)) {
      throw new DevisError("DISTANCE_INVALIDE", "Distance manquante ou invalide.", { distance_km: input.distance_km });
    }
    const facteurAR = type_deplacement === "aller_retour" ? 2 : 1;
    distance_facturee_km = aller * facteurAR;
    const baseBrute = aller * matrices.prix_par_km * facteurAR;
    base = Math.max(baseBrute, matrices.prix_minimum);
    lignes.push({
      libelle: `Base ${type_deplacement === "aller_retour" ? "aller-retour" : "aller simple"} — ${aller} km${
        facteurAR === 2 ? " × 2" : ""
      } × ${matrices.prix_par_km} €/km${base > baseBrute ? ` (plancher ${matrices.prix_minimum} €)` : ""}`,
      montant: base,
    });
  }

  // Garde-fou zone d'exploitation (sur la distance facturée).
  if (matrices.rayon_max_km != null && distance_facturee_km > matrices.rayon_max_km) {
    throw new DevisError(
      "HORS_ZONE",
      `Distance ${distance_facturee_km} km au-delà du rayon d'exploitation (${matrices.rayon_max_km} km).`,
      { distance_facturee_km, rayon_max_km: matrices.rayon_max_km }
    );
  }

  // ── 5. Coefficients multiplicatifs (saison → anticipation → capacité) ──
  const coefficients: CoefficientDevis[] = [];
  let courant = base;

  // 5a. Saison (mois de date_depart, 1..12).
  const mois = dDepart.getUTCMonth() + 1;
  const sa = matrices.saison[mois];
  if (!sa) {
    throw new DevisError("DATES_INVALIDES", `Aucun coefficient saison pour le mois ${mois}.`, { mois });
  }
  coefficients.push({ nom: "saison", valeur: sa.coeff, detail: `${sa.libelle} (${pct(sa.coeff)})` });
  const apresSaison = courant * sa.coeff;
  lignes.push({ libelle: `Saison ${sa.libelle} (${pct(sa.coeff)})`, montant: round2(apresSaison - courant) });
  courant = apresSaison;

  // 5b. Anticipation (écart date_demande → date_depart, premier palier match).
  const ecart = diffJours(dDemande, dDepart);
  const an = matrices.anticipation.find(
    (p) => ecart >= p.jours_min && (p.jours_max == null || ecart < p.jours_max)
  );
  if (!an) {
    throw new DevisError("DATES_INCOHERENTES", `Aucun palier d'anticipation pour un écart de ${ecart} jours.`, {
      ecart,
    });
  }
  coefficients.push({ nom: "anticipation", valeur: an.coeff, detail: `${an.libelle} (${pct(an.coeff)})` });
  const apresAntic = courant * an.coeff;
  lignes.push({ libelle: `Anticipation ${an.libelle} (${pct(an.coeff)})`, montant: round2(apresAntic - courant) });
  courant = apresAntic;

  // 5c. Capacité (nb_passagers, premier palier match).
  const cap = matrices.capacite.find(
    (p) => input.nb_passagers >= p.pax_min && (p.pax_max == null || input.nb_passagers <= p.pax_max)
  );
  if (!cap) {
    throw new DevisError("CAPACITE_DEPASSEE", `Aucun palier de capacité pour ${input.nb_passagers} passagers.`, {
      nb_passagers: input.nb_passagers,
    });
  }
  coefficients.push({ nom: "capacite", valeur: cap.coeff, detail: `${cap.libelle}` });
  const apresCap = courant * cap.coeff;
  lignes.push({ libelle: `Capacité ${cap.libelle}`, montant: round2(apresCap - courant) });
  courant = apresCap;

  const type_vehicule = cap.type_vehicule;

  // ── 6. Options (additif) ───────────────────────────────────────────────
  for (const opt of input.options ?? []) {
    switch (opt.type) {
      case "guide": {
        const montant = matrices.options.guide_par_jour * nb_jours;
        courant += montant;
        lignes.push({
          libelle: `Option guide/accompagnateur — ${matrices.options.guide_par_jour} €/jour × ${nb_jours} j`,
          montant,
        });
        break;
      }
      case "nuit_chauffeur": {
        const montant = matrices.options.nuit_chauffeur_par_nuit * nuitees;
        courant += montant;
        lignes.push({
          libelle: `Option nuit chauffeur — ${matrices.options.nuit_chauffeur_par_nuit} €/nuit × ${nuitees} nuit(s)`,
          montant,
        });
        break;
      }
      case "peages": {
        const montant = matrices.options.peages_forfait_defaut;
        if (montant > 0) {
          courant += montant;
          lignes.push({
            libelle: `Option péages${opt.trajet ? ` (${opt.trajet})` : ""} — forfait`,
            montant,
          });
        }
        break;
      }
    }
  }

  // ── 7. Sous-total HT → marge → arrondi HT → TVA → TTC ──────────────────
  const sousTotalHT = courant;
  lignes.push({ libelle: "Sous-total HT (avant marge)", montant: round2(sousTotalHT) });

  const montantMarge = sousTotalHT * matrices.marge;
  lignes.push({ libelle: `Marge commerciale (${pct(1 + matrices.marge)})`, montant: round2(montantMarge) });
  coefficients.push({ nom: "marge", valeur: 1 + matrices.marge, detail: pct(1 + matrices.marge) });

  // Arrondi du HT à l'euro (le devis présenté au client est en euros pleins HT).
  const prix_ht = Math.round(sousTotalHT + montantMarge);
  lignes.push({ libelle: "Prix HT (arrondi)", montant: prix_ht });

  const tva = round2(prix_ht * matrices.tva);
  lignes.push({ libelle: `TVA (${pct(1 + matrices.tva).replace("+", "")})`, montant: tva });
  coefficients.push({ nom: "tva", valeur: matrices.tva, detail: `${(matrices.tva * 100).toFixed(0)}%` });

  const prix_ttc = round2(prix_ht + tva);
  lignes.push({ libelle: "Prix TTC", montant: prix_ttc });

  return {
    prix_ht,
    tva,
    prix_ttc,
    lignes,
    coefficients,
    devise: "EUR",
    meta: { type_deplacement, nb_jours, nuitees, type_vehicule, distance_facturee_km },
  };
}

/** Formate un coefficient multiplicatif en pourcentage signé (1.10 → « +10% »). */
function pct(coeff: number): string {
  const delta = Math.round((coeff - 1) * 100);
  if (delta === 0) return "0%";
  return `${delta > 0 ? "+" : ""}${delta}%`;
}
