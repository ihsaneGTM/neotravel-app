import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Lecture d'une variable de config (résiliente si la table app_config n'existe pas). */
export async function getConfig<T>(sb: SupabaseClient, key: string, fallback: T): Promise<T> {
  try {
    const { data } = await sb.from("app_config").select("value").eq("key", key).maybeSingle();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Écriture d'une variable de config. */
export async function setConfig(sb: SupabaseClient, key: string, value: unknown): Promise<void> {
  await sb.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export const RELANCES_CADENCE_KEY = "relances_cadence";
export const RELANCES_DEFAUT = [1, 3, 7];

/** Cadence des relances en jours (offsets après l'envoi du devis). Éditable depuis le Workflow. */
export async function getRelancesCadence(sb: SupabaseClient): Promise<number[]> {
  const v = await getConfig<{ offsets: number[] }>(sb, RELANCES_CADENCE_KEY, { offsets: RELANCES_DEFAUT });
  const o = Array.isArray(v?.offsets) ? v.offsets.filter((n) => Number.isFinite(n) && n > 0).map(Number) : RELANCES_DEFAUT;
  return o.length ? Array.from(new Set(o)).sort((a, b) => a - b) : RELANCES_DEFAUT;
}
