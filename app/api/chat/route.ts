import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { calculerDevis, DevisError, type DevisInput } from "@/lib/pricing/calculer-devis";
import { evaluerComplexite } from "@/lib/pipeline/complexite";
import { estimerDistanceKm } from "@/lib/geo/distance";
import { DemandeSchema } from "@/lib/ai/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { creerClientEtDemande, attribuerDemande, enregistrerDevis } from "@/lib/crm";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: MODELS.agent,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6), // borne la boucle d'outils
    tools: {
      // ── Distance ville→ville (MVP stub — routing réel en J6) ──────────────
      estimer_distance: tool({
        description:
          "Estime la distance (km) d'un aller entre deux villes. À appeler AVANT calculer_devis.",
        inputSchema: z.object({
          ville_depart: z.string(),
          ville_arrivee: z.string(),
        }),
        execute: async ({ ville_depart, ville_arrivee }) => estimerDistanceKm(ville_depart, ville_arrivee),
      }),

      // ── Le SEUL chemin de prix autorisé (déterministe, 100% code) ─────────
      calculer_devis: tool({
        description:
          "Calcule une estimation tarifaire déterministe (seule source de prix autorisée). " +
          "Renvoie ok:false + flux_manuel si le cas relève du commercial (circuit, >85 passagers, urgence, incohérence).",
        inputSchema: z.object({
          type_deplacement: z.enum(["aller_simple", "aller_retour", "circuit"]),
          distance_km: z.number().positive().describe("Distance d'un aller en km (via estimer_distance)"),
          nb_passagers: z.number().int().positive(),
          date_depart: z.string().describe("YYYY-MM-DD"),
          date_demande: z.string().describe("YYYY-MM-DD (aujourd'hui)"),
          date_retour: z.string().optional().describe("YYYY-MM-DD"),
        }),
        execute: async (input) => {
          // Politique amont : urgence/incohérence/complexe ⇒ estimation masquée.
          const evalc = evaluerComplexite({
            type_deplacement: input.type_deplacement,
            nb_voyageurs: input.nb_passagers,
            date_depart: input.date_depart,
            date_retour: input.date_retour,
            date_demande: input.date_demande,
          });
          if (!evalc.afficher_estimation) {
            return {
              ok: false as const,
              flux_manuel: true as const,
              complexite: evalc.complexite,
              raisons: evalc.raisons,
              message:
                "Ce dossier nécessite un commercial (pas d'estimation automatique). Récupère le contact et annonce un rappel.",
            };
          }
          try {
            const devis = calculerDevis(input as DevisInput);
            return { ok: true as const, ...devis };
          } catch (e) {
            if (e instanceof DevisError) {
              return { ok: false as const, flux_manuel: true as const, code: e.code, message: e.message };
            }
            throw e;
          }
        },
      }),

      // ── Persistance CRM + attribution (une fois le contact obtenu) ────────
      enregistrer_demande: tool({
        description:
          "Enregistre la demande dans le CRM et l'attribue automatiquement à un commercial. " +
          "À appeler UNE FOIS le récapitulatif validé ET le numéro de téléphone obtenu.",
        inputSchema: DemandeSchema.extend({ distance_km: z.number().positive().optional() }),
        execute: async (input) => {
          const today = new Date().toISOString().slice(0, 10);
          const evalc = evaluerComplexite({
            type_deplacement: input.type_deplacement,
            nb_voyageurs: input.nb_voyageurs,
            date_depart: input.date_depart,
            date_retour: input.date_retour,
            date_demande: today,
            etapes: input.etapes,
          });
          let devis;
          let valeur_panier: number | undefined;
          if (input.distance_km && evalc.afficher_estimation) {
            try {
              devis = calculerDevis({
                nb_passagers: input.nb_voyageurs,
                type_deplacement: input.type_deplacement,
                distance_km: input.distance_km,
                date_depart: input.date_depart,
                date_demande: today,
                date_retour: input.date_retour,
              });
              valeur_panier = devis.prix_ttc;
            } catch {
              /* non chiffrable → escalade, pas d'estimation persistée */
            }
          }
          const { demande_id } = await creerClientEtDemande(supabaseAdmin, {
            ...input,
            complexite: evalc.complexite,
            valeur_panier_estimee: valeur_panier ?? null,
          });
          const attr = await attribuerDemande(supabaseAdmin, demande_id, input.type_prestation);
          if (devis && attr.commercial) {
            await enregistrerDevis(supabaseAdmin, demande_id, devis, {
              type: "estimation",
              commercial_id: attr.commercial.id,
            });
          }
          return {
            ok: true as const,
            demande_id,
            commercial: attr.commercial?.nom ?? null,
            complexite: evalc.complexite,
            escalade: !evalc.afficher_estimation,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
