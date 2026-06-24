import { describe, it, expect } from "vitest";
import { attribuer, type CommercialAttrib } from "./attribution";

const c = (over: Partial<CommercialAttrib>): CommercialAttrib => ({
  id: "x",
  nom: "X",
  actif: true,
  specialites: [],
  charge_courante: 0,
  commissions_cumulees: 0,
  ...over,
});

describe("attribuer (équité de commission)", () => {
  it("filtre par spécialité", () => {
    const r = attribuer("scolaire", [
      c({ id: "a", specialites: ["tourisme"], commissions_cumulees: 0 }),
      c({ id: "b", specialites: ["scolaire"], commissions_cumulees: 999 }),
    ]);
    expect(r.commercial?.id).toBe("b"); // spécialité prime, même avec plus de commissions
  });

  it("commissions cumulées les plus faibles (critère n°1)", () => {
    const r = attribuer("transfert", [c({ id: "a", commissions_cumulees: 500 }), c({ id: "b", commissions_cumulees: 100 })]);
    expect(r.commercial?.id).toBe("b");
  });

  it("départage par charge à commission égale", () => {
    const r = attribuer("transfert", [
      c({ id: "a", commissions_cumulees: 100, charge_courante: 5 }),
      c({ id: "b", commissions_cumulees: 100, charge_courante: 2 }),
    ]);
    expect(r.commercial?.id).toBe("b");
  });

  it("ignore les commerciaux inactifs", () => {
    const r = attribuer("transfert", [c({ id: "a", actif: false, commissions_cumulees: 0 }), c({ id: "b", commissions_cumulees: 300 })]);
    expect(r.commercial?.id).toBe("b");
  });

  it("repli pool général si aucun spécialiste", () => {
    const r = attribuer("seminaire", [c({ id: "a", specialites: ["tourisme"], commissions_cumulees: 50 })]);
    expect(r.commercial?.id).toBe("a");
  });

  it("aucun commercial actif → null", () => {
    const r = attribuer("transfert", [c({ actif: false })]);
    expect(r.commercial).toBeNull();
  });
});
