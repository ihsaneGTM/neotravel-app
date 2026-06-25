import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUTS, STATUT_LABEL, type Statut } from "@/lib/dashboard/kpis";
import { avancerStatut, genererDevisFerme } from "../actions";

export const dynamic = "force-dynamic";

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

type Demande = {
  id: string;
  statut: Statut;
  type_deplacement: string;
  ville_depart: string;
  ville_arrivee: string | null;
  etapes: string[];
  date_depart: string;
  date_retour: string | null;
  heure_depart: string | null;
  nb_voyageurs: number;
  type_prestation: string;
  options: string[];
  budget_indicatif: number | null;
  commentaire: string | null;
  complexite: string;
  distance_km: number | null;
  valeur_panier_estimee: number | null;
  created_at: string;
  clients: { nom: string; email: string | null; telephone: string | null; consentement_rgpd: boolean } | null;
  commerciaux: { nom: string; email: string } | null;
};

type Devis = {
  id: string;
  type: string;
  prix_ht: number;
  tva: number;
  prix_ttc: number;
  lignes: { libelle: string; montant: number }[];
  created_at: string;
};

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: dRaw }, { data: devisRaw }] = await Promise.all([
    supabaseAdmin
      .from("demandes")
      .select(
        "*, clients(nom, email, telephone, consentement_rgpd), commerciaux(nom, email)"
      )
      .eq("id", id)
      .single(),
    supabaseAdmin.from("devis").select("id, type, prix_ht, tva, prix_ttc, lignes, created_at").eq("demande_id", id).order("created_at", { ascending: false }),
  ]);

  if (!dRaw) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-slate-600">Lead introuvable.</p>
        <Link href="/commercial" className="text-emerald-700 underline">← Retour</Link>
      </main>
    );
  }
  const d = dRaw as unknown as Demande;
  const devisList = (devisRaw ?? []) as unknown as Devis[];
  const devisFerme = devisList.find((v) => v.type === "ferme") ?? devisList[0] ?? null;
  const trajet = d.ville_arrivee ? `${d.ville_depart} → ${d.ville_arrivee}` : d.ville_depart;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/commercial" className="text-sm font-medium text-emerald-700 underline underline-offset-2">
        ← Tous les leads
      </Link>

      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {d.clients?.nom ?? "Prospect"} — {trajet}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {d.nb_voyageurs} voyageurs · {d.date_depart}
            {d.date_retour ? ` → ${d.date_retour}` : ""} · {d.type_prestation} ·{" "}
            <span className="capitalize">complexité {d.complexite}</span>
          </p>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          {STATUT_LABEL[d.statut]}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Résumé enrichi ────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Résumé enrichi</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Info label="Trajet" value={trajet} />
            <Info label="Type" value={d.type_deplacement.replace(/_/g, " ")} />
            <Info label="Dates" value={`${d.date_depart}${d.date_retour ? ` → ${d.date_retour}` : ""}`} />
            <Info label="Heure départ" value={d.heure_depart ?? "—"} />
            <Info label="Voyageurs" value={String(d.nb_voyageurs)} />
            <Info label="Prestation" value={d.type_prestation} />
            <Info label="Distance" value={d.distance_km != null ? `${d.distance_km} km` : "à estimer"} />
            <Info label="Options" value={d.options?.length ? d.options.join(", ") : "aucune"} />
            <Info label="Budget client" value={d.budget_indicatif != null ? eur(Number(d.budget_indicatif)) : "—"} />
            <Info label="Panier estimé (interne)" value={d.valeur_panier_estimee != null ? eur(Number(d.valeur_panier_estimee)) : "—"} />
          </dl>
          {d.commentaire && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Note : </span>{d.commentaire}
            </p>
          )}
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <p className="font-medium text-slate-500">Contact</p>
            <p>
              {d.clients?.telephone ?? "tél. non renseigné"}
              {d.clients?.email ? ` · ${d.clients.email}` : ""}
              {d.clients?.consentement_rgpd ? " · ✓ consentement RGPD" : ""}
            </p>
            <p className="mt-1 text-slate-400">Attribué à : {d.commerciaux?.nom ?? "non attribué"}</p>
          </div>
        </section>

        {/* ── Actions commercial ────────────────────────────────────────── */}
        <section className="space-y-4">
          {/* Statut */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Faire avancer le statut</h2>
            <div className="flex flex-wrap gap-2">
              {STATUTS.map((s) => (
                <form action={avancerStatut} key={s}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="statut" value={s} />
                  <button
                    type="submit"
                    disabled={s === d.statut}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      s === d.statut
                        ? "cursor-default bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {STATUT_LABEL[s]}
                  </button>
                </form>
              ))}
            </div>
          </div>

          {/* Devis ferme */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Devis ferme</h2>
            <form action={genererDevisFerme}>
              <input type="hidden" name="id" value={d.id} />
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Calculer le devis ferme (calculer_devis)
              </button>
            </form>
            <p className="mt-2 text-[0.7rem] text-slate-400">
              Recalcule le prix via le moteur déterministe, l&apos;enregistre et passe le lead en « Devis envoyé ».
            </p>

            {devisFerme && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{devisFerme.type}</span>
                  <span className="text-2xl font-bold text-emerald-600">{eur(devisFerme.prix_ttc)}</span>
                </div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {devisFerme.lignes.map((l, i) => {
                      const fort = /Prix TTC|Prix HT|Sous-total/i.test(l.libelle);
                      return (
                        <tr key={i} className={fort ? "font-semibold text-slate-800" : "text-slate-500"}>
                          <td className="py-0.5 pr-2">{l.libelle}</td>
                          <td className="py-0.5 text-right tabular-nums">{eur(l.montant)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}
