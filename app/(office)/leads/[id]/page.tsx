import Link from "next/link";
import { ArrowLeft, Sparkles, MapPin, Users, Calendar, Phone, Mail, ArrowRight, Zap } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeScore, niveauUrgence } from "@/lib/pipeline/scoring";
import { STATUTS, STATUT_LABEL, type Statut } from "@/lib/ui/statuts";
import { eur, eur2 } from "@/lib/ui/format";
import { Panel, StatusBadge, UrgenceBadge, ScorePill } from "@/components/office/ui";
import { ScoreBar } from "@/components/office/charts";
import { avancerStatut, genererDevisFerme } from "@/app/commercial/actions";

export const dynamic = "force-dynamic";

type Demande = {
  id: string;
  statut: Statut;
  type_deplacement: string;
  ville_depart: string;
  ville_arrivee: string | null;
  date_depart: string;
  date_demande: string | null;
  date_retour: string | null;
  heure_depart: string | null;
  nb_voyageurs: number;
  type_prestation: string;
  canal: string;
  options: string[] | null;
  budget_indicatif: number | null;
  commentaire: string | null;
  complexite: string;
  distance_km: number | null;
  valeur_panier_estimee: number | null;
  clients: { nom: string; email: string | null; telephone: string | null; consentement_rgpd: boolean } | null;
  commerciaux: { nom: string; email: string } | null;
};
type Devis = { id: string; type: string; prix_ht: number; tva: number; prix_ttc: number; lignes: { libelle: string; montant: number }[]; created_at: string };

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: dRaw }, { data: devisRaw }] = await Promise.all([
    supabaseAdmin.from("demandes").select("*, clients(nom, email, telephone, consentement_rgpd), commerciaux(nom, email)").eq("id", id).single(),
    supabaseAdmin.from("devis").select("id, type, prix_ht, tva, prix_ttc, lignes, created_at").eq("demande_id", id).order("created_at", { ascending: false }),
  ]);

  if (!dRaw) {
    return (
      <div className="nt-card p-8 text-center">
        <p className="text-slate-600">Lead introuvable.</p>
        <Link href="/leads" className="mt-2 inline-block text-indigo-600 underline">← Inbox</Link>
      </div>
    );
  }
  const d = dRaw as unknown as Demande;
  const devisList = (devisRaw ?? []) as unknown as Devis[];
  const devis = devisList.find((v) => v.type === "ferme") ?? devisList[0] ?? null;
  const trajet = d.ville_arrivee ? `${d.ville_depart} → ${d.ville_arrivee}` : d.ville_depart;
  const s = computeScore({
    valeur_panier_estimee: d.valeur_panier_estimee,
    nb_voyageurs: d.nb_voyageurs,
    date_depart: d.date_depart,
    date_demande: d.date_demande,
    date_retour: d.date_retour,
    options: d.options,
    commentaire: d.commentaire,
    budget_indicatif: d.budget_indicatif,
    email: d.clients?.email,
    telephone: d.clients?.telephone,
  });
  const urgence = niveauUrgence(d.date_depart, d.date_demande);

  const suggestions: string[] = [];
  if (s.score >= 75) suggestions.push("Prioriser le rappel — lead à fort potentiel");
  if (s.budget >= 70) suggestions.push("Générer un devis premium avec options");
  if (d.complexite !== "simple") suggestions.push("Affiner les besoins logistiques à l'appel");
  if (!d.clients?.telephone) suggestions.push("Récupérer un numéro de téléphone");
  if (suggestions.length === 0) suggestions.push("Confirmer les détails du trajet avec le client");

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Retour à l'inbox
      </Link>

      {/* Header */}
      <div className="nt-card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{d.clients?.nom ?? "Prospect"}</h1>
              <StatusBadge statut={d.statut} />
              <UrgenceBadge niveau={urgence} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {trajet}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {d.nb_voyageurs} pax</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {d.date_depart}{d.date_retour ? ` → ${d.date_retour}` : ""}</span>
              {d.clients?.telephone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {d.clients.telephone}</span>}
              {d.clients?.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {d.clients.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{d.valeur_panier_estimee != null ? eur(Number(d.valeur_panier_estimee)) : "—"}</p>
              <p className="text-xs text-slate-400">panier estimé (interne)</p>
            </div>
            <ScorePill score={s.score} />
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-4 rounded-xl bg-indigo-50/60 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> Résumé IA
          </p>
          <p className="text-sm text-slate-600">
            {d.commentaire?.trim() || `${d.type_prestation} — ${trajet}, ${d.nb_voyageurs} voyageurs au départ du ${d.date_depart}.`}
          </p>
        </div>

        {/* Score bars */}
        <div className="mt-4 flex flex-wrap gap-4">
          <ScoreBar label="Budget" value={s.budget} />
          <ScoreBar label="Urgence" value={s.urgency} />
          <ScoreBar label="Volume" value={s.volume} />
          <ScoreBar label="Complétude" value={s.completeness} />
          <ScoreBar label="Conversion" value={s.conversion} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Customer request + extracted */}
        <div className="space-y-5">
          <Panel title="Demande du client">
            <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              {d.commentaire?.trim() || "Pas de commentaire libre — demande qualifiée via les champs structurés."}
            </p>
          </Panel>
          <Panel title="Informations extraites">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Info label="Contact" value={d.clients?.nom ?? "—"} />
              <Info label="Route" value={trajet} />
              <Info label="Voyageurs" value={String(d.nb_voyageurs)} />
              <Info label="Type" value={d.type_deplacement.replace(/_/g, " ")} />
              <Info label="Dates" value={`${d.date_depart}${d.date_retour ? ` → ${d.date_retour}` : ""}`} />
              <Info label="Prestation" value={d.type_prestation} />
              <Info label="Distance" value={d.distance_km != null ? `${d.distance_km} km` : "à estimer"} />
              <Info label="Canal" value={d.canal.replace(/_/g, " ")} />
            </dl>
          </Panel>
        </div>

        {/* Actions */}
        <div className="space-y-5">
          <Panel title="Faire avancer le statut">
            <div className="flex flex-wrap gap-2">
              {STATUTS.map((st) => (
                <form action={avancerStatut} key={st}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="statut" value={st} />
                  <button
                    type="submit"
                    disabled={st === d.statut}
                    className={`nt-press rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      st === d.statut ? "cursor-default bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {STATUT_LABEL[st]}
                  </button>
                </form>
              ))}
            </div>
          </Panel>

          <Panel title="Actions suggérées" icon={Zap}>
            <ul className="space-y-2">
              {suggestions.map((sg) => (
                <li key={sg} className="flex items-start gap-2 text-sm text-slate-600">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> {sg}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Devis">
            <form action={genererDevisFerme}>
              <input type="hidden" name="id" value={d.id} />
              <button className="nt-press w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
                Calculer le devis ferme
              </button>
            </form>
            {devis && (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{devis.type}</span>
                  <span className="text-2xl font-bold text-indigo-600">{eur2(devis.prix_ttc)}</span>
                </div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {devis.lignes.map((l, i) => {
                      const fort = /Prix TTC|Prix HT|Sous-total/i.test(l.libelle);
                      return (
                        <tr key={i} className={fort ? "font-semibold text-slate-800" : "text-slate-500"}>
                          <td className="py-0.5 pr-2">{l.libelle}</td>
                          <td className="py-0.5 text-right tabular-nums">{eur2(l.montant)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 capitalize text-slate-700">{value}</dd>
    </div>
  );
}
