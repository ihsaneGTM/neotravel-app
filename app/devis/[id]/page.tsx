import { supabaseAdmin } from "@/lib/supabase/admin";
import { DevisSign } from "@/components/devis-sign";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { aller_simple: "Aller simple", aller_retour: "Aller-retour", circuit: "Circuit multi-étapes" };
const vehiculeLabel = (nb: number) => (nb <= 19 ? "Minibus" : nb <= 53 ? "Autocar standard" : "Autocar grand tourisme");
const dateFR = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

export default async function DevisPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: dvRaw } = await supabaseAdmin
    .from("devis")
    .select("id, prix_ttc, numero, envoye_at, demande_id, demandes(ville_depart, ville_arrivee, etapes, date_depart, date_retour, type_deplacement, nb_voyageurs, statut, clients(prenom, nom, email, telephone))")
    .eq("id", id)
    .single();

  const dv = dvRaw as unknown as {
    id: string;
    prix_ttc: number;
    numero: string | null;
    envoye_at: string | null;
    demande_id: string;
    demandes: {
      ville_depart: string;
      ville_arrivee: string | null;
      etapes: string[] | null;
      date_depart: string;
      date_retour: string | null;
      type_deplacement: string;
      nb_voyageurs: number;
      statut: string;
      clients: { prenom: string | null; nom: string | null; email: string | null; telephone: string | null } | null;
    } | null;
  } | null;

  if (!dv || !dv.demandes) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-[var(--ink)]">Devis introuvable</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Ce lien n'est plus valide. Contactez votre conseiller NeoTravel.</p>
        </div>
      </main>
    );
  }

  const d = dv.demandes;
  const trajet = [d.ville_depart, ...((d.etapes ?? []).filter(Boolean)), ...(d.ville_arrivee ? [d.ville_arrivee] : [])].join(" → ");
  const clientNom = [d.clients?.prenom, d.clients?.nom].filter(Boolean).join(" ") || "Cher client";

  return (
    <DevisSign
      devisId={dv.id}
      numero={dv.numero}
      clientNom={clientNom}
      clientEmail={d.clients?.email ?? null}
      clientTel={d.clients?.telephone ?? null}
      trajet={trajet}
      typeLabel={TYPE_LABEL[d.type_deplacement] ?? d.type_deplacement}
      dateDepart={dateFR(d.date_depart) ?? d.date_depart}
      dateRetour={dateFR(d.date_retour)}
      nbVoyageurs={d.nb_voyageurs}
      vehiculeLabel={vehiculeLabel(d.nb_voyageurs)}
      prixTTC={dv.prix_ttc}
      dateDevis={dateFR(dv.envoye_at ? dv.envoye_at.slice(0, 10) : new Date().toISOString().slice(0, 10)) ?? ""}
      signed={d.statut === "won"}
      enNegociation={d.statut === "negotiation"}
    />
  );
}
