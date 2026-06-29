"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setConfig, RELANCES_CADENCE_KEY, SCORING_KEY } from "@/lib/config/app-config";

/** Met à jour la cadence des relances (jours), éditée depuis le Workflow. */
export async function setRelancesCadence(formData: FormData) {
  const raw = String(formData.get("offsets") ?? "");
  const offsets = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ).sort((a, b) => a - b);
  await setConfig(supabaseAdmin, RELANCES_CADENCE_KEY, { offsets: offsets.length ? offsets : [3] });
  revalidatePath("/workflow");
}

/** Met à jour le paramétrage du scoring (poids, cible SLA, seuil urgent). Validé à la lecture. */
export async function setScoringConfig(formData: FormData) {
  const n = (k: string) => Number(formData.get(k));
  await setConfig(supabaseAdmin, SCORING_KEY, {
    poids: { sla: n("poidsSla"), deal: n("poidsDeal") },
    slaTargetH: n("slaTargetH"),
    slaCurve: n("slaCurve"),
    dealCapEur: n("dealCapEur"),
    urgentDepartJours: n("urgentDepartJours"),
  });
  // Le scoring impacte l'inbox, le dashboard et les analytics.
  revalidatePath("/workflow");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/", "layout");
}
