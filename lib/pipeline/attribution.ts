/**
 * Attribution d'un lead à un commercial.
 *
 * Cadrage : prioriser l'effort sur les gros dossiers reste normal ; ce qu'on
 * équilibre, c'est l'OPPORTUNITÉ DE COMMISSION entre commerciaux.
 * Règle (ordre) : 1) filtre spécialité ; 2) commissions cumulées les plus
 * faibles (critère n°1) ; 3) départage par charge courante.
 */
export interface CommercialAttrib {
  id: string;
  nom: string;
  actif: boolean;
  specialites: string[]; // type_prestation pris en charge
  charge_courante: number;
  commissions_cumulees: number;
}

export interface ResultatAttribution {
  commercial: CommercialAttrib | null;
  raison: string;
}

export function attribuer(typePrestation: string, commerciaux: CommercialAttrib[]): ResultatAttribution {
  const actifs = commerciaux.filter((c) => c.actif);
  if (actifs.length === 0) return { commercial: null, raison: "aucun commercial actif disponible" };

  // 1. Spécialité (sinon repli sur tous les actifs).
  const specialistes = actifs.filter((c) => c.specialites.includes(typePrestation));
  const pool = specialistes.length > 0 ? specialistes : actifs;

  // 2. Commissions cumulées mini (critère n°1) ; 3. départage charge mini.
  const choisi = [...pool].sort(
    (a, b) => a.commissions_cumulees - b.commissions_cumulees || a.charge_courante - b.charge_courante
  )[0];

  const base = specialistes.length > 0 ? `spécialité « ${typePrestation} »` : "pool général (pas de spécialiste)";
  return {
    commercial: choisi,
    raison: `${base} → commissions cumulées les plus faibles (${choisi.commissions_cumulees} €), départage par charge`,
  };
}
