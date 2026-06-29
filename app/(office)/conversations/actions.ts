"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendMessage, setMode, getLiveState } from "@/lib/conversations/live";

const DEFAUT = "Conseiller NeoTravel";

async function auteur(id: string): Promise<string> {
  const st = await getLiveState(supabaseAdmin, id);
  return st?.commercial ?? DEFAUT;
}

/** Le commercial prend la main : l'IA se met en pause, l'évènement est journalisé. */
export async function reprendreMain(id: string): Promise<{ ok: boolean; author: string }> {
  const author = await auteur(id);
  await setMode(supabaseAdmin, id, "humain", author);
  revalidatePath("/conversations");
  return { ok: true, author };
}

/** Le commercial rend la main à l'IA. */
export async function rendreMainIA(id: string): Promise<{ ok: boolean }> {
  const author = await auteur(id);
  await setMode(supabaseAdmin, id, "ia", author);
  revalidatePath("/conversations");
  return { ok: true };
}

/** Message écrit par le commercial (affiché à son nom, côté lead aussi). */
export async function envoyerMessageCommercial(id: string, text: string): Promise<{ ok: boolean }> {
  const t = (text ?? "").trim();
  if (!t) return { ok: false };
  const author = await auteur(id);
  await appendMessage(supabaseAdmin, id, { role: "commercial", text: t, author, at: new Date().toISOString() });
  revalidatePath("/conversations");
  return { ok: true };
}
