import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWorkflowLive } from "@/lib/workflow/bricks";
import { PERIODS, type Period } from "@/lib/dashboard/office-data";

export const dynamic = "force-dynamic";

/** Compteurs funnel temps réel du Workflow (polling côté client), filtrés par période. */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams.get("period");
    const period: Period = (PERIODS.find((x) => x.key === p)?.key ?? "today") as Period;
    const live = await getWorkflowLive(supabaseAdmin, period);
    return NextResponse.json(live, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
