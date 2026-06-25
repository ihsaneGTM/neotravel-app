import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase SERVEUR (clé secrète service_role, bypass RLS).
 * À n'importer QUE côté serveur (route handlers, cron) — jamais côté client.
 *
 * Création PARESSEUSE : le client n'est instancié qu'au premier accès (à la
 * requête), pas au chargement du module. Cela évite l'erreur « supabaseUrl is
 * required » pendant le build Next (collecte des pages), où les variables
 * d'environnement peuvent ne pas être présentes.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (env vars)."
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
