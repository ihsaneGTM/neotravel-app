"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setConfig, RELANCES_CADENCE_KEY } from "@/lib/config/app-config";

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
