"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transitionStatut, enregistrerDevis } from "@/lib/crm";
import { calculerDevis, DevisError, type TypeDeplacement } from "@/lib/pricing/calculer-devis";
import { estimerDistanceKm } from "@/lib/geo/distance";
import { sendEmail, renderDevisEmail } from "@/lib/email/resend";

function revalidateLead(id: string) {
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

/** Change le statut d'un lead (le trigger journalise la transition dans statut_historique). */
export async function avancerStatut(formData: FormData) {
  const id = String(formData.get("id"));
  await transitionStatut(supabaseAdmin, id, String(formData.get("statut")));
  revalidateLead(id);
}

/**
 * Génère le DEVIS FERME (moteur déterministe) et le persiste — SANS l'envoyer.
 * Le statut n'est PAS passé à "Devis envoyé" : ça se fait uniquement à l'envoi réel (envoyerDevis).
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
  } catch (e) {
    if (e instanceof DevisError) throw new Error(`Devis non calculable automatiquement (${e.code}) : ${e.message}`);
    throw e;
  }
  revalidateLead(id);
}

/**
 * ENVOI RÉEL du devis ferme par email (Resend). Enregistre la PREUVE
 * (envoye_at + resend_id + destinataire + numero) puis passe le lead à "Devis envoyé".
 * Aucune fausse info : le statut "envoyé" n'est posé qu'après un envoi réussi.
 */
export async function envoyerDevis(formData: FormData) {
  const id = String(formData.get("id"));

  const [{ data: demRaw }, { data: devisRaw }] = await Promise.all([
    supabaseAdmin
      .from("demandes")
      .select("ville_depart, ville_arrivee, date_depart, date_retour, nb_voyageurs, clients(prenom, nom, email)")
      .eq("id", id)
      .single(),
    supabaseAdmin.from("devis").select("id, prix_ttc, lignes, numero").eq("demande_id", id).eq("type", "ferme").order("created_at", { ascending: false }).limit(1),
  ]);

  const dem = demRaw as unknown as {
    ville_depart: string;
    ville_arrivee: string | null;
    date_depart: string;
    date_retour: string | null;
    nb_voyageurs: number;
    clients: { prenom: string | null; nom: string | null; email: string | null } | null;
  } | null;
  const devis = (devisRaw ?? [])[0] as { id: string; prix_ttc: number; lignes: { libelle: string; montant: number }[]; numero: string | null } | undefined;

  if (!dem) throw new Error("Demande introuvable.");
  if (!devis) throw new Error("Aucun devis ferme à envoyer : générez d'abord le devis.");
  const email = dem.clients?.email;
  if (!email) throw new Error("Ce lead n'a pas d'email : impossible d'envoyer le devis.");

  const numero = devis.numero ?? `DEV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
  const client = [dem.clients?.prenom, dem.clients?.nom].filter(Boolean).join(" ") || "client";
  const trajet = dem.ville_arrivee ? `${dem.ville_depart} → ${dem.ville_arrivee}` : dem.ville_depart;
  const dates = `${dem.date_depart}${dem.date_retour ? ` → ${dem.date_retour}` : ""}`;

  const { subject, html } = renderDevisEmail({ numero, client, trajet, dates, nb_voyageurs: dem.nb_voyageurs, lignes: devis.lignes, prix_ttc: devis.prix_ttc });
  const resend_id = await sendEmail({ to: email, subject, html }); // throw si Resend KO → pas de faux "envoyé"

  await supabaseAdmin
    .from("devis")
    .update({ envoye_at: new Date().toISOString(), resend_id, destinataire: email, numero })
    .eq("id", devis.id);
  await transitionStatut(supabaseAdmin, id, "quote_sent");
  revalidateLead(id);
}
