import { BarChart3, Users, Euro, Percent, TrendingUp, FileText } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAnalytics } from "@/lib/dashboard/office-data";
import { eur } from "@/lib/ui/format";
import { Kpi, Panel, PageHeader } from "@/components/office/ui";
import { Donut, VBars, HBars } from "@/components/office/charts";
import { Shell } from "@/components/office/shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const a = await getAnalytics(supabaseAdmin);
  return (
    <Shell>
      <PageHeader icon={BarChart3} title="Sales Analytics" subtitle="Vue de performance commerciale" />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Users} value={a.total} label="Total leads" tone="indigo" />
        <Kpi icon={Euro} value={eur(a.pipeline_value)} label="Valeur pipeline" tone="emerald" />
        <Kpi icon={Percent} value={a.win_rate == null ? "—" : `${a.win_rate} %`} label="Taux de gain" tone="slate" />
        <Kpi icon={TrendingUp} value={a.avg_score} label="Score moyen" tone="amber" />
        <Kpi icon={FileText} value={a.quotes_sent} label="Devis générés" tone="slate" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Tunnel de conversion">
          {a.total ? <HBars data={a.funnel} /> : <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>}
        </Panel>
        <Panel title="Sources de leads (canal)">
          {a.sources.length ? <HBars data={a.sources} color="#10b981" /> : <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Distribution des scores">
          <VBars data={a.score_dist.map((d, i) => ({ ...d, hex: ["#f43f5e", "#f59e0b", "#0ea5e9", "#10b981"][i] }))} />
        </Panel>
        <Panel title="Par type de prestation">
          {a.by_purpose.length ? <Donut segments={a.by_purpose} /> : <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p>}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Performance par commercial">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Commercial</th>
                <th className="py-2 pr-4 font-medium">Leads</th>
                <th className="py-2 pr-4 font-medium">Pipeline</th>
                <th className="py-2 font-medium">Panier moyen</th>
              </tr>
            </thead>
            <tbody>
              {a.team.map((t) => (
                <tr key={t.nom} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{t.nom}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{t.leads}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-slate-600">{eur(t.pipeline)}</td>
                  <td className="py-2.5 tabular-nums text-slate-600">{t.avg ? eur(t.avg) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Shell>
  );
}
