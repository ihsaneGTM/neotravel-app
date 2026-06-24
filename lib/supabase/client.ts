import { createClient } from "@supabase/supabase-js";

/** Client Supabase NAVIGATEUR (clé publishable/anon, soumis au RLS). */
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
