import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Un message du fil : IA (assistant), prospect (user), commercial (humain) ou évènement système. */
export interface ChatMsg {
  role: "user" | "assistant" | "commercial" | "system";
  text: string;
  /** Nom affiché pour un message commercial (ou évènement système). */
  author?: string;
  /** Sous-type d'évènement système pour le rendu (ex. "takeover" | "handback"). */
  event?: "takeover" | "handback";
  /** Horodatage ISO (présent sur les messages humains/commerciaux récents). */
  at?: string;
}

/** Statut qui signale que c'est un HUMAIN qui pilote (l'IA se tait). */
export const STATUT_REPRISE = "reprise_humaine";

export type LiveMode = "ia" | "humain";
export const modeFromStatut = (statut: string | null | undefined): LiveMode => (statut === STATUT_REPRISE ? "humain" : "ia");

export interface LiveState {
  mode: LiveMode;
  statut: string;
  transcript: ChatMsg[];
  updated_at: string | null;
  commercial: string | null;
}

async function fetchConv(sb: SupabaseClient, id: string) {
  const { data } = await sb
    .from("conversations")
    .select("statut, transcript, updated_at, demandes(commerciaux(nom))")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as {
    statut: string;
    transcript: ChatMsg[] | null;
    updated_at: string | null;
    demandes: { commerciaux: { nom: string } | null } | null;
  } | null;
}

const commercialNom = (row: { demandes: { commerciaux: { nom: string } | null } | null } | null) =>
  row?.demandes?.commerciaux?.nom ?? null;

/** État live d'une conversation (mode + transcript), pour le polling des deux côtés. */
export async function getLiveState(sb: SupabaseClient, id: string): Promise<LiveState | null> {
  const row = await fetchConv(sb, id);
  if (!row) return null;
  return {
    mode: modeFromStatut(row.statut),
    statut: row.statut,
    transcript: Array.isArray(row.transcript) ? row.transcript : [],
    updated_at: row.updated_at,
    commercial: commercialNom(row),
  };
}

/** Ajoute un message au transcript (lecture-modification-écriture). Renvoie le transcript à jour. */
export async function appendMessage(sb: SupabaseClient, id: string, msg: ChatMsg): Promise<ChatMsg[] | null> {
  const row = await fetchConv(sb, id);
  if (!row) return null;
  const transcript = [...(Array.isArray(row.transcript) ? row.transcript : []), msg];
  await sb
    .from("conversations")
    .update({
      transcript,
      dernier_message: msg.text.slice(0, 280),
      nb_messages: transcript.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return transcript;
}

/** Bascule le mode (IA ↔ humain) et journalise l'évènement dans le transcript. */
export async function setMode(sb: SupabaseClient, id: string, mode: LiveMode, author: string): Promise<void> {
  const row = await fetchConv(sb, id);
  if (!row) return;
  const transcript = Array.isArray(row.transcript) ? row.transcript : [];
  const evt: ChatMsg =
    mode === "humain"
      ? { role: "system", event: "takeover", author, text: `${author} a rejoint la conversation`, at: new Date().toISOString() }
      : { role: "system", event: "handback", author, text: `L'assistant a repris la main`, at: new Date().toISOString() };
  await sb
    .from("conversations")
    .update({
      statut: mode === "humain" ? STATUT_REPRISE : "en_cours",
      transcript: [...transcript, evt],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}
