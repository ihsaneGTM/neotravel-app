import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { envoyerRelanceCore } from "@/lib/relances/envoi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien : envoie toutes les relances DUES (planifiée + échéance passée).
 * Protégé par CRON_SECRET — Vercel Cron envoie automatiquement
 * l'en-tête `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = req.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "non autorisé" }, { status: 401 });
    }
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("relances")
    .select("id")
    .eq("statut", "planifiee")
    .lte("planifiee_pour", nowIso)
    .order("planifiee_pour", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  let envoyees = 0;
  let ignorees = 0;
  let echecs = 0;
  const erreurs: { id: string; error: string }[] = [];
  for (const id of ids) {
    const res = await envoyerRelanceCore(supabaseAdmin, id);
    if (res.ok) envoyees++;
    else if (res.skipped) ignorees++;
    else {
      echecs++;
      erreurs.push({ id, error: res.error });
    }
  }
  return NextResponse.json({ dues: ids.length, envoyees, ignorees, echecs, erreurs, at: nowIso });
}
