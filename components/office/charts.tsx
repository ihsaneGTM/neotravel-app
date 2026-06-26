/** Graphiques SVG maison — zéro dépendance, rendus côté serveur. Palette de marque. */

export interface Segment {
  label: string;
  value: number;
  hex: string;
}

const LIME = "#d8e762";
const FOREST = "#2c3a1b";

/** Donut (ex. Pipeline par statut). Rail lime-soft, segments détachés, appui forest sur le lime. */
export function Donut({ segments, size = 200, thickness = 20 }: { segments: Segment[]; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  const gap = total > 1 ? 2 : 0; // petit espace blanc entre segments → premium
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--lime-soft)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = Math.max(0, (s.value / total) * C - gap);
          const isLight = s.hex === LIME; // lime pur → appui forest (jamais d'aplat lime nu)
          const seg = (
            <g key={i}>
              {isLight && (
                <circle
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={FOREST}
                  strokeWidth={thickness + 3}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${cx} ${cx})`}
                />
              )}
              <circle
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
            </g>
          );
          offset += (s.value / total) * C;
          return seg;
        })}
        <text x={cx} y={cx - 3} textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: "var(--ink)", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
          {total}
        </text>
        <text x={cx} y={cx + 16} textAnchor="middle" style={{ fontSize: 11, fill: "var(--faint)" }}>
          total
        </text>
      </svg>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[var(--muted)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex, boxShadow: s.hex === LIME ? `0 0 0 1px ${FOREST}` : undefined }} />
            {s.label} <span className="font-semibold text-[var(--ink)]">({s.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barres verticales (ex. Leads par canal). Remplissage lime + assise forest. */
export function VBars({ data, color = FOREST, height = 180 }: { data: { label: string; value: number; hex?: string }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 border-b border-[var(--line-2)] pb-0">
      {data.map((d) => {
        const isMax = d.value === max && max > 0;
        // dominant = lime pur ; autres = dégradé lime doux → lime-deep ; hex explicite prioritaire
        const fill = d.hex
          ? d.hex
          : isMax
            ? "var(--lime)"
            : "linear-gradient(180deg, var(--lime-soft) 0%, var(--lime-deep) 100%)";
        return (
          <div key={d.label} className="flex max-w-[120px] flex-1 flex-col items-center">
            <span className="mb-1.5 text-xs font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--font-jakarta)" }}>
              {d.value}
            </span>
            <div className="flex w-full items-end" style={{ height }}>
              <div
                className="mx-auto w-full max-w-[56px] rounded-t-[10px] transition-all"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  background: fill,
                  borderBottom: `2px solid ${color}`,
                  minHeight: d.value > 0 ? 6 : 0,
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <span className="mt-2 truncate text-center text-[0.7rem] text-[var(--faint)]" style={{ maxWidth: 90 }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barres horizontales avec valeur à droite (ex. tunnel de conversion, sources). */
export function HBars({ data, color = FOREST }: { data: { label: string; value: number; note?: string }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">{d.label}</span>
            <span className="text-[var(--faint)]">{d.note ?? d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--lime-soft)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Courbe d'aire (ex. tendance pipeline 30 j) — dégradé lime, ligne forest, point final. */
export function TrendArea({
  data,
  height = 200,
  fmt = (n: number) => String(n),
  gradientId = "nt-trend",
}: {
  data: { date: string; value: number }[];
  height?: number;
  fmt?: (n: number) => string;
  gradientId?: string;
}) {
  const W = 760;
  const H = height;
  const padT = 16;
  const padB = 26;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `M 0,${H - padB} L ${pts.join(" L ")} L ${W},${H - padB} Z`;
  const last = data[n - 1];
  const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const gl = [0.5, 1].map((f) => padT + f * (H - padT - padB));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8e762" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#d8e762" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {gl.map((gy, i) => (
          <line key={i} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--line)" strokeWidth={1} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="var(--line-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="var(--forest)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {/* point final */}
        <circle cx={x(n - 1)} cy={y(last.value)} r={5} fill="#d8e762" stroke="var(--forest)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.62rem] text-[var(--faint)]">
        <span className="capitalize">{fmtDay(data[0].date)}</span>
        <span className="font-semibold text-[var(--ink)]">{fmt(last.value)}</span>
        <span className="capitalize">{fmtDay(last.date)}</span>
      </div>
    </div>
  );
}

/** Barre de score étiquetée (les 5 dimensions du lead detail). Seuils chauds. */
export function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 75 ? "var(--forest)" : pct >= 50 ? "var(--lime-deep)" : "var(--terracotta)";
  return (
    <div className="flex-1">
      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--faint)]">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--lime-soft)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}
