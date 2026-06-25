import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CircleCheck,
  FileText,
  Euro,
  TrendingUp,
  Percent,
  Clock,
  TriangleAlert,
  ArrowUpRight,
  Send,
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDashboard } from "@/lib/dashboard/office-data";
import { STATUT_META, STATUT_LABEL } from "@/lib/ui/statuts";
import { eur } from "@/lib/ui/format";
import { Kpi, Panel, ScorePill, UrgenceBadge, PageHeader } from "@/components/office/ui";
import { Donut, VBars } from "@/components/office/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard(supabaseAdmin);
  const donutSegments = d.funnel
    .filter((f) => f.count > 0)
    .map((f) => ({ label: STATUT_LABEL[f.statut], value: f.count, hex: STATUT_META[f.statut].hex }));

  return (
    <>
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Votre centre de pilotage commercial augmenté par l'IA" />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} value={d.new_leads} label="Nouveaux leads" tone="indigo" />
        <Kpi icon={CircleCheck} value={d.qualified} label="Qualifiés" tone="emerald" />
        <Kpi icon={FileText} value={d.quotes_generated} label="Devis générés" tone="slate" />
        <Kpi icon={Euro} value={eur(d.pipeline_value)} label="Valeur pipeline" tone="indigo" />
        <Kpi icon={TrendingUp} value={d.avg_score} label="Score moyen" tone="emerald" />
        <Kpi icon={Percent} value={d.conversion_rate == null ? "—" : `${d.conversion_rate} %`} label="Taux de conversion" tone="slate" />
        <Kpi icon={Clock} value={d.pending_followups} label="Relances en attente" tone="amber" />
        <Kpi icon={TriangleAlert} value={d.overdue_followups} label="Relances en retard" tone={d.overdue_followups > 0 ? "rose" : "slate"} />
      </section>

      {/* Donut + barres */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Pipeline par statut">
          {donutSegments.length ? (
            <Donut segments={donutSegments} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucune demande pour l'instant.</p>
          )}
        </Panel>
        <Panel title="Leads par canal">
          {d.by_canal.length ? (
            <VBars data={d.by_canal} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucun canal renseigné.</p>
          )}
        </Panel>
      </div>

      {/* Opportunités + relances */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Opportunités prioritaires"
          action={
            <Link href="/leads" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {d.opportunities.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {d.opportunities.map((o) => (
                <li key={o.id}>
                  <Link href={`/leads/${o.id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-slate-50/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{o.client}</p>
                      <p className="truncate text-xs text-slate-400">{o.trajet}</p>
                    </div>
                    <UrgenceBadge niveau={o.urgence} />
                    <ScorePill score={o.score} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucune opportunité active.</p>
          )}
        </Panel>

        <Panel
          title="Relances à venir"
          action={
            <Link href="/follow-ups" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {d.upcoming.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {d.upcoming.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2.5">
                  <span className="truncate text-sm text-slate-700">{u.objet}</span>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">En attente</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucune relance planifiée.</p>
          )}
        </Panel>
      </div>

      {/* Devis prêts à envoyer (preview avant envoi) */}
      <div className="mt-6">
        <Panel title="Devis prêts à envoyer" icon={Send}>
          {d.a_envoyer.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {d.a_envoyer.map((q) => (
                <li key={q.demande_id}>
                  <Link href={`/leads/${q.demande_id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-slate-50/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{q.client}</p>
                      <p className="truncate text-xs text-slate-400">{q.trajet}</p>
                    </div>
                    <span className="font-semibold text-slate-900">{eur(q.prix_ttc)}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                      Prévisualiser & envoyer <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Aucun devis en attente d'envoi.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
