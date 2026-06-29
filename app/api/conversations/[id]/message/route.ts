import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendMessage, getLiveState } from "@/lib/conversations/live";

export const dynamic = "force-dynamic";

/**
 * Message du PROSPECT en mode reprise humaine (l'IA est en pause).
 * Le navigateur du lead poste ici au lieu d'appeler /api/chat.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const t = (text ?? "").trim();
  if (!t) return NextResponse.json({ error: "message vide" }, { status: 400 });

  const state = await getLiveState(supabaseAdmin, id);
  if (!state) return NextResponse.json({ error: "conversation introuvable" }, { status: 404 });
  // Sécurité : on n'accepte les messages directs que quand un humain pilote.
  if (state.mode !== "humain") return NextResponse.json({ error: "conversation en mode IA" }, { status: 409 });

  const transcript = await appendMessage(supabaseAdmin, id, { role: "user", text: t, at: new Date().toISOString() });
  return NextResponse.json({ ok: true, transcript });
}
