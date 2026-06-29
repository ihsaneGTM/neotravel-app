import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, renderRelanceEmail } from "@/lib/email/resend";
import { PROD_URL } from "@/lib/studio/config";
import { dateFR } from "@/lib/ui/format";

export type RelanceResult =
  | { ok: true; resend_id: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/**
 * Envoie réellement l'email d'une relance, puis met à jour la ligne (envoyee_at, resend_id).
 * Garde-fous : ne renvoie pas une relance déjà traitée, ni sur un deal clos (gagné/perdu),
 * ni sans email. En cas d'échec Resend, on trace l'erreur et on laisse la relance « planifiee ».
 * Source unique partagée par le bouton manuel ET le cron quotidien.
 */
export async function envoyerRelanceCore(sb: SupabaseClient, relanceId: string): Promise<RelanceResult> {
  const { data: relRaw } = await sb
    .from("relances")
    .select("id, type, statut, demande_id, devis_id, objet")
    .eq("id", relanceId)
    .single();
  const rel = relRaw as { id: string; type: string; statut: string; demande_id: string; devis_id: string | null; objet: string | null } | null;
  if (!rel) return { ok: false, skipped: true, reason: "relance introuvable" };
  if (rel.statut !== "planifiee") return { ok: false, skipped: true, reason: `déjà ${rel.statut}` };

  const [{ data: demRaw }, { data: devRaw }] = await Promise.all([
    sb
      .from("demandes")
      .select("statut, ville_depart, ville_arrivee, etapes, date_depart, date_retour, clients(prenom, nom, email)")
      .eq("id", rel.demande_id)
      .single(),
    rel.devis_id
      ? sb.from("devis").select("id, numero, prix_ttc").eq("id", rel.devis_id).single()
      : sb.from("devis").select("id, numero, prix_ttc").eq("demande_id", rel.demande_id).eq("type", "ferme").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const dem = demRaw as unknown as {
    statut: string;
    ville_depart: string;
    ville_arrivee: string | null;
    etapes: string[] | null;
    date_depart: string;
    date_retour: string | null;
    clients: { prenom: string | null; nom: string | null; email: string | null } | null;
  } | null;
  const dev = devRaw as { id: string; numero: string | null; prix_ttc: number } | null;

  if (!dem) return { ok: false, skipped: true, reason: "demande introuvable" };
  // Deal clos → plus de relance (et on annule la ligne pour ne pas la rejouer).
  if (dem.statut === "won" || dem.statut === "lost") {
    await sb.from("relances").update({ statut: "annulee" }).eq("id", rel.id);
    return { ok: false, skipped: true, reason: `deal ${dem.statut}` };
  }
  const email = dem.clients?.email;
  if (!email) return { ok: false, skipped: true, reason: "pas d'email client" };
  // Garde-fou : ne JAMAIS relancer une adresse de démo factice (évite des bounces réels).
  if (/@demo\.neotravel\.test$/i.test(email)) {
    await sb.from("relances").update({ statut: "annulee" }).eq("id", rel.id);
    return { ok: false, skipped: true, reason: "adresse de démo (non envoyée)" };
  }
  if (!dev) return { ok: false, skipped: true, reason: "aucun devis ferme" };

  const client = [dem.clients?.prenom, dem.clients?.nom].filter(Boolean).join(" ") || "client";
  const trajet = [dem.ville_depart, ...((dem.etapes ?? []).filter(Boolean)), ...(dem.ville_arrivee ? [dem.ville_arrivee] : [])].join(" → ");
  const dates = `${dateFR(dem.date_depart)}${dem.date_retour ? ` → ${dateFR(dem.date_retour)}` : ""}`;
  const numero = dev.numero ?? "—";

  try {
    const { subject, html } = renderRelanceEmail({
      numero,
      client,
      trajet,
      dates,
      prix_ttc: Number(dev.prix_ttc) || 0,
      type: rel.type,
      signUrl: `${PROD_URL}/devis/${dev.id}`,
    });
    const resend_id = await sendEmail({ to: email, subject, html });
    await sb
      .from("relances")
      .update({ statut: "envoyee", envoyee_at: new Date().toISOString(), resend_id, destinataire: email, objet: rel.objet ?? subject, erreur: null })
      .eq("id", rel.id);
    return { ok: true, resend_id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await sb.from("relances").update({ erreur: error }).eq("id", rel.id);
    return { ok: false, skipped: false, error };
  }
}
