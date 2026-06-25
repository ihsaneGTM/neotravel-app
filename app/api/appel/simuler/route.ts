import { generateText } from "ai";
import { MODELS } from "@/lib/ai/models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transitionStatut } from "@/lib/crm";

export const maxDuration = 30;

/**
 * SIMULATION (démo) d'un appel commercial : génère une retranscription via la
 * clé Vercel AI Gateway (même modèle que les conversations), l'enregistre, et
 * fait passer le lead de « Qualifié » à « Contacté ». Remplace temporairement le
 * webhook Aircall/Ringover tant qu'il n'est pas branché.
 */
export async function POST(req: Request) {
  try {
    const { demande_id } = (await req.json()) as { demande_id?: string };
    if (!demande_id) return Response.json({ error: "demande_id requis." }, { status: 400 });

    const { data: d } = await supabaseAdmin
      .from("demandes")
      .select("id, statut, commercial_id, ville_depart, ville_arrivee, date_depart, date_retour, nb_voyageurs, type_prestation, commentaire, clients(prenom, nom)")
      .eq("id", demande_id)
      .single();
    if (!d) return Response.json({ error: "demande introuvable." }, { status: 404 });

    const dem = d as unknown as {
      statut: string; commercial_id: string | null; ville_depart: string; ville_arrivee: string | null;
      date_depart: string; date_retour: string | null; nb_voyageurs: number; type_prestation: string; commentaire: string | null;
      clients: { prenom: string | null; nom: string | null } | null;
    };
    // Idempotent : on ne (re)simule que si le lead est encore « Qualifié ».
    if (dem.statut !== "qualified") return Response.json({ ok: true, skipped: true });

    const client = [dem.clients?.prenom, dem.clients?.nom].filter(Boolean).join(" ") || "le prospect";
    const trajet = dem.ville_arrivee ? `${dem.ville_depart} → ${dem.ville_arrivee}` : dem.ville_depart;
    const dates = `${dem.date_depart}${dem.date_retour ? ` au ${dem.date_retour}` : ""}`;

    const { text } = await generateText({
      model: MODELS.agent,
      prompt:
        `Tu génères une RETRANSCRIPTION D'APPEL commerciale réaliste (démo NeoTravel, transport en autocar), en français, sous forme de dialogue court (~140 mots) entre "Commercial" et "${client}". ` +
        `Contexte : trajet ${trajet}, ${dem.nb_voyageurs} voyageurs, dates ${dates}, prestation ${dem.type_prestation}.` +
        (dem.commentaire ? ` Note : ${dem.commentaire}.` : "") +
        ` Le commercial confirme les détails, répond à une question, et annonce l'envoi d'un devis par email. ` +
        `Commence impérativement par la ligne "[SIMULATION — appel enregistré via Aircall (démo)]".`,
    });

    const resume = text.replace(/\[SIMULATION[^\]]*\]\s*/i, "").trim().slice(0, 160);
    await supabaseAdmin.from("appels").insert({
      demande_id,
      commercial_id: dem.commercial_id,
      source: "simulation",
      simule: true,
      duree_sec: Math.floor(Math.random() * 150) + 75,
      transcript: text,
      resume,
    });
    await transitionStatut(supabaseAdmin, demande_id, "contacted");

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
