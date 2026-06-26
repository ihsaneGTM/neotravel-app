import Link from "next/link";
import { ArrowLeft, Sparkles, MapPin, Users, Calendar, Phone, Mail, ArrowRight, Zap, Send, CircleCheck, PhoneCall } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeScore, niveauUrgence } from "@/lib/pipeline/scoring";
import { STATUTS, STATUT_LABEL, type Statut } from "@/lib/ui/statuts";
import { eur, eur2, depuis } from "@/lib/ui/format";
import { resendConfigured } from "@/lib/email/resend";
import { Panel, StatusBadge, UrgenceBadge, ScorePill } from "@/components/office/ui";
import { ScoreBar } from "@/components/office/charts";
import { Shell } from "@/components/office/shell";
import { LeadRouteMap } from "@/components/office/lead-route-map";
import { LeadActionBar } from "@/components/office/lead-action-bar";
import { avancerStatut, genererDevisFerme, envoyerDevis } from "@/app/commercial/actions";

export const dynamic = "force-dynamic";

function renderMd(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>
      : part
  );
}

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
  clients: { prenom: string | null; nom: string; email: string | null; telephone: string | null; consentement_rgpd: boolean } | null;
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
  envoye_at: string | null;
  resend_id: string | null;
  destinataire: string | null;
  numero: string | null;
};

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: dRaw }, { data: devisRaw }, { data: appelsRaw }, { data: relancesRaw }] = await Promise.all([
    supabaseAdmin.from("demandes").select("*, clients(prenom, nom, email, telephone, consentement_rgpd), commerciaux(nom, email)").eq("id", id).single(),
    supabaseAdmin
      .from("devis")
      .select("id, type, prix_ht, tva, prix_ttc, lignes, created_at, envoye_at, resend_id, destinataire, numero")
      .eq("demande_id", id)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("appels").select("id, transcript, resume, duree_sec, source, created_at").eq("demande_id", id).order("created_at", { ascending: false }),
    supabaseAdmin.from("relances").select("statut, planifiee_pour").eq("demande_id", id),
  ]);
  // Avancement des relances : échues = envoyées OU date passée (pour « En cours de relance » / « À rappeler »).
  const relancesRows = (relancesRaw ?? []) as { statut: string; planifiee_pour: string | null }[];
  const relancesTotal = relancesRows.length;
  const relancesDues = relancesRows.filter((r) => r.statut === "envoyee" || (r.planifiee_pour && new Date(r.planifiee_pour).getTime() <= Date.now())).length;
  const emailConfigure = resendConfigured();
  const appels = (appelsRaw ?? []) as { id: string; transcript: string | null; resume: string | null; duree_sec: number | null; source: string; created_at: string }[];

  if (!dRaw) {
    return (
      <Shell>
        <div className="nt-card p-8 text-center">
          <p className="text-[var(--muted)]">Lead introuvable.</p>
          <Link href="/leads" className="mt-2 inline-block text-[var(--forest)] underline">← Inbox</Link>
        </div>
      </Shell>
    );
  }
  const d = dRaw as unknown as Demande;
  const devisList = (devisRaw ?? []) as unknown as Devis[];
  // Seul le devis FERME est présentable/envoyable au client. L'estimation reste interne.
  const devis = devisList.find((v) => v.type === "ferme") ?? null;
  const trajet = d.ville_arrivee ? `${d.ville_depart} → ${d.ville_arrivee}` : d.ville_depart;
  const clientNom = [d.clients?.prenom, d.clients?.nom].filter(Boolean).join(" ") || "Prospect";
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
    <Shell>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> Retour à l'inbox
      </Link>

      {/* Header */}
      <div className="nt-card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--ink)]">{clientNom}</h1>
              <StatusBadge statut={d.statut} />
              <UrgenceBadge niveau={urgence} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {trajet}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {d.nb_voyageurs} pax</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {d.date_depart}{d.date_retour ? ` → ${d.date_retour}` : ""}</span>
              {d.clients?.telephone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {d.clients.telephone}</span>}
              {d.clients?.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {d.clients.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--ink)]">{d.valeur_panier_estimee != null ? eur(Number(d.valeur_panier_estimee)) : "—"}</p>
              <p className="text-xs text-[var(--faint)]">panier estimé (interne)</p>
            </div>
            <ScorePill score={s.score} />
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-4 rounded-xl bg-[var(--lime-soft)]/60 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--forest)]">
            <Sparkles className="h-3.5 w-3.5" /> Résumé IA
          </p>
          <p className="text-sm text-[var(--muted)]">
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
            <p className="rounded-lg bg-[var(--bg-soft)] p-4 text-sm leading-relaxed text-[var(--muted)]">
              {d.commentaire?.trim() || "Pas de commentaire libre — demande qualifiée via les champs structurés."}
            </p>
          </Panel>
          {d.ville_arrivee && (
            <Panel title="Itinéraire" icon={MapPin}>
              <LeadRouteMap from={d.ville_depart} to={d.ville_arrivee} />
            </Panel>
          )}
          <Panel title="Informations extraites">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Info label="Contact" value={clientNom} />
              <Info label="Route" value={trajet} />
              <Info label="Voyageurs" value={String(d.nb_voyageurs)} />
              <Info label="Type" value={d.type_deplacement.replace(/_/g, " ")} />
              <Info label="Dates" value={`${d.date_depart}${d.date_retour ? ` → ${d.date_retour}` : ""}`} />
              <Info label="Prestation" value={d.type_prestation} />
              <Info label="Distance" value={d.distance_km != null ? `${d.distance_km} km` : "à estimer"} />
              <Info label="Canal" value={d.canal.replace(/_/g, " ")} />
            </dl>
          </Panel>

          {appels.length > 0 && (
            <Panel title="Appels" icon={PhoneCall}>
              <div className="space-y-3">
                {appels.map((a) => (
                  <div key={a.id} className="rounded-xl bg-[var(--bg-soft)] p-3.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--faint)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded bg-[#f6ead0] px-1.5 py-0.5 font-medium text-[#8a5a1f]">{a.source === "simulation" ? "simulation (démo)" : a.source}</span>
                        {a.duree_sec ? `${Math.floor(a.duree_sec / 60)} min ${a.duree_sec % 60}s` : ""}
                      </span>
                      <span>{new Date(a.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">{a.transcript ? renderMd(a.transcript) : null}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
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
                      st === d.statut ? "cursor-default bg-[var(--ink)] text-[var(--cream)]" : "bg-[var(--grey)] text-[var(--muted)] hover:bg-[var(--line-2)]"
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
                <li key={sg} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--olive)]" /> {sg}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Devis">
            <form action={genererDevisFerme}>
              <input type="hidden" name="id" value={d.id} />
              <button className="nt-press w-full rounded-xl border border-[var(--lime-deep)] bg-[var(--lime-soft)] px-4 py-2.5 text-sm font-medium text-[var(--forest)] transition-colors hover:bg-[var(--lime-soft)]">
                {devis ? "Recalculer le devis ferme" : "Générer le devis ferme"}
              </button>
            </form>

            {devis ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                {/* Aperçu */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--faint)]">{devis.numero ?? "Aperçu du devis"}</span>
                  <span className="text-2xl font-bold text-[var(--ink)]">{eur2(devis.prix_ttc)}</span>
                </div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {devis.lignes.map((l, i) => {
                      const fort = /Prix TTC|Prix HT|Sous-total/i.test(l.libelle);
                      return (
                        <tr key={i} className={fort ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>
                          <td className="py-0.5 pr-2">{l.libelle}</td>
                          <td className="py-0.5 text-right tabular-nums">{eur2(l.montant)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Envoi / preuve */}
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  {devis.envoye_at ? (
                    <div className="rounded-xl bg-[var(--lime-soft)] p-3">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--forest)]">
                        <CircleCheck className="h-4 w-4" /> Devis envoyé {depuis(devis.envoye_at)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--forest)]/80">à {devis.destinataire}</p>
                      {devis.resend_id && (
                        <p className="mt-1 font-mono text-[0.65rem] text-[var(--forest)]/60">preuve Resend : {devis.resend_id}</p>
                      )}
                    </div>
                  ) : emailConfigure && d.clients?.email ? (
                    <form action={envoyerDevis}>
                      <input type="hidden" name="id" value={d.id} />
                      <p className="mb-2 text-xs text-[var(--muted)]">Prêt à envoyer — non encore transmis au client.</p>
                      <button className="nt-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--cream)] transition-colors hover:bg-[#20231a]">
                        <Send className="h-4 w-4" /> Envoyer le devis à {d.clients.email}
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--line-2)] p-3 text-xs text-[var(--faint)]">
                      {!d.clients?.email
                        ? "Aucun email client : impossible d'envoyer le devis."
                        : "Envoi indisponible : RESEND_API_KEY non configurée (ajoutez-la dans .env.local et sur Vercel)."}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--faint)]">Générez le devis pour le prévisualiser, puis l'envoyer au client.</p>
            )}
          </Panel>
        </div>
      </div>

      {/* Espace pour que la barre flottante ne masque pas le dernier panneau */}
      <div className="h-28" aria-hidden />

      {/* Barre d'action flottante : prochaine action toujours visible + édition */}
      <LeadActionBar
        id={d.id}
        statut={d.statut}
        devisPret={!!devis && !devis.envoye_at}
        relancesTotal={relancesTotal}
        relancesDues={relancesDues}
        hasEmail={!!d.clients?.email}
        emailConfigure={emailConfigure}
        email={d.clients?.email ?? null}
        fields={{
          ville_depart: d.ville_depart,
          ville_arrivee: d.ville_arrivee ?? "",
          date_depart: d.date_depart,
          date_retour: d.date_retour ?? "",
          nb_voyageurs: d.nb_voyageurs,
          type_deplacement: d.type_deplacement,
          type_prestation: d.type_prestation,
          commentaire: d.commentaire ?? "",
        }}
      />
    </Shell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--faint)]">{label}</dt>
      <dd className="mt-0.5 capitalize text-[var(--ink)]">{value}</dd>
    </div>
  );
}
