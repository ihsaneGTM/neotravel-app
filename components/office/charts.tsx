/** Graphiques SVG maison — zéro dépendance, rendus côté serveur. */

export interface Segment {
  label: string;
  value: number;
  hex: string;
}

/** Donut (ex. Pipeline by Status, By Trip Purpose). */
export function Donut({ segments, size = 200, thickness = 22 }: { segments: Segment[]; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#eef1f5" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={s.hex}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          );
          offset += len;
          return el;
        })}
        <text x={cx} y={cx - 4} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 28, fontWeight: 700 }}>
          {total}
        </text>
        <text x={cx} y={cx + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
          total
        </text>
      </svg>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex }} />
            {s.label} <span className="font-medium text-slate-900">({s.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barres verticales (ex. Leads by Source, Lead Score Distribution). */
export function VBars({ data, color = "#4f46e5", height = 180 }: { data: { label: string; value: number; hex?: string }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex max-w-[120px] flex-1 flex-col items-center">
          <span className="mb-1 text-xs font-semibold text-slate-700">{d.value}</span>
          {/* track à hauteur fixe → la barre en % se résout proprement */}
          <div className="flex w-full items-end" style={{ height }}>
            <div
              className="mx-auto w-full max-w-[56px] rounded-t-md transition-all"
              style={{ height: `${(d.value / max) * 100}%`, background: d.hex ?? color, minHeight: d.value > 0 ? 6 : 0 }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="mt-2 truncate text-center text-[0.7rem] text-slate-400" style={{ maxWidth: 90 }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barres horizontales avec valeur à droite (ex. Conversion Funnel, Lead Sources). */
export function HBars({ data, color = "#4f46e5" }: { data: { label: string; value: number; note?: string }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-600">{d.label}</span>
            <span className="text-slate-400">{d.note ?? d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barre de score étiquetée (les 5 dimensions du lead detail). */
export function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="flex-1">
      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
