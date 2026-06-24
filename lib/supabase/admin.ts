import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase SERVEUR (clé secrète service_role, bypass RLS).
 * À n'importer QUE côté serveur (route handlers, cron) — jamais côté client.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
