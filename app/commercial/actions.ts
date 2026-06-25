"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transitionStatut, enregistrerDevis } from "@/lib/crm";
import { calculerDevis, DevisError, type TypeDeplacement } from "@/lib/pricing/calculer-devis";
import { estimerDistanceKm } from "@/lib/geo/distance";

/** Change le statut d'un lead (le trigger journalise la transition dans statut_historique). */
export async function avancerStatut(formData: FormData) {
  const id = String(formData.get("id"));
  const statut = String(formData.get("statut"));
  await transitionStatut(supabaseAdmin, id, statut);
  revalidatePath(`/commercial/${id}`);
  revalidatePath("/commercial");
  revalidatePath("/dashboard");
}

/**
 * Génère le DEVIS FERME (calculer_devis en mode ferme) pour un lead, le persiste
 * et passe le statut à quote_sent. Le prix vient TOUJOURS du moteur déterministe.
 */
export async function genererDevisFerme(formData: FormData) {
  const id = String(formData.get("id"));

  const { data: d, error } = await supabaseAdmin
    .from("demandes")
    .select("type_deplacement, ville_depart, ville_arrivee, date_depart, date_retour, nb_voyageurs, commercial_id, distance_km")
    .eq("id", id)
    .single();
  if (error || !d) throw new Error(`demande introuvable: ${error?.message}`);

  const dem = d as {
    type_deplacement: TypeDeplacement;
    ville_depart: string;
    ville_arrivee: string | null;
    date_depart: string;
    date_retour: string | null;
    nb_voyageurs: number;
    commercial_id: string | null;
    distance_km: number | null;
  };

  // Distance : réutilise celle stockée, sinon la recalcule depuis les villes.
  let distance = dem.distance_km ?? undefined;
  if ((distance == null || distance <= 0) && dem.ville_arrivee) {
    distance = (await estimerDistanceKm(dem.ville_depart, dem.ville_arrivee)).distance_km;
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const devis = calculerDevis({
      type_deplacement: dem.type_deplacement,
      distance_km: distance,
      nb_passagers: dem.nb_voyageurs,
      date_depart: dem.date_depart,
      date_demande: today,
      date_retour: dem.date_retour ?? undefined,
    });
    await enregistrerDevis(supabaseAdmin, id, devis, { type: "ferme", commercial_id: dem.commercial_id });
    await transitionStatut(supabaseAdmin, id, "quote_sent");
  } catch (e) {
    if (e instanceof DevisError) {
      // Cas non chiffrable (circuit, >85 pax, etc.) → reste manuel, pas de devis auto.
      throw new Error(`Devis non calculable automatiquement (${e.code}) : ${e.message}`);
    }
    throw e;
  }
  revalidatePath(`/commercial/${id}`);
  revalidatePath("/commercial");
  revalidatePath("/dashboard");
}
