/**
 * Purge des données de DÉMO NeoTravel (insérées par seed-demo.mjs).
 * Supprime toutes les demandes/devis/relances liées aux clients @demo.neotravel.test,
 * puis ces clients. Les vraies données ne sont pas touchées.
 *   node --env-file=.env.local scripts/purge-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEMO_DOMAIN = "demo.neotravel.test";

const { data: clients, error } = await sb.from("clients").select("id").ilike("email", `%@${DEMO_DOMAIN}`);
if (error) {
  console.error("Lecture clients démo:", error.message);
  process.exit(1);
}
const ids = (clients ?? []).map((c) => c.id);
if (!ids.length) {
  console.log("Aucune donnée de démo à purger.");
  process.exit(0);
}

// Conversations (liées au client) — supprimées explicitement (pas de cascade garantie).
const { error: convErr, count: convCount } = await sb.from("conversations").delete({ count: "exact" }).in("client_id", ids);
if (convErr) console.error("Suppression conversations:", convErr.message);

// Les demandes ont ON DELETE CASCADE sur devis/relances/attributions/statut_historique.
const { error: dErr, count: dCount } = await sb.from("demandes").delete({ count: "exact" }).in("client_id", ids);
if (dErr) console.error("Suppression demandes:", dErr.message);

const { error: cErr, count: cCount } = await sb.from("clients").delete({ count: "exact" }).in("id", ids);
if (cErr) console.error("Suppression clients:", cErr.message);

console.log(`Purge démo terminée : ${convCount ?? "?"} conversations, ${dCount ?? "?"} demandes (+ devis/relances en cascade), ${cCount ?? "?"} clients supprimés.`);
