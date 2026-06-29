"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transitionStatut } from "@/lib/crm";

/** Récupère la demande liée à un devis + ajoute une note horodatée au commentaire. */
async function noterDemande(devisId: string, note: string): Promise<string> {
  const { data: dv } = await supabaseAdmin.from("devis").select("demande_id, numero").eq("id", devisId).single();
  const d = dv as { demande_id: string; numero: string | null } | null;
  if (!d) throw new Error("Devis introuvable.");
  const { data: dem } = await supabaseAdmin.from("demandes").select("commentaire").eq("id", d.demande_id).single();
  const ligne = `${note} (devis ${d.numero ?? devisId.slice(0, 8)}, le ${new Date().toLocaleString("fr-FR")}).`;
  const commentaire = [(dem as { commentaire: string | null } | null)?.commentaire, ligne].filter(Boolean).join("\n");
  await supabaseAdmin.from("demandes").update({ commentaire }).eq("id", d.demande_id);
  return d.demande_id;
}

function revalidateAll(devisId: string) {
  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

/**
 * SIGNATURE du devis par le client (page publique). Pas de fausse info : la
 * signature fait foi → la demande passe en « Gagné » et la trace est ajoutée
 * au commentaire. Idempotent (resigner ne casse rien).
 */
export async function signerDevis(devisId: string, signataire?: string) {
  const qui = signataire?.trim() ? ` par ${signataire.trim()}` : " par le client";
  const demandeId = await noterDemande(devisId, `Devis SIGNÉ en ligne${qui}`);
  await transitionStatut(supabaseAdmin, demandeId, "won");
  revalidateAll(devisId);
}

/**
 * Le client a consulté le devis mais souhaite une MODIFICATION / un rappel →
 * la demande passe en « Négociation » (le commercial reprend la main).
 */
export async function demanderModification(devisId: string) {
  const demandeId = await noterDemande(devisId, "Le client a demandé une modification / un rappel");
  await transitionStatut(supabaseAdmin, demandeId, "negotiation");
  revalidateAll(devisId);
}
