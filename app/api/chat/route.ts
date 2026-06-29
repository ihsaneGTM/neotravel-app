import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { MODELS } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { calculerDevis } from "@/lib/pricing/calculer-devis";
import { evaluerComplexite } from "@/lib/pipeline/complexite";
import { estimerDistanceKm } from "@/lib/geo/distance";
import { DemandeSchema } from "@/lib/ai/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { creerClientEtDemande, attribuerDemande, enregistrerDevis } from "@/lib/crm";
import { sendEmail, renderEstimationEmail } from "@/lib/email/resend";
import { dateFR } from "@/lib/ui/format";

export const maxDuration = 30;

/** Extrait un transcript simplifié [{role, text}] des UIMessages. */
function toSimple(messages: UIMessage[]) {
  return messages
    .map((m) => ({
      role: m.role,
      text: m.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join("")
        .trim(),
    }))
    .filter((m) => m.text);
}

export async function POST(req: Request) {
  const { messages, id }: { messages: UIMessage[]; id?: string } = await req.json();
  const today = new Date().toISOString().slice(0, 10);

  const result = streamText({
    model: MODELS.agent,
    system: `${SYSTEM_PROMPT}\n\n# Contexte\nDate du jour : ${today}. Résous toute date relative (« dans 5 jours », « le 20 août », « le week-end prochain ») par rapport à cette date, et fournis les dates au format YYYY-MM-DD. Ne propose jamais une date de départ dans le passé.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(4),
    tools: {
      enregistrer_demande: tool({
        description:
          "Enregistre la demande qualifiée dans le CRM et l'attribue automatiquement à un commercial, qui rappellera le prospect pour établir et communiquer le devis. " +
          "À appeler UNE FOIS le récapitulatif validé ET le numéro de téléphone obtenu. Ne renvoie aucun prix.",
        inputSchema: DemandeSchema,
        execute: async (input) => {
          const evalc = evaluerComplexite({
            type_deplacement: input.type_deplacement,
            nb_voyageurs: input.nb_voyageurs,
            date_depart: input.date_depart,
            date_retour: input.date_retour,
            date_demande: today,
            etapes: input.etapes,
          });

          // Distance routière sur tout le trajet (départ → étapes → arrivée).
          let distanceKm: number | null = null;
          if (input.ville_arrivee) {
            try {
              const villes = [input.ville_depart, ...(input.etapes ?? []), input.ville_arrivee];
              const est = await estimerDistanceKm(villes);
              if (est.source !== "defaut") distanceKm = est.distance_km;
            } catch {
              /* géocodage indisponible → distance laissée à null (le commercial complétera) */
            }
          }

          let devis;
          let valeur_panier: number | undefined;
          if (evalc.afficher_estimation && distanceKm != null) {
            try {
              devis = calculerDevis({
                nb_passagers: input.nb_voyageurs,
                type_deplacement: input.type_deplacement,
                distance_km: distanceKm,
                date_depart: input.date_depart,
                date_demande: today,
                date_retour: input.date_retour,
              });
              valeur_panier = devis.prix_ttc;
            } catch {
              /* non chiffrable → escalade */
            }
          }

          // Prestation jamais demandée : déduite si fournie, sinon "transfert" par défaut (le commercial reclasse).
          const prestation = input.type_prestation ?? "transfert";
          // Demande de rappel humain → marqueur sur la demande (badge « Rappel demandé » côté commercial).
          const options = input.souhaite_rappel ? [...(input.options ?? []), "contact_humain"] : input.options;

          const { demande_id, client_id } = await creerClientEtDemande(supabaseAdmin, {
            ...input,
            type_prestation: prestation,
            options,
            complexite: evalc.complexite,
            distance_km: distanceKm,
            valeur_panier_estimee: valeur_panier ?? null,
          });
          const attr = await attribuerDemande(supabaseAdmin, demande_id, prestation);
          if (devis && attr.commercial) {
            await enregistrerDevis(supabaseAdmin, demande_id, devis, { type: "estimation", commercial_id: attr.commercial.id });
          }

          // Cas SIMPLE : estimation PROVISOIRE envoyée automatiquement par email (à confirmer par un conseiller).
          // ⚠️ Divergence assumée vs règle .md « l'IA ne communique jamais de prix » : ici c'est un email
          // système clairement indicatif (pas le chatbot), demandé pour accélérer les cas simples.
          let estimationEnvoyee = false;
          if (evalc.complexite === "simple" && devis && input.contact?.email) {
            try {
              const clientNom = [input.contact.prenom, input.contact.nom].filter(Boolean).join(" ") || "client";
              const trajet = [input.ville_depart, ...(input.etapes ?? []), ...(input.ville_arrivee ? [input.ville_arrivee] : [])].join(" → ");
              const dates = `${dateFR(input.date_depart)}${input.date_retour ? ` → ${dateFR(input.date_retour)}` : ""}`;
              const { subject, html } = renderEstimationEmail({ client: clientNom, trajet, dates, nb_voyageurs: input.nb_voyageurs, prix_ttc: devis.prix_ttc });
              await sendEmail({ to: input.contact.email, subject, html });
              estimationEnvoyee = true;
            } catch {
              /* email non configuré → on n'échoue pas : le commercial enverra le devis ferme */
            }
          }

          // Lie la conversation au lead créé + statut (à rappeler si cas non-simple).
          // try/catch : ne JAMAIS casser l'enregistrement si la table conversations
          // n'existe pas encore (migration 0003 non appliquée).
          if (id) {
            try {
              await supabaseAdmin.from("conversations").upsert(
                {
                  id,
                  demande_id,
                  client_id,
                  complexite: evalc.complexite,
                  statut: evalc.complexite === "simple" ? "terminee" : "a_rappeler",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "id" }
              );
            } catch {
              /* table conversations absente → on ignore */
            }
          }

          return {
            ok: true as const,
            demande_id,
            commercial: attr.commercial?.nom ?? null,
            // Vrai uniquement si une estimation provisoire a réellement été envoyée par email (cas simple).
            estimation_envoyee: estimationEnvoyee,
            email: estimationEnvoyee ? input.contact?.email ?? null : null,
          };
        },
      }),
    },
    // Persiste le transcript à chaque tour (inbox de conversations).
    onFinish: async ({ text }) => {
      if (!id) return;
      try {
        const simple = toSimple(messages);
        const transcript = [...simple, { role: "assistant", text: (text ?? "").trim() }].filter((m) => m.text);
        await supabaseAdmin.from("conversations").upsert(
          {
            id,
            transcript,
            dernier_message: transcript.at(-1)?.text?.slice(0, 280) ?? "",
            nb_messages: transcript.length,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch {
        /* table conversations absente → on ignore */
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
