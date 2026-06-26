"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, ArrowUpRight, MessageSquare, Gauge, Users, PhoneCall, FileText, BarChart3, type LucideIcon } from "lucide-react";
import { DeltaPill } from "./ui";

const WF_ICONS: Record<string, LucideIcon> = { chat: MessageSquare, gauge: Gauge, users: Users, phone: PhoneCall, file: FileText, chart: BarChart3 };

export type PreviewStep = { key: string; label: string; icon: string; tint: string; now: number; nowLabel: string; period: number; periodLabel: string };

/** Aperçu interactif et SPACIEUX du Workflow — gros nœuds lisibles (ici / période), hover, clic → /workflow. */
export function WorkflowPreview({ steps }: { steps: PreviewStep[] }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Link href="/workflow" className="group block">
      {/* Mini-whiteboard au style du vrai workflow : fond chaud + briques à badges qui dépassent + paquets animés */}
      <div className="nt-mapbg relative rounded-2xl border border-[var(--line)] px-5 pb-5 pt-2">
        <div className="nt-scroll-x pt-6">
          <div className="flex min-w-[880px] items-center pb-1">
            {steps.map((s, i) => {
              const Icon = WF_ICONS[s.icon] ?? MessageSquare;
              const active = hover === i;
              const liveStep = s.now > 0 || s.period > 0;
              return (
                <Fragment key={s.key}>
                  <div
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover((p) => (p === i ? null : p))}
                    className="relative flex-1 rounded-2xl border bg-white p-3.5 transition-all duration-200"
                    style={{ borderColor: active ? s.tint : "var(--line-2)", boxShadow: active ? `0 10px 26px ${s.tint}33` : "var(--sh-1)", transform: active ? "translateY(-4px)" : "none" }}
                  >
                    {/* Badges qui dépassent du coin (comme le vrai workflow) */}
                    <span className="pointer-events-none absolute -right-2.5 -top-3.5 z-10 flex items-center">
                      <span className="rotate-[5deg] rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[0.58rem] font-bold tabular-nums text-[var(--forest)] shadow-sm">
                        {s.period} {s.periodLabel}
                      </span>
                      <span className="-ml-2 inline-flex -rotate-[6deg] items-center gap-1 rounded-full px-2 py-0.5 text-[0.58rem] font-bold tabular-nums shadow-md" style={{ background: "var(--ink)", color: "var(--cream)" }}>
                        {s.now > 0 && <span className="nt-live-lime h-1.5 w-1.5 rounded-full" style={{ background: "var(--lime)" }} />}
                        {s.now} {s.nowLabel}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white" style={{ background: s.tint }}>
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      </span>
                      <span className="truncate text-[0.78rem] font-semibold text-[var(--ink)]">{s.label}</span>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0 self-center" style={{ overflow: "visible" }}>
                      <line x1="1" y1="15" x2="29" y2="15" stroke="var(--line-2)" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="1" y1="15" x2="29" y2="15" stroke="#5a7d2a" strokeWidth="2.2" strokeLinecap="round" className="nt-edge-flow" style={{ opacity: 0.85 }} />
                      {liveStep && (
                        <circle r="3.5" fill="#d8e762" stroke="#2c3a1b" strokeWidth="1">
                          <animateMotion dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" path="M1,15 L29,15" />
                        </circle>
                      )}
                    </svg>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--forest)]">
        Ouvrir le workflow complet
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}

type Point = { date: string; leads: number; pipeline: number };

const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const eur0 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const TABS: [string, string][] = [
  ["today", "Aujourd'hui"],
  ["yesterday", "Hier"],
  ["7d", "7 jours"],
  ["14d", "14 jours"],
  ["30d", "30 jours"],
];

/** Sélecteur de période GLOBAL — pilote tout le dashboard via ?period=. */
export function PeriodTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("period") ?? "30d";
  const [pending, setPending] = useState<string | null>(null);
  const go = (k: string) => {
    setPending(k);
    router.push(`/dashboard?period=${k}`);
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full bg-[var(--grey)] p-1">
        {TABS.map(([k, label]) => {
          const active = current === k;
          return (
            <button
              key={k}
              onClick={() => go(k)}
              className="nt-press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={active ? { background: "#fff", color: "var(--ink)", boxShadow: "var(--sh-1)" } : { color: "var(--muted)" }}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--lime-deep)" }} />}
              {label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => go(current)}
        title="Rafraîchir"
        className="nt-press grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

/** Graphe d'activité — barres arrondies dans un track fantôme, gridlines, axe Y, tooltip carte blanche. */
export function ActivityChart({ daily, deltaPct }: { daily: Point[]; deltaPct?: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const leads = daily.map((d) => d.leads);
  const max = Math.max(1, ...leads);
  const total = leads.reduce((s, x) => s + x, 0);
  const ticks = [max, Math.round(max * 0.66), Math.round(max * 0.33), 0];
  const everyLabel = Math.max(1, Math.ceil(daily.length / 8));

  return (
    <section className="nt-card flex h-full flex-col p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">Activité des leads</h2>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="tabular-nums" style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.9rem", letterSpacing: "-0.03em", lineHeight: 1, color: "var(--ink)" }}>
              {total}
            </span>
            {deltaPct != null && <DeltaPill pct={deltaPct} />}
          </div>
          <p className="mt-1 text-xs text-[var(--faint)]">leads acquis sur la période · vs période précédente</p>
        </div>
      </div>

      <div className="relative flex flex-1" style={{ minHeight: 220 }}>
        {/* Axe Y — colonne dédiée (les chiffres respirent, plus collés au bord) */}
        <div className="relative w-10 shrink-0">
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-3 -translate-y-1/2 text-[0.62rem] tabular-nums text-[var(--faint)]" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>

        {/* Zone graphe */}
        <div className="relative flex-1 pr-1">
          {ticks.map((t, i) => (
            <div key={i} className="absolute inset-x-0 h-px" style={{ top: `${(i / (ticks.length - 1)) * 100}%`, background: i === ticks.length - 1 ? "var(--line-2)" : "var(--line)" }} />
          ))}

          <div className="absolute inset-0 flex items-end gap-[3px]">
            {daily.map((d, i) => {
              const h = (d.leads / max) * 100;
              const active = hover === i;
              return (
                <div
                  key={d.date}
                  className="relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((p) => (p === i ? null : p))}
                >
                  <div className="absolute inset-x-0 bottom-0 top-0 rounded-t-[6px]" style={{ background: active ? "var(--lime-soft)" : "rgba(216,231,98,0.14)" }} />
                  <div
                    className="relative w-full rounded-t-[6px] transition-[height,background] duration-200"
                    style={{
                      height: `${h}%`,
                      minHeight: d.leads > 0 ? 4 : 0,
                      background: active ? "var(--lime-deep)" : "linear-gradient(180deg, var(--lime) 0%, var(--lime-deep) 100%)",
                      borderBottom: d.leads > 0 ? "2px solid var(--forest)" : "none",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {hover != null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 shadow-lg"
              style={{ left: `${((hover + 0.5) / daily.length) * 100}%`, bottom: `${(daily[hover].leads / max) * 100}%` }}
            >
              <p className="text-[0.7rem] font-semibold capitalize text-[var(--ink)]">{fmtDay(daily[hover].date)}</p>
              <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-[var(--muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--lime-deep)" }} />
                <b className="text-[var(--ink)]">{daily[hover].leads}</b> lead{daily[hover].leads > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 whitespace-nowrap text-[0.7rem] text-[var(--faint)]">Pipeline cumulé {eur0(daily[hover].pipeline)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="ml-10 mt-3 flex gap-[3px] pr-1">
        {daily.map((d, i) => (
          <div key={d.date} className="flex-1 text-center text-[0.6rem] text-[var(--faint)]">
            {daily.length <= 2 || i % everyLabel === 0 ? fmtDay(d.date) : ""}
          </div>
        ))}
      </div>
    </section>
  );
}
