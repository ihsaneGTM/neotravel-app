import { z } from "zod";

/**
 * Schéma d'extraction structurée de la demande (sortie fiable, pas de texte libre).
 * Repris des 3 catégories du formulaire actuel + circuit multi-points.
 * Distance, type de véhicule, urgence, nuitées sont DÉDUITS (non demandés).
 */

export const TypeDeplacement = z.enum(["aller_simple", "aller_retour", "circuit"]);
export const TypePrestation = z.enum([
  "transfert",
  "navette",
  "scolaire",
  "seminaire",
  "tourisme",
  "mise_a_disposition",
]);
export const TypeClient = z.enum(["particulier", "asso", "collectivite", "entreprise"]);

export const ContactSchema = z.object({
  prenom: z.string().optional(),
  nom: z.string().optional(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  consentement_rgpd: z.boolean().default(false),
});

export const DemandeSchema = z.object({
  type_deplacement: TypeDeplacement,
  ville_depart: z.string(),
  ville_arrivee: z.string().optional(),
  etapes: z.array(z.string()).default([]),
  date_depart: z.string().describe("YYYY-MM-DD"),
  date_retour: z.string().optional().describe("YYYY-MM-DD (si aller-retour / circuit)"),
  heure_depart: z.string().optional(),
  heure_retour: z.string().optional(),
  nb_voyageurs: z.number().int().positive(),
  // Jamais demandé au prospect : déduit du contexte si mentionné, sinon classé par le commercial.
  type_prestation: TypePrestation.optional(),
  options: z.array(z.string()).default([]),
  budget_indicatif: z.number().positive().optional(),
  commentaire: z.string().optional(),
  type_client: TypeClient.default("particulier"),
  /** Le prospect a demandé à parler à un humain / être rappelé par un conseiller. */
  souhaite_rappel: z.boolean().optional(),
  contact: ContactSchema.optional(),
});

export type DemandeExtraite = z.infer<typeof DemandeSchema>;
