/**
 * Seed des commerciaux NeoTravel (fictifs, pour l'attribution + la démo).
 * Lancer : node --env-file=.env.local scripts/seed-commerciaux.mjs
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const commerciaux = [
  { nom: "Camille Roy", email: "camille@neotravel.test", specialites: ["scolaire", "tourisme"], commissions_cumulees: 1200, taux_commission: 0.05 },
  { nom: "Karim Haddad", email: "karim@neotravel.test", specialites: ["transfert", "navette"], commissions_cumulees: 800, taux_commission: 0.05 },
  { nom: "Léa Mercier", email: "lea@neotravel.test", specialites: ["seminaire", "mise_a_disposition"], commissions_cumulees: 1500, taux_commission: 0.06 },
  { nom: "Paul Bernard", email: "paul@neotravel.test", specialites: ["tourisme", "seminaire", "transfert"], commissions_cumulees: 600, taux_commission: 0.05 },
];

for (const c of commerciaux) {
  const { error } = await sb.from("commerciaux").upsert(c, { onConflict: "email" });
  console.log(c.nom, error ? "ERR " + error.message : "ok");
}
console.log("seed commerciaux terminé.");
