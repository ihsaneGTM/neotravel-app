import { describe, expect, it } from "vitest";
import { calculerDevis, DevisError, MATRICES_DEFAUT, type DevisInput } from "./calculer-devis";

/**
 * GOLDEN DATASET — moteur de devis NeoTravel.
 *
 * Chaque cas chiffré est calculé À LA MAIN dans le commentaire, en suivant
 * l'ORDRE : base → ×saison → ×anticipation → ×capacité → +options
 *          → sous-total HT → +marge 15% → arrondi HT → +TVA 10% → TTC.
 *
 * Matrices par défaut : prix_par_km = 2.50 €, min = 350 €, marge = 0.15, TVA = 0.10.
 * Coeffs saison : basse 0.93 | moyenne 1.00 | haute 1.10 | très haute 1.15.
 * Coeffs anticip : >90j 0.90 | 7-90j 0.95 | 2-7j 1.05 | <48h 1.10.
 * Coeffs capacité : ≤19 0.95 | 20-53 1.00 | 54-63 1.15 | 64-67 1.20 | 68-85 1.40.
 */

describe("calculerDevis — cas nominaux chiffrés", () => {
  // ── CAS 0 : DEVIS DE RÉFÉRENCE — 1628 € TTC ─────────────────────────────
  // 21 pax, AR, 260 km, départ mars (haute +10%), demande > 90j avant (-10%).
  // base = 260 × 2.50 × 2(AR)            = 1300.00
  //   × saison haute 1.10                = 1430.00
  //   × anticip >90j 0.90                = 1287.00
  //   × capacité 20-53 1.00              = 1287.00
  // sous-total HT                        = 1287.00
  //   + marge 15% (×1.15)                = 1480.05  → arrondi HT = 1480
  //   TVA 10% = 1480 × 0.10              = 148.00
  //   TTC = 1480 + 148                   = 1628.00  ✓ référence
  it("CAS 0 — référence 1628 € TTC (21 pax, AR 260 km, haute, >90j)", () => {
    const input: DevisInput = {
      nb_passagers: 21,
      type_deplacement: "aller_retour",
      distance_km: 260,
      date_demande: "2026-01-01",
      date_depart: "2026-03-15", // mars → haute ; écart 73j... attention
    };
    // 2026-01-01 → 2026-03-15 = 73 jours (< 90) ⇒ ce serait NORMAL (0.95), pas >90j.
    // On ajuste la date de demande pour garantir l'écart > 90 jours.
    input.date_demande = "2025-12-01"; // → 2026-03-15 = 104 jours > 90 ⇒ 0.90
    const r = calculerDevis(input);
    expect(r.prix_ht).toBe(1480);
    expect(r.tva).toBe(148);
    expect(r.prix_ttc).toBe(1628);
    expect(r.devise).toBe("EUR");
    // Audit : 3 coeffs métier + marge + tva.
    expect(r.coefficients.find((c) => c.nom === "saison")?.valeur).toBe(1.1);
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(0.9);
    expect(r.coefficients.find((c) => c.nom === "capacite")?.valeur).toBe(1.0);
    expect(r.meta.type_vehicule).toBe("autocar_standard");
    expect(r.meta.distance_facturee_km).toBe(520);
  });

  // ── CAS 1 : SIMPLE COMPLET — aller simple 1 journée ─────────────────────
  // 30 pax, aller simple, 150 km, départ septembre (moyenne 1.00),
  // demande 30j avant (7-90j → 0.95), capacité 20-53 (1.00).
  // base = 150 × 2.50 = 375.00
  //   × 1.00 = 375.00 ; × 0.95 = 356.25 ; × 1.00 = 356.25
  // sous-total HT = 356.25
  //   × 1.15 = 409.6875 → arrondi HT = 410
  //   TVA = 41.00 ; TTC = 451.00
  it("CAS 1 — simple complet (30 pax, AS 150 km, moyenne, normal)", () => {
    const r = calculerDevis({
      nb_passagers: 30,
      type_deplacement: "aller_simple",
      distance_km: 150,
      date_demande: "2026-08-15",
      date_depart: "2026-09-14", // septembre, écart 30j
    });
    expect(r.prix_ht).toBe(410);
    expect(r.tva).toBe(41);
    expect(r.prix_ttc).toBe(451);
  });

  // ── CAS 2 : PETIT GROUPE ≤19 (minibus) ──────────────────────────────────
  // 12 pax, AS, 80 km, départ janvier (basse 0.93), demande 30j (0.95),
  // capacité ≤19 (0.95).
  // base = 80 × 2.50 = 200 → plancher 350.00
  //   × 0.93 = 325.50 ; × 0.95 = 309.225 ; × 0.95 = 293.76375
  // sous-total HT = 293.76375
  //   × 1.15 = 337.8283 → arrondi HT = 338
  //   TVA = 33.80 ; TTC = 371.80
  it("CAS 2 — petit groupe minibus + plancher distance (12 pax, 80 km, basse)", () => {
    const r = calculerDevis({
      nb_passagers: 12,
      type_deplacement: "aller_simple",
      distance_km: 80,
      date_demande: "2026-01-01",
      date_depart: "2026-01-31", // janvier, écart 30j
    });
    expect(r.prix_ht).toBe(338);
    expect(r.tva).toBe(33.8);
    expect(r.prix_ttc).toBe(371.8);
    expect(r.meta.type_vehicule).toBe("minibus");
  });

  // ── CAS 3 : PLANCHER DISTANCE (très court trajet) ───────────────────────
  // 10 pax, AS, 20 km, départ septembre (moyenne 1.00), demande 30j (0.95),
  // capacité ≤19 (0.95).
  // base = 20 × 2.50 = 50 → plancher 350.00
  //   × 1.00 = 350.00 ; × 0.95 = 332.50 ; × 0.95 = 315.875
  // sous-total HT = 315.875
  //   × 1.15 = 363.25625 → arrondi HT = 363
  //   TVA = 36.30 ; TTC = 399.30
  it("CAS 3 — plancher distance déclenché (10 pax, 20 km, moyenne)", () => {
    const r = calculerDevis({
      nb_passagers: 10,
      type_deplacement: "aller_simple",
      distance_km: 20,
      date_demande: "2026-08-15",
      date_depart: "2026-09-14",
    });
    expect(r.prix_ht).toBe(363);
    expect(r.tva).toBe(36.3);
    expect(r.prix_ttc).toBe(399.3);
    // La 1ʳᵉ ligne mentionne le plancher.
    expect(r.lignes[0].libelle).toContain("plancher");
  });

  // ── CAS 4 : CIRCUIT MULTI-ÉTAPES + GUIDE + NUIT CHAUFFEUR ────────────────
  // 60 pax, circuit étapes [120,90,140] = 350 km, départ mars (haute 1.10),
  // demande 60j (7-90j → 0.95), capacité 54-63 (+15% → 1.15).
  // Dates : départ 2026-03-10, retour 2026-03-11 ⇒ nb_jours = 2, nuitées = 1.
  // base = 350 × 2.50 = 875.00
  //   × 1.10 = 962.50 ; × 0.95 = 914.375 ; × 1.15 = 1051.53125
  //   + guide 80 €/j × 2 = 160 ; + nuit chauffeur 120 €/nuit × 1 = 120
  // sous-total HT = 1051.53125 + 160 + 120 = 1331.53125
  //   × 1.15 = 1531.2609 → arrondi HT = 1531
  //   TVA = 153.10 ; TTC = 1684.10
  it("CAS 4 — circuit 3 étapes + guide + nuit chauffeur (60 pax, haute)", () => {
    const r = calculerDevis({
      nb_passagers: 60,
      type_deplacement: "circuit",
      etapes_km: [120, 90, 140],
      date_demande: "2026-01-09",
      date_depart: "2026-03-10",
      date_retour: "2026-03-11",
      options: [{ type: "guide" }, { type: "nuit_chauffeur" }],
    });
    expect(r.meta.nb_jours).toBe(2);
    expect(r.meta.nuitees).toBe(1);
    expect(r.prix_ht).toBe(1531);
    expect(r.tva).toBe(153.1);
    expect(r.prix_ttc).toBe(1684.1);
    expect(r.meta.type_vehicule).toBe("autocar_grand_tourisme");
    // Audit des options.
    expect(r.lignes.some((l) => l.libelle.includes("guide") && l.montant === 160)).toBe(true);
    expect(r.lignes.some((l) => l.libelle.includes("nuit chauffeur") && l.montant === 120)).toBe(true);
  });

  // ── CAS 5 : OPTION NUIT CHAUFFEUR SUR SÉJOUR 2 JOURS (AR) ────────────────
  // 40 pax, AR, 200 km, départ octobre (moyenne 1.00), demande 30j (0.95),
  // capacité 20-53 (1.00). Séjour 2 jours via dates ⇒ nuitées = 1.
  // base = 200 × 2.50 × 2 = 1000.00
  //   × 1.00 = 1000 ; × 0.95 = 950 ; × 1.00 = 950
  //   + nuit chauffeur 120 × 1 = 120
  // sous-total HT = 1070.00
  //   × 1.15 = 1230.50 → arrondi HT = 1231 (1230.50 arrondi sup)
  //   TVA = 123.10 ; TTC = 1354.10
  it("CAS 5 — nuit chauffeur sur séjour 2 jours (40 pax, AR 200 km)", () => {
    const r = calculerDevis({
      nb_passagers: 40,
      type_deplacement: "aller_retour",
      distance_km: 200,
      date_demande: "2026-09-10",
      date_depart: "2026-10-10",
      date_retour: "2026-10-11",
      options: [{ type: "nuit_chauffeur" }],
    });
    expect(r.meta.nuitees).toBe(1);
    expect(r.prix_ht).toBe(1231);
    expect(r.tva).toBe(123.1);
    expect(r.prix_ttc).toBe(1354.1);
  });

  // ── CAS 6 : CAPACITÉ 68-85 (+40%) ───────────────────────────────────────
  // 75 pax, AS, 300 km, départ octobre (moyenne 1.00), demande 5j (2-7j → 1.05),
  // capacité 68-85 (+40% → 1.40).
  // base = 300 × 2.50 = 750.00
  //   × 1.00 = 750 ; × 1.05 = 787.50 ; × 1.40 = 1102.50
  // sous-total HT = 1102.50
  //   × 1.15 = 1267.875 → arrondi HT = 1268
  //   TVA = 126.80 ; TTC = 1394.80
  it("CAS 6 — grande capacité 68-85 +40% (75 pax, urgent)", () => {
    const r = calculerDevis({
      nb_passagers: 75,
      type_deplacement: "aller_simple",
      distance_km: 300,
      date_demande: "2026-10-05",
      date_depart: "2026-10-10", // écart 5j → urgent
    });
    expect(r.prix_ht).toBe(1268);
    expect(r.tva).toBe(126.8);
    expect(r.prix_ttc).toBe(1394.8);
  });

  // ── CAS 7 : URGENCE <48h (chiffrable, mais à MASQUER côté agent) ─────────
  // 40 pax, AR, 200 km, départ mai (très haute 1.15), demande 1j avant (<48h → 1.10),
  // capacité 20-53 (1.00).
  // base = 200 × 2.50 × 2 = 1000.00
  //   × 1.15 = 1150 ; × 1.10 = 1265 ; × 1.00 = 1265
  // sous-total HT = 1265.00
  //   × 1.15 = 1454.75 → arrondi HT = 1455
  //   TVA = 145.50 ; TTC = 1600.50
  // NB : le moteur chiffre ; la POLITIQUE (<48h ⇒ pas de devis auto) est gérée
  // en amont par l'agent. Le coefficient prioritaire est bien tracé.
  it("CAS 7 — urgence <48h chiffrée (coeff prioritaire 1.10)", () => {
    const r = calculerDevis({
      nb_passagers: 40,
      type_deplacement: "aller_retour",
      distance_km: 200,
      date_demande: "2026-05-14",
      date_depart: "2026-05-15", // écart 1j → prioritaire <48h
    });
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(1.1);
    expect(r.prix_ht).toBe(1455);
    expect(r.tva).toBe(145.5);
    expect(r.prix_ttc).toBe(1600.5);
  });

  // ── CAS 8 : ANTICIPATION URGENT 2-7j borne ─────────────────────────────
  // Test de borne : écart exactement 2 jours ⇒ palier URGENT (jours_min=2 inclus),
  // PAS prioritaire (qui est jours_max=2 exclu).
  // 25 pax, AS, 100 km, départ décembre (moyenne 1.00), écart 2j (urgent 1.05).
  // base = 100 × 2.50 = 250 → plancher 350.00
  //   × 1.00 = 350 ; × 1.05 = 367.50 ; × 1.00 = 367.50
  // sous-total HT = 367.50
  //   × 1.15 = 422.625 → arrondi HT = 423
  //   TVA = 42.30 ; TTC = 465.30
  it("CAS 8 — borne anticipation : écart 2j ⇒ urgent (pas prioritaire)", () => {
    const r = calculerDevis({
      nb_passagers: 25,
      type_deplacement: "aller_simple",
      distance_km: 100,
      date_demande: "2026-12-08",
      date_depart: "2026-12-10", // écart 2j
    });
    expect(r.coefficients.find((c) => c.nom === "anticipation")?.valeur).toBe(1.05);
    expect(r.prix_ht).toBe(423);
    expect(r.prix_ttc).toBe(465.3);
  });

  // ── CAS 9 : INJECTION DE MATRICES PERSONNALISÉES ───────────────────────
  // Vérifie que les coeffs sont bien injectables (lookup déterministe externe).
  // Matrices custom : prix_par_km = 3.00, min = 0, marge = 0.20, TVA = 0.10,
  // tous coeffs neutres = 1.00.
  // 30 pax, AS, 100 km : base = 100 × 3 = 300 ; coeffs ×1 = 300
  //   × 1.20 = 360 → HT 360 ; TVA 36 ; TTC 396.
  it("CAS 9 — matrices injectées (override déterministe)", () => {
    const r = calculerDevis(
      {
        nb_passagers: 30,
        type_deplacement: "aller_simple",
        distance_km: 100,
        date_demande: "2026-09-01",
        date_depart: "2026-09-20",
      },
      {
        ...MATRICES_DEFAUT,
        prix_par_km: 3,
        prix_minimum: 0,
        marge: 0.2,
        saison: { ...MATRICES_DEFAUT.saison, 9: { coeff: 1, libelle: "neutre" } },
        anticipation: [
          { code: "DD_NORMAL", jours_min: 0, jours_max: null, coeff: 1, libelle: "neutre" },
        ],
        capacite: [
          { pax_min: 1, pax_max: 85, coeff: 1, libelle: "neutre", type_vehicule: "autocar_standard" },
        ],
      }
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
    distance_km: 150,
    date_demande: "2026-08-15",
    date_depart: "2026-09-14",
  };

  // ── CAS 10 : 0 PASSAGER ⇒ PASSAGERS_INVALIDES ──────────────────────────
  it("CAS 10 — 0 passager lève PASSAGERS_INVALIDES", () => {
    expect(() => calculerDevis({ ...baseOk, nb_passagers: 0 })).toThrowError(DevisError);
    try {
      calculerDevis({ ...baseOk, nb_passagers: 0 });
    } catch (e) {
      expect((e as DevisError).code).toBe("PASSAGERS_INVALIDES");
    }
  });

  // ── CAS 11 : PASSAGERS NON ENTIER ──────────────────────────────────────
  it("CAS 11 — passagers non entier lève PASSAGERS_INVALIDES", () => {
    try {
      calculerDevis({ ...baseOk, nb_passagers: 12.5 });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect(e).toBeInstanceOf(DevisError);
      expect((e as DevisError).code).toBe("PASSAGERS_INVALIDES");
    }
  });

  // ── CAS 12 : >85 PASSAGERS ⇒ CAPACITE_DEPASSEE (cas complexe) ───────────
  it("CAS 12 — 90 passagers lève CAPACITE_DEPASSEE", () => {
    try {
      calculerDevis({ ...baseOk, nb_passagers: 90 });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("CAPACITE_DEPASSEE");
      expect((e as DevisError).details?.plafond).toBe(85);
    }
  });

  // ── CAS 13 : RETOUR < DÉPART ⇒ DATES_INCOHERENTES ──────────────────────
  it("CAS 13 — date de retour avant départ lève DATES_INCOHERENTES", () => {
    try {
      calculerDevis({
        ...baseOk,
        type_deplacement: "aller_retour",
        date_depart: "2026-09-14",
        date_retour: "2026-09-10",
      });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("DATES_INCOHERENTES");
    }
  });

  // ── CAS 14 : DÉPART < DEMANDE (date passée) ⇒ DATE_PASSEE ───────────────
  it("CAS 14 — date de départ antérieure à la demande lève DATE_PASSEE", () => {
    try {
      calculerDevis({ ...baseOk, date_demande: "2026-09-14", date_depart: "2026-08-15" });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("DATE_PASSEE");
    }
  });

  // ── CAS 15 : DISTANCE MANQUANTE ⇒ DISTANCE_INVALIDE ────────────────────
  it("CAS 15 — distance absente lève DISTANCE_INVALIDE", () => {
    try {
      calculerDevis({ ...baseOk, distance_km: undefined });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("DISTANCE_INVALIDE");
    }
  });

  // ── CAS 16 : HORS ZONE (distance > rayon max) ⇒ HORS_ZONE ──────────────
  // rayon_max_km défaut = 1500. AR 800 km ⇒ facturée 1600 > 1500.
  it("CAS 16 — distance hors zone lève HORS_ZONE", () => {
    try {
      calculerDevis({ ...baseOk, type_deplacement: "aller_retour", distance_km: 800 });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("HORS_ZONE");
    }
  });

  // ── CAS 17 : DATE NON PARSABLE ⇒ DATES_INVALIDES ───────────────────────
  it("CAS 17 — date non parsable lève DATES_INVALIDES", () => {
    try {
      calculerDevis({ ...baseOk, date_depart: "pas-une-date" });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("DATES_INVALIDES");
    }
  });

  // ── CAS 18 : CIRCUIT SANS ÉTAPES VALIDES ⇒ DISTANCE_INVALIDE ────────────
  it("CAS 18 — circuit avec étape ≤ 0 lève DISTANCE_INVALIDE", () => {
    try {
      calculerDevis({ ...baseOk, type_deplacement: "circuit", etapes_km: [120, 0, 80] });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as DevisError).code).toBe("DISTANCE_INVALIDE");
    }
  });
});

describe("calculerDevis — invariants d'audit", () => {
  // ── CAS 19 : cohérence interne lignes / coefficients ───────────────────
  it("CAS 19 — TTC = HT + TVA et coefficients tous présents", () => {
    const r = calculerDevis({
      nb_passagers: 21,
      type_deplacement: "aller_retour",
      distance_km: 260,
      date_demande: "2025-12-01",
      date_depart: "2026-03-15",
    });
    expect(round2(r.prix_ht + r.tva)).toBe(r.prix_ttc);
    for (const nom of ["saison", "anticipation", "capacite", "marge", "tva"]) {
      expect(r.coefficients.some((c) => c.nom === nom)).toBe(true);
    }
    // La dernière ligne est toujours le TTC.
    expect(r.lignes[r.lignes.length - 1].libelle).toBe("Prix TTC");
    expect(r.lignes[r.lignes.length - 1].montant).toBe(r.prix_ttc);
  });
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
