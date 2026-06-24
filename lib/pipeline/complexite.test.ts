import { describe, it, expect } from "vitest";
import { evaluerComplexite } from "./complexite";

const today = new Date("2026-06-01T00:00:00Z");

describe("evaluerComplexite (matrice des cas)", () => {
  it("simple → estimation affichée", () => {
    const r = evaluerComplexite(
      { type_deplacement: "aller_retour", nb_voyageurs: 30, date_depart: "2026-09-01", date_retour: "2026-09-02", date_demande: "2026-06-01" },
      today
    );
    expect(r.complexite).toBe("simple");
    expect(r.afficher_estimation).toBe(true);
  });

  it("circuit → complexe (estimation masquée)", () => {
    const r = evaluerComplexite({ type_deplacement: "circuit", nb_voyageurs: 30, date_depart: "2026-09-01", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("complexe");
    expect(r.afficher_estimation).toBe(false);
  });

  it("> 85 passagers → complexe", () => {
    const r = evaluerComplexite({ type_deplacement: "aller_simple", nb_voyageurs: 90, date_depart: "2026-09-01", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("complexe");
  });

  it("< 48h → urgence", () => {
    const r = evaluerComplexite({ type_deplacement: "aller_simple", nb_voyageurs: 30, date_depart: "2026-06-02", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("urgence");
    expect(r.afficher_estimation).toBe(false);
  });

  it("retour < départ → incohérent", () => {
    const r = evaluerComplexite(
      { type_deplacement: "aller_retour", nb_voyageurs: 30, date_depart: "2026-09-10", date_retour: "2026-09-05", date_demande: "2026-06-01" },
      today
    );
    expect(r.complexite).toBe("incoherent");
  });

  it("départ passé → incohérent", () => {
    const r = evaluerComplexite({ type_deplacement: "aller_simple", nb_voyageurs: 30, date_depart: "2026-05-01", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("incoherent");
  });

  it("0 passager → incohérent", () => {
    const r = evaluerComplexite({ type_deplacement: "aller_simple", nb_voyageurs: 0, date_depart: "2026-09-01", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("incoherent");
  });

  it("borne 48h : départ à 2 jours → simple (pas urgence)", () => {
    const r = evaluerComplexite({ type_deplacement: "aller_simple", nb_voyageurs: 30, date_depart: "2026-06-03", date_demande: "2026-06-01" }, today);
    expect(r.complexite).toBe("simple");
  });
});
