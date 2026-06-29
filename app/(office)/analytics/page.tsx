import { BarChart3, Users, Euro, Percent, Clock, FileText } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAnalytics } from "@/lib/dashboard/office-data";
import { eur } from "@/lib/ui/format";
import { Kpi, Panel, PageHeader } from "@/components/office/ui";
import { Donut, VBars, HBars } from "@/components/office/charts";
import { Shell } from "@/components/office/shell";

export const dynamic = "force-dynamic";

/** Délai humain : "14 h" en dessous de 48 h, sinon "2,1 j". */
function delai(h: number | null): string {
  if (h == null) return "—";
  if (h < 48) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1).replace(".", ",")} j`;
}

export default async function AnalyticsPage() {
  const a = await getAnalytics(supabaseAdmin);
  const sla = a.sla;
  return (
    <Shell>
      <PageHeader icon={BarChart3} title="Sales Analytics" subtitle="Vue de performance commerciale" />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Users} value={a.total} label="Total leads" tone="indigo" />
        <Kpi icon={Euro} value={eur(a.pipeline_value)} label="Valeur pipeline" tone="emerald" />
        <Kpi icon={Percent} value={a.win_rate == null ? "—" : `${a.win_rate} %`} label="Taux de conversion" tone="slate" />
        <Kpi icon={Clock} value={delai(sla.avg_h)} label="Délai moyen de réponse" tone="amber" />
        <Kpi icon={FileText} value={a.quotes_sent} label="Devis générés" tone="slate" />
      </section>

      {/* SLA de réponse — l'enjeu n°1 : traiter chaque demande dans la journée */}
      <div className="mt-6">
        <Panel title="Délai de réponse (demande → devis envoyé)" icon={Clock}>
          {sla.responded === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--faint)]">Aucun devis envoyé pour le moment — pas encore de délai mesurable.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SlaStat label="Délai moyen" value={delai(sla.avg_h)} hint="de la demande à l'envoi" />
              <SlaStat label="Délai médian" value={delai(sla.median_h)} hint="moitié des devis plus vite" />
              <SlaStat label="Envoyés < 24 h" value={sla.pct_24h == null ? "—" : `${sla.pct_24h} %`} hint="objectif : le jour même" good={(sla.pct_24h ?? 0) >= 80} bad={(sla.pct_24h ?? 0) < 50} />
              <SlaStat label="Envoyés < 48 h" value={sla.pct_48h == null ? "—" : `${sla.pct_48h} %`} hint="seuil critique" good={(sla.pct_48h ?? 0) >= 90} bad={(sla.pct_48h ?? 0) < 70} />
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--faint)]">
            {`Mesuré sur ${sla.responded} devis effectivement envoyés. Objectif NeoTravel : 100 % des demandes simples traitées le jour même (< 24 h).`}
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Tunnel de conversion">
          {a.total ? <HBars data={a.funnel} /> : <p className="py-8 text-center text-sm text-[var(--faint)]">Aucune donnée.</p>}
        </Panel>
        <Panel title="Sources de leads (canal)">
          {a.sources.length ? <HBars data={a.sources} color="#2c3a1b" /> : <p className="py-8 text-center text-sm text-[var(--faint)]">Aucune donnée.</p>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Distribution des scores">
          <VBars data={a.score_dist.map((d, i) => ({ ...d, hex: ["#b4452f", "#c2a02e", "#2c3a1b", "#2c3a1b"][i] }))} />
        </Panel>
        <Panel title="Par type de prestation">
          {a.by_purpose.length ? <Donut segments={a.by_purpose} /> : <p className="py-8 text-center text-sm text-[var(--faint)]">Aucune donnée.</p>}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Performance par commercial">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--faint)]">
                <th className="py-2 pr-4 font-medium">Commercial</th>
                <th className="py-2 pr-4 font-medium">Leads</th>
                <th className="py-2 pr-4 font-medium">Pipeline</th>
                <th className="py-2 font-medium">Panier moyen</th>
              </tr>
            </thead>
            <tbody>
              {a.team.map((t) => (
                <tr key={t.nom} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-[var(--ink)]">{t.nom}</td>
                  <td className="py-2.5 pr-4 text-[var(--muted)]">{t.leads}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-[var(--muted)]">{eur(t.pipeline)}</td>
                  <td className="py-2.5 tabular-nums text-[var(--muted)]">{t.avg ? eur(t.avg) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Shell>
  );
}

function SlaStat({ label, value, hint, good, bad }: { label: string; value: string; hint: string; good?: boolean; bad?: boolean }) {
  const tone = good ? "text-[var(--forest)]" : bad ? "text-[var(--terracotta)]" : "text-[var(--ink)]";
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/50 p-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--faint)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--faint)]">{hint}</p>
    </div>
  );
}
