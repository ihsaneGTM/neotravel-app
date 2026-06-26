/**
 * Devis AJUSTABLE — couche d'édition au-dessus du moteur déterministe.
 *
 * Le commercial peut surcharger les coefficients (saison / délai / capacité),
 * la marge et appliquer une remise commerciale. Module PUR (pas de server-only) :
 * - côté CLIENT pour l'aperçu live de l'éditeur,
 * - côté SERVEUR pour la persistance (le client n'envoie que les PARAMÈTRES,
 *   le serveur recalcule → le prix vient TOUJOURS d'ici, jamais du client).
 *
 * Le total reste multiplicatif (donc identique à l'ordre du moteur officiel) :
 *   base × marge × saison × délai × capacité → HT → (− remise) → TVA → TTC.
 */
import { MATRICES_DEFAUT, type PricingMatrices, type TypeDeplacement, type LigneDevis } from "./calculer-devis";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const diffJours = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
const parseUTC = (v: string | Date) => {
  const d = v instanceof Date ? v : new Date(`${v}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
export const pct = (coeff: number): string => {
  const delta = Math.round((coeff - 1) * 100);
  return delta === 0 ? "0 %" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} %`;
};

/** Prix de base transport (grille ≤180 km, sinon (km×2)×prix_km), ×2 si aller/retour. */
export function baseTransport(distance_km: number, type: TypeDeplacement, m: PricingMatrices = MATRICES_DEFAUT): number {
  let base: number;
  if (distance_km <= m.seuil_grille_km) {
    const row = m.forfait.find((r) => distance_km <= r.km_max);
    base = row ? row.prix : m.forfait[m.forfait.length - 1].prix;
  } else {
    base = distance_km * 2 * m.prix_km_au_dela;
  }
  return type === "aller_retour" ? base * 2 : base;
}

// ── Options proposées dans les menus déroulants (dérivées des matrices) ───────
export interface CoeffOption {
  coeff: number;
  libelle: string;
}
/** Niveaux de saison distincts (basse / moyenne / haute / très haute). */
export const SAISON_OPTIONS: CoeffOption[] = (() => {
  const seen = new Map<string, CoeffOption>();
  for (const { coeff, libelle } of Object.values(MATRICES_DEFAUT.saison)) {
    if (!seen.has(libelle)) seen.set(libelle, { coeff, libelle: `${cap1(libelle)} (${pct(coeff)})` });
  }
  return [...seen.values()].sort((a, b) => a.coeff - b.coeff);
})();
export const ANTICIPATION_OPTIONS: CoeffOption[] = MATRICES_DEFAUT.anticipation.map((a) => ({
  coeff: a.coeff,
  libelle: `${cap1(a.libelle)} (${pct(a.coeff)})`,
}));
export const CAPACITE_OPTIONS: CoeffOption[] = MATRICES_DEFAUT.capacite.map((c) => ({ coeff: c.coeff, libelle: c.libelle }));

function cap1(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Dérivation des coefficients automatiques d'une demande ───────────────────
export interface DevisAjusteParams {
  base: number;
  saison: number;
  anticipation: number;
  capacite: number;
  marge: number; // 0.15 = +15 %
  tva: number; // 0.10 = 10 %
  remise_pct?: number; // remise en % du HT (prioritaire sur l'€ si les deux fournis ? non : voir ci-dessous)
  remise_eur?: number; // remise fixe en €
  labels?: { saison?: string; anticipation?: string; capacite?: string };
  distance_km?: number;
}

export interface DeriveInput {
  distance_km: number | null;
  type_deplacement: TypeDeplacement;
  nb_voyageurs: number;
  date_depart: string;
  date_demande: string | null;
}

/** Coefficients automatiques (point de départ de l'éditeur) à partir de la demande. */
export function deriverAuto(d: DeriveInput, m: PricingMatrices = MATRICES_DEFAUT): DevisAjusteParams {
  const dist = d.distance_km && d.distance_km > 0 ? d.distance_km : 0;
  const base = dist ? baseTransport(dist, d.type_deplacement, m) : 0;

  const mois = parseUTC(d.date_depart).getUTCMonth() + 1;
  const sa = m.saison[mois] ?? { coeff: 1, libelle: "moyenne" };

  const ecart = d.date_demande ? diffJours(parseUTC(d.date_demande), parseUTC(d.date_depart)) : 9999;
  const an = m.anticipation.find((p) => ecart >= p.jours_min && (p.jours_max == null || ecart < p.jours_max)) ?? m.anticipation[m.anticipation.length - 1];

  const cap =
    m.capacite.find((p) => d.nb_voyageurs >= p.pax_min && (p.pax_max == null || d.nb_voyageurs <= p.pax_max)) ?? m.capacite[m.capacite.length - 1];

  return {
    base: round2(base),
    saison: sa.coeff,
    anticipation: an.coeff,
    capacite: cap.coeff,
    marge: m.marge,
    tva: m.tva,
    labels: { saison: `${cap1(sa.libelle)} (${pct(sa.coeff)})`, anticipation: `${cap1(an.libelle)} (${pct(an.coeff)})`, capacite: cap.libelle },
    distance_km: dist || undefined,
  };
}

export interface DevisAjusteResult {
  lignes: LigneDevis[];
  prix_ht: number; // HT net (après remise)
  remise: number; // montant de remise en €
  tva: number;
  prix_ttc: number;
}

/**
 * Recalcule le devis depuis les paramètres ajustés. Ordre d'affichage proche du
 * logiciel de devis : base → marge → saison → délai → capacité → remise → TVA.
 * Le produit étant commutatif, le HT est identique à l'ordre du moteur officiel.
 */
export function computeDevisAjuste(p: DevisAjusteParams): DevisAjusteResult {
  const lignes: LigneDevis[] = [];
  let courant = round2(p.base);
  lignes.push({ libelle: p.distance_km ? `Prix de base (${p.distance_km} km)` : "Prix de base", montant: courant });

  const step = (libelle: string, coeff: number) => {
    const next = round2(courant * coeff);
    lignes.push({ libelle, montant: round2(next - courant) });
    courant = next;
  };
  step(`Marge (${pct(1 + p.marge)})`, 1 + p.marge);
  step(`Saisonnalité ${p.labels?.saison ?? pct(p.saison)}`, p.saison);
  step(`Délai ${p.labels?.anticipation ?? pct(p.anticipation)}`, p.anticipation);
  step(`Capacité ${p.labels?.capacite ?? pct(p.capacite)}`, p.capacite);

  const htBrut = Math.round(courant); // HT arrondi à l'euro avant remise/TVA

  // Remise : € prioritaire si fourni, sinon %.
  let remise = 0;
  if (p.remise_eur && p.remise_eur > 0) remise = Math.min(round2(p.remise_eur), htBrut);
  else if (p.remise_pct && p.remise_pct > 0) remise = Math.min(round2((htBrut * p.remise_pct) / 100), htBrut);
  if (remise > 0) {
    const detail = p.remise_eur && p.remise_eur > 0 ? "" : ` (−${p.remise_pct} %)`;
    lignes.push({ libelle: `Remise commerciale${detail}`, montant: -round2(remise) });
  }

  const htNet = round2(htBrut - remise);
  const tva = round2(htNet * p.tva);
  lignes.push({ libelle: `TVA (${(p.tva * 100).toFixed(0)} %)`, montant: tva });
  const ttc = round2(htNet + tva);

  return { lignes, prix_ht: htNet, remise, tva, prix_ttc: ttc };
}
