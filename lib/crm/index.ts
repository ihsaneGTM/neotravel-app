import type { SupabaseClient } from "@supabase/supabase-js";
import { attribuer, type CommercialAttrib } from "../pipeline/attribution";
import type { DevisResult } from "../pricing/calculer-devis";
import type { Statut } from "../ui/statuts";

/**
 * Couche CRM — écritures serveur dans Supabase.
 * Le client Supabase est INJECTÉ (route handler → supabaseAdmin ; tests → client direct),
 * ce qui garde ces fonctions testables hors runtime Next.
 */

export interface DemandeInput {
  type_deplacement: string;
  ville_depart: string;
  ville_arrivee?: string | null;
  etapes?: string[];
  date_depart: string;
  date_retour?: string | null;
  heure_depart?: string | null;
  heure_retour?: string | null;
  nb_voyageurs: number;
  type_prestation: string;
  options?: string[];
  budget_indicatif?: number | null;
  commentaire?: string | null;
  type_client?: string;
  distance_km?: number | null;
  valeur_panier_estimee?: number | null;
  complexite?: string;
  contact?: { prenom?: string; nom?: string; email?: string; telephone?: string; consentement_rgpd?: boolean };
}

/** Crée (si contact fourni) un client puis la demande. Le trigger journalise le statut 'new'. */
export async function creerClientEtDemande(
  sb: SupabaseClient,
  input: DemandeInput
): Promise<{ demande_id: string; client_id: string | null }> {
  let client_id: string | null = null;
  const c = input.contact;
  // On exige au moins un MOYEN DE CONTACT réel (email ou téléphone) pour créer un client.
  if (c && (c.email || c.telephone)) {
    const { data: cli, error } = await sb
      .from("clients")
      .insert({
        prenom: c.prenom ?? null,
        nom: c.nom ?? "Prospect",
        email: c.email ?? null,
        telephone: c.telephone ?? null,
        type_client: input.type_client ?? "particulier",
        consentement_rgpd: c.consentement_rgpd ?? false,
        consentement_date: c.consentement_rgpd ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`client: ${error.message}`);
    client_id = (cli as { id: string }).id;
  }

  const { data: dem, error: ed } = await sb
    .from("demandes")
    .insert({
      client_id,
      type_deplacement: input.type_deplacement,
      ville_depart: input.ville_depart,
      ville_arrivee: input.ville_arrivee ?? null,
      etapes: input.etapes ?? [],
      date_depart: input.date_depart,
      date_retour: input.date_retour ?? null,
      heure_depart: input.heure_depart ?? null,
      heure_retour: input.heure_retour ?? null,
      nb_voyageurs: input.nb_voyageurs,
      type_prestation: input.type_prestation,
      options: input.options ?? [],
      budget_indicatif: input.budget_indicatif ?? null,
      commentaire: input.commentaire ?? null,
      type_client: input.type_client ?? "particulier",
      distance_km: input.distance_km ?? null,
      valeur_panier_estimee: input.valeur_panier_estimee ?? null,
      complexite: input.complexite ?? "simple",
      canal: "conversation_ia",
    })
    .select("id")
    .single();
  if (ed) throw new Error(`demande: ${ed.message}`);
  return { demande_id: (dem as { id: string }).id, client_id };
}

/**
 * Attribue la demande au bon commercial (équité de commission).
 * `statutCible` : "qualified" pour un cas simple (entre dans le flux auto),
 * "new" pour un cas complexe / demande de rappel (reste à trier par un humain).
 */
export async function attribuerDemande(
  sb: SupabaseClient,
  demande_id: string,
  type_prestation: string,
  statutCible: Statut = "qualified"
): Promise<{ commercial: CommercialAttrib | null; raison: string }> {
  const { data: coms, error } = await sb
    .from("commerciaux")
    .select("id,nom,actif,specialites,charge_courante,commissions_cumulees");
  if (error) throw new Error(`commerciaux: ${error.message}`);

  const res = attribuer(type_prestation, (coms ?? []) as CommercialAttrib[]);
  if (!res.commercial) return res;

  const com = res.commercial;
  await sb.from("demandes").update({ commercial_id: com.id, statut: statutCible }).eq("id", demande_id);
  await sb.from("attributions").insert({
    demande_id,
    commercial_id: com.id,
    motif: res.raison,
    commissions_au_moment: com.commissions_cumulees,
    charge_au_moment: com.charge_courante,
  });
  await sb.from("commerciaux").update({ charge_courante: com.charge_courante + 1 }).eq("id", com.id);
  return res;
}

/** Enregistre un devis (estimation ou ferme) lié à la demande. */
export async function enregistrerDevis(
  sb: SupabaseClient,
  demande_id: string,
  devis: DevisResult,
  opts: { type?: "estimation" | "ferme"; masque?: boolean; commercial_id?: string | null } = {}
): Promise<string> {
  const { data, error } = await sb
    .from("devis")
    .insert({
      demande_id,
      commercial_id: opts.commercial_id ?? null,
      type: opts.type ?? "estimation",
      prix_ht: devis.prix_ht,
      tva: devis.tva,
      prix_ttc: devis.prix_ttc,
      lignes: devis.lignes,
      coefficients: devis.coefficients,
      masque: opts.masque ?? false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`devis: ${error.message}`);
  return (data as { id: string }).id;
}

/** Change le statut d'une demande (le trigger journalise la transition). */
export async function transitionStatut(
  sb: SupabaseClient,
  demande_id: string,
  statut: string
): Promise<void> {
  const { error } = await sb.from("demandes").update({ statut }).eq("id", demande_id);
  if (error) throw new Error(`statut: ${error.message}`);
}
