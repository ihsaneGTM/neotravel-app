import type { LucideIcon } from "lucide-react";
import { STATUT_META, STATUT_LABEL, URGENCE_BADGE, type Statut } from "@/lib/ui/statuts";

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
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {Icon && <Icon className="h-4 w-4 text-slate-400" strokeWidth={2} />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Carte KPI (icône, valeur, libellé, variation optionnelle). */
export function Kpi({
  icon: Icon,
  value,
  label,
  delta,
  tone = "indigo",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  delta?: string;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="nt-card nt-lift p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        {delta && <span className="text-xs font-semibold text-emerald-600">{delta}</span>}
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Badge de statut pipeline (pastille + libellé). */
export function StatusBadge({ statut }: { statut: Statut }) {
  const m = STATUT_META[statut];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full`} style={{ background: m.hex }} />
      {STATUT_LABEL[statut]}
    </span>
  );
}

/** Badge d'urgence (Urgent / High / Medium / Low). */
export function UrgenceBadge({ niveau }: { niveau: string }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${URGENCE_BADGE[niveau] ?? URGENCE_BADGE.Low}`}>
      {niveau}
    </span>
  );
}

/** Pastille de lead score (vert ≥75, ambre ≥50, sinon rose). */
export function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600";
  return <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold ${tone}`}>{score}</span>;
}

/** En-tête de page (icône + titre + sous-titre). */
export function PageHeader({ icon: Icon, title, subtitle, action }: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
