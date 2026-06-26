import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, ArrowRight, MoreHorizontal } from "lucide-react";
import { STATUT_META, STATUT_LABEL, URGENCE_BADGE, type Statut } from "@/lib/ui/statuts";

/** Pill de variation ▲/▼ (positif = lime/forest, négatif = terracotta). */
export function DeltaPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.72rem] font-bold tabular-nums"
      style={up ? { background: "var(--lime-soft)", color: "var(--forest)" } : { background: "var(--terracotta-soft)", color: "var(--terracotta-ink)" }}
    >
      <Arrow className="h-3 w-3" strokeWidth={2.6} />
      {Math.abs(pct)}%
    </span>
  );
}

/** Souligne un mot-clé (signature lime) dans un libellé sans casser le reste. */
function withHl(text: string, word?: string) {
  if (!word) return text;
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="hl">{text.slice(i, i + word.length)}</span>
      {text.slice(i + word.length)}
    </>
  );
}

/** Carte de section avec titre + action optionnelle. */
export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`nt-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            {Icon && <Icon className="h-4 w-4 text-[var(--olive)]" strokeWidth={2} />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "indigo" | "emerald" | "amber" | "rose" | "slate";
type Intent = "neutral" | "accent" | "alert";
// Compat : les anciens "tone" sont remappés vers le système d'intentions de marque.
const TONE_INTENT: Record<Tone, Intent> = {
  rose: "alert",
  emerald: "accent",
  indigo: "accent",
  amber: "neutral",
  slate: "neutral",
};

/** Carte KPI — chiffre Jakarta 800, pill d'icône lime-soft, 3 intentions (neutre/accent/alerte). */
export function Kpi({
  icon: Icon,
  value,
  label,
  delta,
  deltaPct,
  compare,
  tone = "slate",
  intent,
  hl,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  delta?: string;
  deltaPct?: number | null;
  compare?: string;
  tone?: Tone;
  intent?: Intent;
  hl?: string;
}) {
  const it: Intent = intent ?? TONE_INTENT[tone];
  const alert = it === "alert";
  const accent = it === "accent";
  return (
    <div
      className="nt-card nt-kpi nt-press p-[18px]"
      style={alert ? { borderColor: "var(--terracotta)", borderWidth: 2 } : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="nt-kpi-ico grid h-9 w-9 place-items-center rounded-full transition-colors"
          style={{ background: alert ? "var(--terracotta)" : "var(--lime-soft)" }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} style={{ color: alert ? "var(--lime-soft)" : "var(--olive)" }} />
        </span>
        {deltaPct != null ? (
          <DeltaPill pct={deltaPct} />
        ) : delta ? (
          <span className="rounded-full px-2 py-0.5 text-[0.72rem] font-bold" style={{ background: "var(--lime-soft)", color: "var(--forest)" }}>
            {delta}
          </span>
        ) : null}
      </div>
      {accent && <span className="mb-2 block h-[3px] w-[18px] rounded-full" style={{ background: "var(--lime)" }} />}
      <p
        className="tabular-nums"
        style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "2.25rem", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--ink)" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-sm font-medium text-[var(--muted)]">{withHl(label, hl)}</p>
      {compare && <p className="mt-1 text-xs text-[var(--faint)]">{compare}</p>}
    </div>
  );
}

/** Carte KPI compacte façon "Nimble" : label + menu, chiffre, delta + comparaison.
 *  Hauteur homogène (flex + mt-auto). Si `href`, la carte devient cliquable et
 *  un indice de redirection apparaît au survol (pas de surprise). */
export function KpiTile({
  label,
  value,
  deltaPct,
  compare,
  accentBar,
  accentColor = "var(--lime)",
  href,
  hint,
}: {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  compare?: string;
  accentBar?: boolean;
  accentColor?: string;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div className={`nt-card relative flex h-full flex-col overflow-hidden p-[18px] ${href ? "nt-kpi nt-press" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[0.82rem] font-medium text-[var(--muted)]">{label}</span>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-[var(--faint)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        ) : (
          <MoreHorizontal className="h-4 w-4 text-[var(--faint)]" />
        )}
      </div>
      {accentBar && <span className="mt-2 block h-[3px] w-[18px] rounded-full" style={{ background: accentColor }} />}
      <p
        className="mt-2 tabular-nums"
        style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.95rem", lineHeight: 1, letterSpacing: "-0.03em", color: "var(--ink)" }}
      >
        {value}
      </p>
      {/* Ligne basse réservée (hauteur fixe) → toutes les cartes alignées */}
      <div className="mt-auto flex min-h-[26px] items-center gap-2 pt-2.5">
        {deltaPct != null && <DeltaPill pct={deltaPct} />}
        {compare && <span className="text-xs text-[var(--faint)]">{compare}</span>}
      </div>
      {/* Indice de redirection au survol */}
      {href && hint && (
        <span className="pointer-events-none absolute inset-x-[18px] bottom-3 flex translate-y-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.7rem] font-semibold opacity-0 shadow-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100" style={{ background: "var(--ink)", color: "var(--cream)" }}>
          <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--lime)" }} /> {hint}
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  ) : (
    <div className="h-full">{inner}</div>
  );
}

/** Métrique-reine en panneau ENCRE (nuage lime animé + chiffre géant + sous-stats + visuel). */
export function HeroMetric({
  kicker,
  value,
  label,
  substats,
  children,
}: {
  kicker: string;
  value: string;
  label: string;
  substats: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="nt-ink-panel relative overflow-hidden rounded-[28px]" style={{ boxShadow: "var(--sh-2)" }}>
      <div className="nt-clouds" aria-hidden />
      <div className="relative z-[1] grid items-center gap-8 p-7 sm:p-9 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block rounded-full bg-white/15 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-white/90">
              {withHl(kicker, "pipeline")}
            </span>
            <span className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: "var(--lime)" }}>
              <span className="nt-live-lime h-[7px] w-[7px] rounded-full" style={{ background: "var(--lime)" }} />
              En direct
            </span>
          </div>
          <p
            className="mt-5 tabular-nums"
            style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "clamp(2.8rem, 6vw, 4rem)", lineHeight: 0.96, letterSpacing: "-0.03em", color: "#fff" }}
          >
            {colorUnits(value)}
          </p>
          <p className="mt-2 text-base text-white/80">{label}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {substats.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2 text-sm font-semibold text-white/90">
                <span style={{ color: "var(--lime)" }}>{s.value}</span>
                <span className="text-white/60">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        {children && <div className="grid place-items-center">{children}</div>}
      </div>
    </section>
  );
}

/** Colore les symboles € / % en lime sur fond sombre. */
function colorUnits(s: string) {
  return s.split(/([€%])/).map((p, i) =>
    /[€%]/.test(p) ? (
      <span key={i} style={{ color: "var(--lime)" }}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/** Badge de statut pipeline (pastille + libellé). */
export function StatusBadge({ statut }: { statut: Statut }) {
  const m = STATUT_META[statut];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${m.badge}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.hex }} />
      {STATUT_LABEL[statut]}
    </span>
  );
}

/** Badge d'urgence (Urgent / High / Medium / Low). */
export function UrgenceBadge({ niveau }: { niveau: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCE_BADGE[niveau] ?? URGENCE_BADGE.Low}`}>
      {niveau}
    </span>
  );
}

/** Pastille de lead score (lime ≥75, lime-soft ≥50, sinon terracotta). */
export function ScorePill({ score }: { score: number }) {
  const style =
    score >= 75
      ? { background: "var(--lime)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--forest)" }
      : score >= 50
        ? { background: "var(--lime-soft)", color: "var(--forest)" }
        : { background: "var(--terracotta-soft)", color: "var(--terracotta-ink)" };
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold tabular-nums" style={style}>
      {score}
    </span>
  );
}

/** En-tête de page (pastille encre + titre Jakarta + soulignage lime). */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  hl,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  hl?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl shadow-sm" style={{ background: "var(--ink)" }}>
          <Icon className="h-5 w-5" strokeWidth={2.2} style={{ color: "var(--lime)" }} />
        </span>
        <div>
          <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em", lineHeight: 1.05, color: "var(--ink)" }}>
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{withHl(subtitle, hl)}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
