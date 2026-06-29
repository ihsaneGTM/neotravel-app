import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCORING, type ScoringConfig } from "@/lib/pipeline/scoring";

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

export const SCORING_KEY = "scoring_config";
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Config de scoring effective : valeurs enregistrées validées, sinon défauts. Éditable depuis le Workflow. */
export async function getScoringConfig(sb: SupabaseClient): Promise<ScoringConfig> {
  const v = await getConfig<Partial<ScoringConfig>>(sb, SCORING_KEY, {});
  // Les deux poids sont normalisés pour sommer à 1.
  const sla = num(v?.poids?.sla, SCORING.poids.sla, 0, 1);
  const deal = num(v?.poids?.deal, SCORING.poids.deal, 0, 1);
  const total = sla + deal || 1;
  return {
    slaTargetH: num(v?.slaTargetH, SCORING.slaTargetH, 1, 720),
    slaCurve: num(v?.slaCurve, SCORING.slaCurve, 0.2, 5),
    dealCapEur: num(v?.dealCapEur, SCORING.dealCapEur, 100, 1_000_000),
    poids: { sla: sla / total, deal: deal / total },
    urgentDepartJours: Math.round(num(v?.urgentDepartJours, SCORING.urgentDepartJours, 0, 60)),
  };
}
