"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transitionStatut, enregistrerDevis } from "@/lib/crm";
import { calculerDevis, DevisError, type TypeDeplacement } from "@/lib/pricing/calculer-devis";
import {
  computeDevisAjuste,
  baseTransport,
  pct,
  SAISON_OPTIONS,
  ANTICIPATION_OPTIONS,
  CAPACITE_OPTIONS,
  type CoeffOption,
} from "@/lib/pricing/devis-ajuste";
import { estimerDistanceKm } from "@/lib/geo/distance";
import { sendEmail, renderDevisEmail } from "@/lib/email/resend";
import { generateDevisPDF } from "@/lib/pdf/devis-pdf";
import { getRelancesCadence } from "@/lib/config/app-config";

const TYPE_LABEL: Record<string, string> = {
  aller_simple: "Aller simple",
  aller_retour: "Aller-retour",
  circuit: "Circuit multi-étapes",
};
/** Libellé véhicule client (dérivé du nombre de passagers, aligné sur la matrice capacité). */
function vehiculeLabel(nb: number): string {
  if (nb <= 19) return "Minibus";
  if (nb <= 53) return "Autocar standard";
  return "Autocar grand tourisme";
}
const dateFR = (iso: string) => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

function revalidateLead(id: string) {
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout"); // rafraîchit la pastille d'actions de la sidebar
}

/**
 * Édition manuelle d'une DEMANDE par le commercial : corrige les infos extraites
 * par l'IA (trajet, étapes, distance, dates, voyageurs, type), ajoute une note.
 * Ne touche PAS au statut.
 *
 * Distance : si le commercial saisit une valeur, elle prime (override manuel) ;
 * sinon, si le trajet a changé (départ / arrivée / étapes), on remet distance_km
 * à null pour forcer un recalcul automatique au prochain devis.
 */
export async function modifierDemande(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) throw new Error("id manquant.");

  const str = (k: string) => {
    const v = formData.get(k);
    return v == null ? null : String(v).trim() || null;
  };
  const ville_depart = str("ville_depart");
  const ville_arrivee = str("ville_arrivee");
  const etapes = (str("etapes") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const date_depart = str("date_depart");
  const date_retour = str("date_retour");
  const type_deplacement = str("type_deplacement");
  const type_prestation = str("type_prestation");
  const commentaire = str("commentaire");
  const nb = Number(formData.get("nb_voyageurs"));
  const distRaw = str("distance_km");
  const distManuelle = distRaw != null ? Number(distRaw) : null;

  if (!ville_depart) throw new Error("La ville de départ est obligatoire.");
  if (!Number.isFinite(nb) || nb <= 0) throw new Error("Le nombre de voyageurs doit être supérieur à 0.");
  if (date_retour && date_depart && date_retour < date_depart) throw new Error("La date de retour est antérieure au départ.");
  if (distManuelle != null && (!Number.isFinite(distManuelle) || distManuelle <= 0)) throw new Error("La distance doit être un nombre de kilomètres positif.");

  // État courant : a-t-on touché au trajet (→ recalcul distance si pas d'override) ?
  const { data: cur } = await supabaseAdmin.from("demandes").select("ville_arrivee, etapes").eq("id", id).single();
  const c = cur as { ville_arrivee: string | null; etapes: string[] | null } | null;
  const trajetChange = (c?.ville_arrivee ?? null) !== ville_arrivee || (c?.etapes ?? []).join("|") !== etapes.join("|");

  const patch: Record<string, unknown> = {
    ville_depart,
    ville_arrivee,
    etapes,
    date_depart,
    date_retour,
    nb_voyageurs: nb,
    type_deplacement,
    type_prestation,
    commentaire,
  };
  if (distManuelle != null) patch.distance_km = Math.round(distManuelle); // override manuel prioritaire
  else if (trajetChange) patch.distance_km = null; // forcera le recalcul au prochain devis

  const { error } = await supabaseAdmin.from("demandes").update(patch).eq("id", id);
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
  revalidateLead(id);
}

/** Change le statut d'un lead (le trigger journalise la transition dans statut_historique). */
export async function avancerStatut(formData: FormData) {
  const id = String(formData.get("id"));
  await transitionStatut(supabaseAdmin, id, String(formData.get("statut")));
  revalidateLead(id);
}

/**
 * Calcule le DEVIS FERME (moteur déterministe) et le persiste. Réutilisé par
 * la génération manuelle et par l'envoi (qui le crée à la volée si absent).
 */
async function calculerEtEnregistrerFerme(id: string) {
  const { data: d, error } = await supabaseAdmin
    .from("demandes")
    .select("type_deplacement, ville_depart, ville_arrivee, etapes, date_depart, date_retour, nb_voyageurs, commercial_id, distance_km")
    .eq("id", id)
    .single();
  if (error || !d) throw new Error(`demande introuvable: ${error?.message}`);
  const dem = d as {
    type_deplacement: TypeDeplacement;
    ville_depart: string;
    ville_arrivee: string | null;
    etapes: string[] | null;
    date_depart: string;
    date_retour: string | null;
    nb_voyageurs: number;
    commercial_id: string | null;
    distance_km: number | null;
  };

  let distance = dem.distance_km ?? undefined;
  if ((distance == null || distance <= 0) && dem.ville_arrivee) {
    // Distance sur tout le trajet (départ → étapes → arrivée).
    distance = (await estimerDistanceKm([dem.ville_depart, ...(dem.etapes ?? []), dem.ville_arrivee])).distance_km;
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
}

/**
 * Génère le DEVIS FERME et le persiste — SANS l'envoyer.
 * Le statut n'est PAS passé à "Devis envoyé" : ça se fait uniquement à l'envoi réel (envoyerDevis).
 */
export async function genererDevisFerme(formData: FormData) {
  const id = String(formData.get("id"));
  await calculerEtEnregistrerFerme(id);
  revalidateLead(id);
}

export interface DevisAjusteInput {
  id: string;
  saison: number;
  anticipation: number;
  capacite: number;
  marge: number; // 0.15 = +15 %
  remise_pct?: number;
  remise_eur?: number;
}

const labelDe = (opts: CoeffOption[], coeff: number) => opts.find((o) => o.coeff === coeff)?.libelle ?? pct(coeff);

/**
 * Enregistre un DEVIS FERME ajusté par le commercial (éditeur de devis).
 * AUTORITÉ SERVEUR : le client n'envoie que les PARAMÈTRES (coefficients, marge,
 * remise) ; la base et le prix sont recalculés ici depuis la demande. Remplace
 * le précédent devis ferme NON envoyé (on n'écrase jamais un devis déjà transmis).
 */
export async function enregistrerDevisAjuste(input: DevisAjusteInput) {
  const { id } = input;
  if (!id) throw new Error("id manquant.");

  const { data: d, error } = await supabaseAdmin
    .from("demandes")
    .select("type_deplacement, ville_depart, ville_arrivee, etapes, nb_voyageurs, distance_km, commercial_id")
    .eq("id", id)
    .single();
  if (error || !d) throw new Error(`demande introuvable: ${error?.message}`);
  const dem = d as {
    type_deplacement: TypeDeplacement;
    ville_depart: string;
    ville_arrivee: string | null;
    etapes: string[] | null;
    nb_voyageurs: number;
    distance_km: number | null;
    commercial_id: string | null;
  };

  // Distance : stockée si dispo, sinon estimée sur tout le trajet (et persistée).
  let distance = dem.distance_km ?? undefined;
  if ((distance == null || distance <= 0) && dem.ville_arrivee) {
    distance = (await estimerDistanceKm([dem.ville_depart, ...(dem.etapes ?? []), dem.ville_arrivee])).distance_km;
    if (distance) await supabaseAdmin.from("demandes").update({ distance_km: distance }).eq("id", id);
  }
  if (!distance || distance <= 0) throw new Error("Distance inconnue : renseignez-la dans « Modifier la demande » avant d'éditer le devis.");

  const base = baseTransport(distance, dem.type_deplacement);
  const result = computeDevisAjuste({
    base,
    distance_km: distance,
    saison: input.saison,
    anticipation: input.anticipation,
    capacite: input.capacite,
    marge: input.marge,
    tva: 0.1,
    remise_pct: input.remise_pct,
    remise_eur: input.remise_eur,
    labels: {
      saison: labelDe(SAISON_OPTIONS, input.saison),
      anticipation: labelDe(ANTICIPATION_OPTIONS, input.anticipation),
      capacite: labelDe(CAPACITE_OPTIONS, input.capacite),
    },
  });

  // Trace les paramètres (pour réédition) dans `coefficients`.
  const coefficients = [
    { nom: "saison", valeur: input.saison },
    { nom: "anticipation", valeur: input.anticipation },
    { nom: "capacite", valeur: input.capacite },
    { nom: "marge", valeur: input.marge },
    { nom: "tva", valeur: 0.1 },
    { nom: "remise_pct", valeur: input.remise_pct ?? 0 },
    { nom: "remise_eur", valeur: input.remise_eur ?? 0 },
  ];

  // Remplace le ferme NON envoyé existant (jamais un devis déjà transmis).
  await supabaseAdmin.from("devis").delete().eq("demande_id", id).eq("type", "ferme").is("envoye_at", null);
  const { error: insErr } = await supabaseAdmin.from("devis").insert({
    demande_id: id,
    commercial_id: dem.commercial_id,
    type: "ferme",
    prix_ht: result.prix_ht,
    tva: result.tva,
    prix_ttc: result.prix_ttc,
    lignes: result.lignes,
    coefficients,
    masque: false,
  });
  if (insErr) throw new Error(`Enregistrement du devis impossible : ${insErr.message}`);
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
      .select("type_deplacement, ville_depart, ville_arrivee, etapes, date_depart, date_retour, nb_voyageurs, clients(prenom, nom, email, telephone)")
      .eq("id", id)
      .single(),
    supabaseAdmin.from("devis").select("id, prix_ttc, lignes, numero").eq("demande_id", id).eq("type", "ferme").order("created_at", { ascending: false }).limit(1),
  ]);

  const dem = demRaw as unknown as {
    type_deplacement: string;
    ville_depart: string;
    ville_arrivee: string | null;
    etapes: string[] | null;
    date_depart: string;
    date_retour: string | null;
    nb_voyageurs: number;
    clients: { prenom: string | null; nom: string | null; email: string | null; telephone: string | null } | null;
  } | null;
  let devis = (devisRaw ?? [])[0] as { id: string; prix_ttc: number; lignes: { libelle: string; montant: number }[]; numero: string | null } | undefined;

  if (!dem) throw new Error("Demande introuvable.");
  // Aucun devis ferme encore calculé : on le génère à la volée avant d'envoyer.
  if (!devis) {
    await calculerEtEnregistrerFerme(id);
    const { data: regen } = await supabaseAdmin
      .from("devis")
      .select("id, prix_ttc, lignes, numero")
      .eq("demande_id", id)
      .eq("type", "ferme")
      .order("created_at", { ascending: false })
      .limit(1);
    devis = (regen ?? [])[0] as { id: string; prix_ttc: number; lignes: { libelle: string; montant: number }[]; numero: string | null } | undefined;
  }
  if (!devis) throw new Error("Devis ferme non calculable automatiquement pour ce lead.");
  const email = dem.clients?.email;
  if (!email) throw new Error("Ce lead n'a pas d'email : impossible d'envoyer le devis.");

  const numero = devis.numero ?? `DEV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
  const client = [dem.clients?.prenom, dem.clients?.nom].filter(Boolean).join(" ") || "client";
  const trajet = [dem.ville_depart, ...((dem.etapes ?? []).filter(Boolean)), ...(dem.ville_arrivee ? [dem.ville_arrivee] : [])].join(" → ");
  const dates = `${dateFR(dem.date_depart)}${dem.date_retour ? ` → ${dateFR(dem.date_retour)}` : ""}`;

  // PDF client (version simple, sans le détail interne des coefficients) — en pièce jointe.
  const pdf = await generateDevisPDF({
    numero,
    dateDevis: dateFR(new Date().toISOString().slice(0, 10)),
    client: { nom: client, email, telephone: dem.clients?.telephone ?? null },
    trajet,
    typeLabel: TYPE_LABEL[dem.type_deplacement] ?? dem.type_deplacement,
    dateDepart: dateFR(dem.date_depart),
    dateRetour: dem.date_retour ? dateFR(dem.date_retour) : null,
    nbVoyageurs: dem.nb_voyageurs,
    nbVehicules: 1,
    nbChauffeurs: 1,
    vehiculeLabel: vehiculeLabel(dem.nb_voyageurs),
    prixTTC: devis.prix_ttc,
    inclus: ["Frais de chauffeur", "Assurance responsabilité civile professionnelle", "Mise à disposition du véhicule"],
    aCharge: ["Péages autoroutiers", "Parkings éventuels"],
  });

  const { subject, html } = renderDevisEmail({ numero, client, trajet, dates, nb_voyageurs: dem.nb_voyageurs, prix_ttc: devis.prix_ttc });
  const resend_id = await sendEmail({
    to: email,
    subject,
    html,
    attachments: [{ filename: `Devis-NeoTravel-${numero}.pdf`, content: pdf }],
  }); // throw si Resend KO → pas de faux "envoyé"

  await supabaseAdmin
    .from("devis")
    .update({ envoye_at: new Date().toISOString(), resend_id, destinataire: email, numero })
    .eq("id", devis.id);
  await transitionStatut(supabaseAdmin, id, "quote_sent");
  // Planifie les relances selon la cadence configurable (Workflow → Relances).
  const cadence = await getRelancesCadence(supabaseAdmin);
  const typeFor = (n: number) => (n === 1 ? "j1" : n === 3 ? "j3" : n === 7 ? "j7" : "relance_personnalisee");
  const relances = cadence.map((n) => ({
    demande_id: id,
    devis_id: devis.id,
    type: typeFor(n),
    statut: "planifiee",
    planifiee_pour: new Date(Date.now() + n * 86_400_000).toISOString(),
    canal: "email",
    destinataire: email,
    objet: `Relance J+${n} — devis ${numero}`,
  }));
  if (relances.length) await supabaseAdmin.from("relances").insert(relances);
  revalidateLead(id);
  revalidatePath("/follow-ups");
}

/** Marque une relance comme effectuée. */
export async function completerRelance(formData: FormData) {
  const id = String(formData.get("id"));
  await supabaseAdmin.from("relances").update({ statut: "envoyee", envoyee_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}

/** Annule une relance planifiée. */
export async function annulerRelance(formData: FormData) {
  const id = String(formData.get("id"));
  await supabaseAdmin.from("relances").update({ statut: "annulee" }).eq("id", id);
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
}
