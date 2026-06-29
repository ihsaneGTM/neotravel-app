import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLiveState } from "@/lib/conversations/live";

export const dynamic = "force-dynamic";

/** État live d'une conversation (mode IA/humain + transcript) — interrogé en polling par le chat du lead. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await getLiveState(supabaseAdmin, id);
  if (!state) return NextResponse.json({ mode: "ia", transcript: [], commercial: null, exists: false });
  return NextResponse.json({ ...state, exists: true }, { headers: { "cache-control": "no-store" } });
}
