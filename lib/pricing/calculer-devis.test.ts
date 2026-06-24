import { describe, expect, it } from "vitest";
import { calculerDevis, DevisError, MATRICES_DEFAUT, type DevisInput, type PricingMatrices } from "./calculer-devis";

/**
 * GOLDEN DATASET — conforme à « REGLES DE CALCUL COTATION DEVIS NEOTRAVEL ».
 *
 * Chaîne : base (grille forfait ≤180km | (km×2)×2,5 au-delà ; ×2 si AR)
 *          → ×saison → ×anticipation → ×capacité
 *          → ×marge 1.15 → arrondi HT à l'euro → +TVA 10% → TTC.
 *
 * Grille (≤km → €) : 30→250, 40→320, 50→350, 60→390, 80→500, 100→580,
 *                    120→660, 150→780, 180→900.
 * Saison : basse 0.93 | moyenne 1.00 | haute 1.10 | très haute 1.15.
 * Anticip : prioritaire 1.10 | urgent 1.05 | normal 0.95 | >3mois 0.90.
 * Capacité : ≤19 0.95 | 20-53 1.00 | 54-63 1.15 | 64-67 1.20 | 68-85 1.40.
 */

describe("calculerDevis — cas nominaux chiffrés (règles officielles)", () => {
  // CAS 1 — simple grille : 100km AS, 30 pax(0%), sept(moyenne), normal(0.95)
  // 580 ×1.0 ×0.95 ×1.0 = 551 ; ×1.15 = 633.65 → HT 634 ; TVA 63.4 ; TTC 697.4
  it("CAS 1 — transfert simple grille 100 km", () => {
    const r = calculerDevis({
      nb_passagers: 30,
      type_deplacement: "aller_simple",
      distance_km: 100,
      date_demande: "2026-08-31",
      date_depart: "2026-09-30",
    });
    expect(r.meta.base_ht).toBe(580);
    expect(r.prix_ht).toBe(634);
    expect(r.tva).toBe(63.4);
    expect(r.prix_ttc).toBe(697.4);
    expect(r.meta.type_vehicule).toBe("autocar_standard");
  });

  // CAS 2 — aller/retour = simple ×2 : 100km AR, 30 pax, sept, normal
  // base 1160 ×1.0 ×0.95 ×1.0 = 1102 ; ×1.15 = 1267.3 → HT 1267 ; TTC 1393.7
  it("CAS 2 — aller/retour = transfert simple × 2", () => {
    const r = calculerDevis({
      nb_passagers: 30,
      type_deplacement: "aller_retour",
      distance_km: 100,
      date_demande: "2026-08-31",
      date_depart: "2026-09-30",
      date_retour: "2026-10-01",
    });
    expect(r.meta.base_ht).toBe(1160);
    expect(r.prix_ht).toBe(1267);
    expect(r.prix_ttc).toBe(1393.7);
  });

  // CAS 3 — minibus + saison basse : 40km AS, 12 pax(≤19 0.95), janv(0.93), normal(0.95)
  // 320 ×0.93 ×0.95 ×0.95 = 268.584 ; ×1.15 = 308.8716 → HT 309 ; TTC 339.9
  it("CAS 3 — minibus ≤19 + saison basse (40 km)", () => {
    const r = calculerDevis({
      nb_passagers: 12,
      type_deplacement: "aller_simple",
      distance_km: 40,
      date_demande: "2025-12-21",
      date_depart: "2026-01-20",
    });
    expect(r.meta.base_ht).toBe(320);
    expect(r.prix_ht).toBe(309);
    expect(r.tva).toBe(30.9);
    expect(r.prix_ttc).toBe(339.9);
    expect(r.meta.type_vehicule).toBe("minibus");
  });

  // CAS 4 — arrondi de tranche : 45km → tranche 50 → 350 ; 25 pax, oct(1.0), normal
  // 350 ×1 ×0.95 ×1 = 332.5 ; ×1.15 = 382.375 → HT 382 ; TTC 420.2
  it("CAS 4 — distance 45 km arrondie à la tranche 50 km (350 €)", () => {
    const r = calculerDevis({
      nb_passagers: 25,
      type_deplacement: "aller_simple",
      distance_km: 45,
      date_demande: "2026-09-20",
      date_depart: "2026-10-20",
    });
    expect(r.meta.base_ht).toBe(350);
    expect(r.prix_ht).toBe(382);
    expect(r.prix_ttc).toBe(420.2);
  });

  // CAS 5 — plancher ≤30km : 15km → tranche 20 → 250 ; 30 pax, sept, normal
  // 250 ×1 ×0.95 ×1 = 237.5 ; ×1.15 = 273.125 → HT 273 ; TTC 300.3
  it("CAS 5 — plancher 250 € (15 km)", () => {
    const r = calculerDevis({
      nb_passagers: 30,
      type_deplacement: "aller_simple",
      distance_km: 15,
      date_demande: "2026-08-31",
      date_depart: "2026-09-30",
    });
    expect(r.meta.base_ht).toBe(250);
    expect(r.prix_ht).toBe(273);
    expect(r.prix_ttc).toBe(300.3);
  });

  // CAS 6 — au-delà de 180 km (formule) : 200km AS, 40 pax, mars(1.10), >3mois(0.90)
  // base = (200×2)×2.5 = 1000 ; ×1.10 ×0.90 ×1.0 = 990 ; ×1.15 = 1138.5 → HT 1139 ; TTC 1252.9
  it("CAS 6 — distance > 180 km (formule (km×2)×2,5)", () => {
    const r = calculerDevis({
      nb_passagers: 40,
      type_deplacement: "aller_simple",
      distance_km: 200,
      date_demande: "2025-12-01",
      date_depart: "2026-03-15",
    });
    expect(r.meta.base_ht).toBe(1000);
    expect(r.prix_ht).toBe(1139);
    expect(r.tva).toBe(113.9);
    expect(r.prix_ttc).toBe(1252.9);
  });

  // CAS 7 — capacité +40% : 150km AS, 75 pax(68-85 1.40), sept(1.0), urgent(1.05)
  // 780 ×1.0 ×1.05 ×1.40 = 1146.6 ; ×1.15 = 1318.59 → HT 1319 ; TTC 1450.9
  it("CAS 7 — grande capacité 68-85 (+40%) + urgent", () => {
    const r = calculerDevis({
      nb_passagers: 75,
      type_deplacement: "aller_simple",
      distance_km: 150,
      date_demande: "2026-09-15",
      date_depart: "2026-09-20",
    });
    expect(r.prix_ht).toBe(1319);
    expect(r.prix_ttc).toBe(1450.9);
    expect(r.meta.type_vehicule).toBe("autocar_grand_tourisme");
  });

  // CAS 8 — AR très haute + prioritaire : 80km AR, 53 pax(0%), mai(1.15), <48h(1.10)
  // base 1000 ×1.15 ×1.10 ×1.0 = 1265 ; ×1.15 = 1454.75 → HT 1455 ; TTC 1600.5
  it("CAS 8 — AR saison très haute + prioritaire <48h", () => {
    const r = calculerDevis({
      nb_passagers: 53,
      type_deplacement: "aller_retour",
      distance_km: 80,
      date_demande: "2026-05-14",
      date_depart: "2026-05-15",
      date_retour: "2026-05-16",
    });
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(1.1);
    expect(r.prix_ht).toBe(1455);
    expect(r.prix_ttc).toBe(1600.5);
  });

  // CAS 9 — capacité +15% (54 pax) : 60km AS, oct(1.0), normal(0.95)
  // 390 ×1 ×0.95 ×1.15 = 426.075 ; ×1.15 = 489.986 → HT 490 ; TTC 539
  it("CAS 9 — capacité 54-63 (+15%)", () => {
    const r = calculerDevis({
      nb_passagers: 54,
      type_deplacement: "aller_simple",
      distance_km: 60,
      date_demande: "2026-09-20",
      date_depart: "2026-10-20",
    });
    expect(r.prix_ht).toBe(490);
    expect(r.tva).toBe(49);
    expect(r.prix_ttc).toBe(539);
    expect(r.meta.type_vehicule).toBe("autocar_grand_tourisme");
  });

  // CAS 10 — capacité +20% (65 pax) : 120km AS, juin(1.15), normal(0.95)
  // 660 ×1.15 ×0.95 ×1.20 = 865.26 ; ×1.15 = 995.049 → HT 995 ; TTC 1094.5
  it("CAS 10 — capacité 64-67 (+20%) + très haute", () => {
    const r = calculerDevis({
      nb_passagers: 65,
      type_deplacement: "aller_simple",
      distance_km: 120,
      date_demande: "2026-05-21",
      date_depart: "2026-06-20",
    });
    expect(r.prix_ht).toBe(995);
    expect(r.prix_ttc).toBe(1094.5);
  });

  // CAS 11 — borne anticipation : écart 2j ⇒ urgent (pas prioritaire)
  // 100km AS, déc(1.0), urgent(1.05). 580 ×1 ×1.05 ×1 = 609 ; ×1.15 = 700.35 → HT 700 ; TTC 770
  it("CAS 11 — borne anticipation 2j ⇒ urgent", () => {
    const r = calculerDevis({
      nb_passagers: 25,
      type_deplacement: "aller_simple",
      distance_km: 100,
      date_demande: "2026-12-01",
      date_depart: "2026-12-03",
    });
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(1.05);
    expect(r.prix_ht).toBe(700);
    expect(r.prix_ttc).toBe(770);
  });

  // CAS 12 — borne anticipation : écart 90j ⇒ >3mois (0.90)
  // 100km AS, sept(1.0). 580 ×1 ×0.90 ×1 = 522 ; ×1.15 = 600.3 → HT 600 ; TTC 660
  it("CAS 12 — borne anticipation 90j ⇒ >3 mois", () => {
    const r = calculerDevis({
      nb_passagers: 30,
      type_deplacement: "aller_simple",
      distance_km: 100,
      date_demande: "2026-07-02",
      date_depart: "2026-09-30",
    });
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(0.9);
    expect(r.prix_ht).toBe(600);
    expect(r.prix_ttc).toBe(660);
  });

  // CAS 13 — matrices injectées (lookup déterministe externe)
  // base 300, tous coeffs neutres, marge 20%. 300 ×1.20 = 360 → HT 360 ; TTC 396
  it("CAS 13 — matrices injectées (override pilotable)", () => {
    const custom: PricingMatrices = {
      ...MATRICES_DEFAUT,
      forfait: [{ km_max: 1000, prix: 300 }],
      marge: 0.2,
      saison: { ...MATRICES_DEFAUT.saison, 9: { coeff: 1, libelle: "neutre" } },
      anticipation: [{ code: "DD_NORMAL", jours_min: 0, jours_max: null, coeff: 1, libelle: "neutre" }],
      capacite: [{ pax_min: 1, pax_max: 85, coeff: 1, libelle: "neutre", type_vehicule: "autocar_standard" }],
    };
    const r = calculerDevis(
      { nb_passagers: 30, type_deplacement: "aller_simple", distance_km: 100, date_demande: "2026-09-01", date_depart: "2026-09-20" },
      custom
    );
    expect(r.prix_ht).toBe(360);
    expect(r.tva).toBe(36);
    expect(r.prix_ttc).toBe(396);
  });
});

describe("calculerDevis — garde-fous (DevisError)", () => {
  const baseOk: DevisInput = {
    nb_passagers: 30,
    type_deplacement: "aller_simple",
    distance_km: 100,
    date_demande: "2026-08-31",
    date_depart: "2026-09-30",
  };
  const codeOf = (fn: () => unknown): string => {
    try {
      fn();
      throw new Error("aurait dû lever");
    } catch (e) {
      expect(e).toBeInstanceOf(DevisError);
      return (e as DevisError).code;
    }
  };

  it("CAS 14 — 0 passager ⇒ PASSAGERS_INVALIDES", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, nb_passagers: 0 }))).toBe("PASSAGERS_INVALIDES");
  });
  it("CAS 15 — passager non entier ⇒ PASSAGERS_INVALIDES", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, nb_passagers: 12.5 }))).toBe("PASSAGERS_INVALIDES");
  });
  it("CAS 16 — > 85 passagers ⇒ CAPACITE_DEPASSEE (flux manuel)", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, nb_passagers: 90 }))).toBe("CAPACITE_DEPASSEE");
  });
  it("CAS 17 — retour < départ ⇒ DATES_INCOHERENTES", () => {
    expect(
      codeOf(() => calculerDevis({ ...baseOk, type_deplacement: "aller_retour", date_retour: "2026-09-20" }))
    ).toBe("DATES_INCOHERENTES");
  });
  it("CAS 18 — départ < demande ⇒ DATE_PASSEE", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, date_demande: "2026-09-30", date_depart: "2026-08-15" }))).toBe(
      "DATE_PASSEE"
    );
  });
  it("CAS 19 — distance absente ⇒ DISTANCE_INVALIDE", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, distance_km: undefined }))).toBe("DISTANCE_INVALIDE");
  });
  it("CAS 20 — date non parsable ⇒ DATES_INVALIDES", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, date_depart: "pas-une-date" }))).toBe("DATES_INVALIDES");
  });
  it("CAS 21 — circuit ⇒ CALCUL_MANUEL (flux commercial)", () => {
    expect(codeOf(() => calculerDevis({ ...baseOk, type_deplacement: "circuit" }))).toBe("CALCUL_MANUEL");
  });
});

describe("calculerDevis — invariants d'audit", () => {
  it("CAS 22 — TTC = HT + TVA ; coefficients présents ; dernière ligne = TTC", () => {
    const r = calculerDevis({
      nb_passagers: 40,
      type_deplacement: "aller_retour",
      distance_km: 120,
      date_demande: "2026-01-01",
      date_depart: "2026-04-15",
      date_retour: "2026-04-16",
    });
    expect(Math.round((r.prix_ht + r.tva) * 100) / 100).toBe(r.prix_ttc);
    for (const nom of ["saison", "anticipation", "capacite", "marge", "tva"]) {
      expect(r.coefficients.some((c) => c.nom === nom)).toBe(true);
    }
    expect(r.lignes[r.lignes.length - 1].libelle).toBe("Prix TTC");
    expect(r.lignes[r.lignes.length - 1].montant).toBe(r.prix_ttc);
  });
});
