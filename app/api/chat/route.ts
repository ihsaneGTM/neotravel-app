import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { calculerDevis, DevisError, type DevisInput } from "@/lib/pricing/calculer-devis";
import { evaluerComplexite } from "@/lib/pipeline/complexite";
import { estimerDistanceKm } from "@/lib/geo/distance";

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
    },
  });

  return result.toUIMessageStreamResponse();
}
