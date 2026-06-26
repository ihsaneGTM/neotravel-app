import Link from "next/link";
import { ArrowUpRight, ArrowRight, Send, Waypoints, TriangleAlert } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDashboard, PERIODS, type Period } from "@/lib/dashboard/office-data";
import { getWorkflowLive } from "@/lib/workflow/bricks";
import { STATUT_META, STATUT_LABEL } from "@/lib/ui/statuts";
import { eur } from "@/lib/ui/format";
import { Panel, ScorePill, UrgenceBadge, KpiTile } from "@/components/office/ui";
import { Donut, HBars } from "@/components/office/charts";
import { ActivityChart, PeriodTabs, WorkflowPreview, type PreviewStep } from "@/components/office/dash-charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "30d") as Period;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const [d, wf] = await Promise.all([getDashboard(supabaseAdmin, period), getWorkflowLive(supabaseAdmin, period)]);

  const funnel = d.funnel.filter((f) => f.count > 0);
  const donutSegments = funnel.map((f) => ({ label: STATUT_LABEL[f.statut], value: f.count, hex: STATUT_META[f.statut].hex }));

  const kpis = [
    { label: "Nouveaux leads", value: d.new_leads, deltaPct: d.deltas.new_leads, compare: "vs période préc.", accentBar: true, accentColor: "var(--lime)", href: "/leads?view=kanban&highlight=new", hint: "Voir les nouveaux leads" },
    { label: "Devis générés", value: d.quotes_generated, deltaPct: d.deltas.quotes, compare: "vs période préc.", href: "/leads?view=kanban&highlight=quote_sent", hint: "Voir les devis envoyés" },
    { label: "Valeur pipeline", value: eur(d.pipeline_value), deltaPct: d.deltas.pipeline, compare: "vs période préc.", accentBar: true, accentColor: "var(--forest)", href: "/leads?view=kanban&highlight=won", hint: "Voir les deals gagnés" },
    { label: "Taux de conversion", value: d.conversion_rate == null ? "—" : `${d.conversion_rate} %`, compare: "gagné / perdu", href: "/analytics", hint: "Ouvrir les analytics" },
  ];

  // Aperçu interactif du Workflow (depuis les compteurs temps réel) — rampe verte → lime.
  const stepFrom = (key: string, label: string, icon: string, tint: string): PreviewStep => {
    const b = wf[key];
    return { key, label, icon, tint, now: b.now, nowLabel: b.nowLabel, period: b.period, periodLabel: b.periodLabel };
  };
  const wfSteps: PreviewStep[] = [
    stepFrom("chat", "Conversations", "chat", "#2c3a1b"),
    stepFrom("qualif", "Qualification", "gauge", "#3f5a1f"),
    stepFrom("attrib", "Attribution", "users", "#5a7d2a"),
    stepFrom("appel", "Appel", "phone", "#8fae33"),
    stepFrom("devis", "Devis", "file", "#c2d23f"),
    stepFrom("pilotage", "Pilotage", "chart", "#38471f"),
  ];

  return (
    <div className="nt-dashbg min-h-full">
      <div className="nt-in mx-auto max-w-[1180px] px-6 py-8 lg:px-9">
        {/* Barre d'outils : titre + filtre de période GLOBAL */}
        <header className="relative z-40 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em", lineHeight: 1.05, color: "var(--ink)" }}>
              Dashboard
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span>Pilotage commercial · <span className="font-semibold text-[var(--forest)]">{periodLabel}</span></span>
              {d.overdue_followups > 0 && (
                <Link
                  href="/follow-ups?filter=overdue"
                  className="group/al relative inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--terracotta-soft)", color: "var(--terracotta-ink)" }}
                >
                  <TriangleAlert className="h-3 w-3" /> {d.overdue_followups} relance{d.overdue_followups > 1 ? "s" : ""} en retard
                  <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover/al:opacity-100" />
                  {/* Tooltip explicatif */}
                  <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-60 translate-y-1 rounded-xl border border-[var(--line)] bg-white p-2.5 text-left text-[0.72rem] font-normal leading-relaxed text-[var(--muted)] opacity-0 shadow-xl transition-all duration-200 group-hover/al:translate-y-0 group-hover/al:opacity-100">
                    <b className="text-[var(--ink)]">Relances de devis en retard</b> — leur date d'envoi prévue est dépassée. Cliquez pour ouvrir le centre de relances filtré sur « en retard » et les traiter.
                  </span>
                </Link>
              )}
            </p>
          </div>
          <PeriodTabs />
        </header>

        {/* KPIs compacts — une seule ligne */}
        <section className="nt-stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <div key={k.label} className="h-full" style={{ ["--i" as string]: i } as React.CSSProperties}>
              <KpiTile label={k.label} value={k.value} deltaPct={k.deltaPct} compare={k.compare} accentBar={k.accentBar} accentColor={k.accentColor} href={k.href} hint={k.hint} />
            </div>
          ))}
        </section>

        {/* Activité (2/3) + colonne droite (Performance encre + Donut) */}
        <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-3">
          <div className="h-full lg:col-span-2">
            <ActivityChart daily={d.daily} deltaPct={d.deltas.new_leads} />
          </div>

          <div className="flex h-full flex-col gap-6">
            {/* Carte Performance ENCRE (accent de marque, compacte) */}
            <section className="nt-ink-panel relative overflow-hidden rounded-[18px] p-5" style={{ boxShadow: "var(--sh-1)" }}>
              <div className="nt-clouds nt-clouds-soft" aria-hidden />
              <div className="relative z-[1]">
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-white/90">Performance</span>
                  <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: "var(--lime)" }}>
                    <span className="nt-live-lime h-[6px] w-[6px] rounded-full" style={{ background: "var(--lime)" }} /> En direct
                  </span>
                </div>
                <p className="mt-4 tabular-nums" style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "2.6rem", lineHeight: 1, letterSpacing: "-0.03em", color: "#fff" }}>
                  {d.conversion_rate == null ? "—" : <>{d.conversion_rate}<span style={{ color: "var(--lime)" }}>%</span></>}
                </p>
                <p className="mt-1.5 text-sm text-white/75">Taux de conversion</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90">
                    <span style={{ color: "var(--lime)" }}>{d.avg_score}</span> Score moyen
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90">
                    <span style={{ color: "var(--lime)" }}>{d.qualified}</span> Qualifiés
                  </span>
                </div>
              </div>
            </section>

            {/* Donut pipeline par statut */}
            <Panel title="Pipeline par statut" className="flex flex-1 flex-col">
              {donutSegments.length ? (
                <Donut segments={donutSegments} size={168} />
              ) : (
                <p className="py-6 text-center text-sm text-[var(--faint)]">Aucune demande sur la période.</p>
              )}
            </Panel>
          </div>
        </div>

        {/* Aperçu interactif du Workflow (remplace la tendance) */}
        <div className="mt-6">
          <Panel
            title="Aperçu du workflow"
            icon={Waypoints}
            action={
              <Link href="/workflow" className="group flex items-center gap-1 text-xs font-semibold text-[var(--forest)]">
                Configurer <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            }
          >
            <WorkflowPreview steps={wfSteps} />
          </Panel>
        </div>

        {/* Canaux + Opportunités */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Leads par canal">
            {d.by_canal.length ? <HBars data={d.by_canal} /> : <p className="py-6 text-center text-sm text-[var(--faint)]">Aucun canal sur la période.</p>}
          </Panel>

          {/* Opportunités en panneau ENCRE (rythme clair↔sombre) */}
          <section className="nt-ink-panel relative overflow-hidden rounded-[18px] p-5 lg:col-span-2" style={{ boxShadow: "var(--sh-1)" }}>
            <div className="nt-clouds nt-clouds-soft" aria-hidden />
            <div className="relative z-[1]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--cream)]">Opportunités prioritaires</h2>
                <Link href="/leads" className="group flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--lime)" }}>
                  Tout voir <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
              {d.opportunities.length ? (
                <ul className="divide-y divide-white/10">
                  {d.opportunities.map((o) => (
                    <li key={o.id}>
                      <Link href={`/leads/${o.id}`} className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-white/[0.06]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--cream)]">{o.client}</p>
                          <p className="truncate text-xs text-white/55">{o.trajet}</p>
                        </div>
                        <UrgenceBadge niveau={o.urgence} />
                        <ScorePill score={o.score} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-white/55">Aucune opportunité sur la période.</p>
              )}
            </div>
          </section>
        </div>

        {/* Devis prêts à envoyer + relances à venir */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Devis prêts à envoyer" icon={Send}>
            {d.a_envoyer.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {d.a_envoyer.map((q) => (
                  <li key={q.demande_id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{q.client}</p>
                      <p className="truncate text-xs text-[var(--faint)]">{q.trajet}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-[var(--ink)]">{eur(q.prix_ttc)}</span>
                    <Link href={`/leads/${q.demande_id}`} className="nt-btn-lime nt-press px-3.5 py-1.5 text-xs">
                      Envoyer <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--faint)]">Aucun devis en attente d'envoi.</p>
            )}
          </Panel>

          <Panel
            title="Relances à venir"
            action={
              <Link href="/follow-ups" className="group flex items-center gap-1 text-xs font-semibold text-[var(--forest)]">
                Tout voir <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            }
          >
            {d.upcoming.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {d.upcoming.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2.5">
                    <span className="truncate text-sm text-[var(--ink)]">{u.objet}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--lime-soft)", color: "var(--forest)" }}>En attente</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--faint)]">Aucune relance planifiée.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
