"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Gauge, Users, PhoneCall, FileText, Bell, BarChart3,
  Plus, Minus, Maximize2, ArrowUpRight, X, Waypoints, Webhook, Plug, type LucideIcon,
} from "lucide-react";
import type { Brick, BrickLive, IconName, Section } from "@/lib/workflow/bricks";
import { setRelancesCadence } from "@/app/(office)/workflow/actions";

const ICONS: Record<IconName, LucideIcon> = {
  chat: MessageSquare, gauge: Gauge, users: Users, phone: PhoneCall, file: FileText, bell: Bell, chart: BarChart3,
};

const NODE_W = 250;
const NODE_H = 150;
const SUBPATH_EXTRA = 90; // hauteur supplémentaire quand subpaths présents
const brickH = (b: Brick) => b.subpaths && b.subpaths.length > 0 ? NODE_H + SUBPATH_EXTRA : NODE_H;

const PERIOD_TABS: [string, string][] = [
  ["today", "Jour"],
  ["7d", "Semaine"],
  ["30d", "Mois"],
];

export function PipelineMap({ bricks, period = "today" }: { bricks: Brick[]; period?: string }) {
  const router = useRouter();
  const maxX = Math.max(...bricks.map((b) => b.x));
  const maxY = Math.max(...bricks.map((b) => b.y));
  const addNode = { x: maxX + 320, y: 70 };
  const WORLD_W = addNode.x + NODE_W + 120;
  const maxBrickH = Math.max(...bricks.map(brickH));
  const WORLD_H = maxY + maxBrickH + 140;

  const [view, setView] = useState({ x: 60, y: 120, k: 0.9 });
  const [drag, setDrag] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);

  // Badges live « ici » / « période » : init depuis les props, puis polling /api/workflow/live.
  const [liveMap, setLiveMap] = useState<Record<string, BrickLive>>(() =>
    Object.fromEntries(bricks.map((b) => [b.key, b.badges]).filter(([, v]) => v)) as Record<string, BrickLive>
  );
  const [pulse, setPulse] = useState(0); // incrémenté à chaque rafraîchissement (feedback "live")
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/workflow/live?period=${period}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as Record<string, BrickLive>;
        if (alive && j && typeof j === "object" && Object.keys(j).length) {
          setLiveMap((prev) => ({ ...prev, ...j }));
          setPulse((p) => p + 1);
        }
      } catch {
        /* réseau indisponible : on garde les dernières valeurs */
      }
    };
    const id = setInterval(tick, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [period]);

  const wrap = useRef<HTMLDivElement>(null);
  const panStart = useRef({ mx: 0, my: 0, x: 0, y: 0 });
  const clearT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setEdge = (i: number) => { if (clearT.current) clearTimeout(clearT.current); setHoverEdge(i); };
  const scheduleClear = () => { if (clearT.current) clearTimeout(clearT.current); clearT.current = setTimeout(() => setHoverEdge(null), 160); };

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const k = Math.min((el.clientWidth - 80) / WORLD_W, (el.clientHeight - 80) / WORLD_H, 1.1);
    setView({ k, x: (el.clientWidth - WORLD_W * k) / 2, y: (el.clientHeight - WORLD_H * k) / 2 });
  }, [WORLD_W, WORLD_H]);
  useEffect(() => {
    fit();
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Seuls le drawer + la toolbar (data-lock) bloquent le pan/zoom ; au-dessus des briques, on reste dans le whiteboard.
      if ((e.target as HTMLElement)?.closest?.("[data-lock]")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        setView((v) => {
          const k = Math.max(0.12, Math.min(1.9, v.k * (1 - e.deltaY * 0.012)));
          return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-lock]")) return;
    setDrag(true);
    panStart.current = { mx: e.clientX, my: e.clientY, x: view.x, y: view.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setView((v) => ({ ...v, x: panStart.current.x + (e.clientX - panStart.current.mx), y: panStart.current.y + (e.clientY - panStart.current.my) }));
  };
  const stop = () => setDrag(false);
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.max(0.12, Math.min(1.9, v.k + f)) }));

  const aR = (b: Brick) => ({ x: b.x + NODE_W, y: b.y + brickH(b) / 2 });
  const aL = (b: Brick) => ({ x: b.x, y: b.y + brickH(b) / 2 });
  const path = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.max(70, (b.x - a.x) / 2);
    return `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  };

  const selBrick = bricks.find((b) => b.key === sel);
  const insertIdx = sel?.startsWith("insert-") ? Number(sel.slice(7)) : null;

  return (
    <div
      ref={wrap}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={stop}
      onMouseLeave={stop}
      className={`nt-mapbg relative h-full w-full overflow-hidden ${drag ? "cursor-grabbing nt-paused" : "cursor-grab"}`}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transition: drag ? "none" : "transform .18s var(--ease-out)" }}>
        {/* Connecteurs */}
        <svg width={WORLD_W} height={WORLD_H} className="absolute left-0 top-0 overflow-visible" style={{ pointerEvents: "none" }}>
          {bricks.slice(0, -1).map((b, i) => {
            const a = aR(b), c = aL(bricks[i + 1]);
            const blive = liveMap[b.key]?.live ?? b.live;
            const d = path(a, c);
            return (
              <g key={b.key}>
                <path d={d} fill="none" stroke="#e3e6da" strokeWidth={4} strokeLinecap="round" />
                <path d={d} fill="none" stroke={blive ? "#5a7d2a" : "#b8bca8"} strokeWidth={2.4} strokeLinecap="round" className="nt-edge-flow" style={{ opacity: blive ? 0.9 : 0.4 }} />
                {/* magie : paquets de données qui circulent sur les connecteurs actifs */}
                {blive &&
                  [0, 1.3].map((off, k) => (
                    <circle key={k} r={k === 0 ? 5 : 3} fill="#d8e762" stroke={k === 0 ? "#2c3a1b" : "none"} strokeWidth={1.5} opacity={k === 0 ? 0.95 : 0.5}>
                      <animateMotion dur="2.6s" begin={`${i * 0.5 + off}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  ))}
              </g>
            );
          })}
          <path d={path(aR(bricks[bricks.length - 1]), { x: addNode.x, y: addNode.y + NODE_H / 2 })} fill="none" stroke="#c0c8d4" strokeWidth={2.2} strokeDasharray="2 7" strokeLinecap="round" />
        </svg>

        {/* Briques */}
        {bricks.map((b, i) => {
          const Icon = ICONS[b.icon];
          const integ = b.kind === "integration";
          const aConnecter = b.integration?.status === "a_connecter";
          const lv = liveMap[b.key];
          const blive = lv?.live ?? b.live;
          const blabel = lv?.statusLabel ?? b.statusLabel;
          return (
            <button
              key={b.key}
              data-ui
              onClick={() => setSel(b.key)}
              onMouseEnter={() => (i < bricks.length - 1 ? setEdge(i) : scheduleClear())}
              onMouseLeave={scheduleClear}
              className={`nt-node-card absolute rounded-[18px] text-left transition-all ${integ ? "border-2 border-dashed" : "border"}`}
              style={{ left: b.x, top: b.y, width: NODE_W, minHeight: brickH(b), borderColor: sel === b.key ? b.tint : "var(--line-2)", boxShadow: sel === b.key ? `0 0 0 2px ${b.tint}, var(--sh-3)` : undefined }}
            >
              {/* Badges live qui dépassent du coin (l'un dans l'autre, inclinés) */}
              {lv && (
                <span className="pointer-events-none absolute -right-3 -top-3.5 z-10 flex items-center">
                  <span className="rotate-[5deg] rounded-full border border-[var(--line)] bg-white px-2 py-1 text-[0.6rem] font-bold tabular-nums text-[var(--forest)] shadow-sm">
                    {lv.period} {lv.periodLabel}
                  </span>
                  <span className="-ml-2 inline-flex -rotate-[6deg] items-center gap-1 rounded-full px-2 py-1 text-[0.6rem] font-bold tabular-nums shadow-md" style={{ background: "var(--ink)", color: "var(--cream)" }}>
                    {lv.now > 0 && <span className="nt-live-lime h-1.5 w-1.5 rounded-full" style={{ background: "var(--lime)" }} />}
                    {lv.now} {lv.nowLabel}
                  </span>
                </span>
              )}
              <div className="flex items-center gap-2.5 px-4 pt-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: b.tint }}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-[13.5px] font-semibold leading-tight text-[var(--ink)]">{b.title}</span>
                {integ && <Webhook className="h-4 w-4 text-[var(--faint)]" />}
              </div>
              <div className="px-4 pb-1 pt-2.5">
                <StatusTag live={blive} label={blabel} aConnecter={aConnecter} />
              </div>
              <div className="flex gap-5 px-4 pb-4 pt-1">
                {b.metrics.map((m) => (
                  <div key={m.label}>
                    <p className="text-base font-bold leading-none text-[var(--ink)]">{m.value}</p>
                    <p className="mt-1 text-[0.7rem] text-[var(--faint)]">{m.label}</p>
                  </div>
                ))}
              </div>
              {b.subpaths && b.subpaths.length > 0 && (() => {
                const total = b.subpaths.reduce((s, p) => s + p.count, 0);
                return (
                  <div className="mx-3 mb-3 border-t border-[var(--line)] pt-2">
                    <p className="mb-1.5 text-[0.58rem] font-bold uppercase tracking-wider text-[var(--faint)]">Chemins de sortie</p>
                    <div className="space-y-1.5">
                      {b.subpaths.map((p) => (
                        <div key={p.key} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.tint }} />
                          <span className="w-[58px] truncate text-[0.63rem] font-medium text-[var(--muted)]">{p.label}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--grey)]">
                            <div className="h-full rounded-full transition-all" style={{ width: total > 0 ? `${(p.count / total) * 100}%` : "0%", background: p.tint, opacity: 0.75 }} />
                          </div>
                          <span className="w-4 text-right text-[0.63rem] font-bold tabular-nums text-[var(--ink)]">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </button>
          );
        })}

        {/* + insertion entre briques */}
        {bricks.slice(0, -1).map((b, i) => {
          const a = aR(b), c = aL(bricks[i + 1]);
          const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
          return (
            <div key={`ins-${i}`} data-ui onMouseEnter={() => setEdge(i)} onMouseLeave={scheduleClear} className="absolute" style={{ left: mx - 28, top: my - 28, width: 56, height: 56 }}>
              <button onClick={() => setSel(`insert-${i}`)} title={`Insérer une brique entre « ${b.title} » et « ${bricks[i + 1].title} »`}
                className={`absolute left-[10px] top-[10px] grid h-9 w-9 place-items-center rounded-full border-2 border-dashed bg-white text-[var(--olive)] shadow-sm transition-all duration-150 ${hoverEdge === i ? "scale-100 border-[var(--lime-deep)] opacity-100 hover:bg-[var(--lime-soft)]" : "pointer-events-none scale-50 border-[var(--line-2)] opacity-0"}`}>
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          );
        })}

        {/* Ajouter une brique */}
        <button data-ui onClick={() => setSel("add")} className="absolute grid place-items-center rounded-[18px] border-2 border-dashed border-[var(--line-2)] bg-white/40 text-[var(--faint)] transition-colors hover:border-[var(--lime-deep)] hover:text-[var(--olive)]" style={{ left: addNode.x, top: addNode.y, width: NODE_W, height: NODE_H }}>
          <Plus className="h-7 w-7" strokeWidth={2} />
          <span className="mt-1 text-sm font-medium">Ajouter une brique</span>
          <span className="mt-0.5 px-6 text-center text-[0.68rem] text-[var(--faint)]">webhook, API, enrichissement, canal…</span>
        </button>
      </div>

      {/* Toolbar */}
      <div data-lock className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ink)] text-[var(--cream)] shadow-sm"><Waypoints className="h-5 w-5" strokeWidth={2.2} /></span>
          <div>
            <p className="text-sm font-bold leading-tight text-[var(--ink)]">Workflow</p>
            <p className="text-xs text-[var(--faint)]">Configuration réelle du pipeline · cliquez une brique</p>
          </div>
          <div className="ml-3 flex items-center gap-3 border-l border-[var(--line)] pl-3 text-[0.7rem] text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span key={pulse} className="nt-live-dot h-1.5 w-1.5 rounded-full bg-[var(--forest)]" /> temps réel</span>
            <span className="flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5 text-[var(--faint)]" /> intégration</span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Filtre de période (jour / semaine / mois) — pilote les badges live */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white/80 p-1 shadow-sm backdrop-blur">
            {PERIOD_TABS.map(([k, label]) => {
              const active = period === k;
              return (
                <button
                  key={k}
                  data-ui
                  onClick={() => router.push(`/workflow?period=${k}`)}
                  className="nt-press rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                  style={active ? { background: "var(--ink)", color: "var(--cream)" } : { color: "var(--muted)" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center rounded-xl border border-[var(--line)] bg-white/80 p-1 shadow-sm backdrop-blur">
            <button data-ui onClick={() => zoom(-0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--grey)]"><Minus className="h-4 w-4" /></button>
            <span className="w-11 text-center text-xs font-medium text-[var(--muted)]">{Math.round(view.k * 100)}%</span>
            <button data-ui onClick={() => zoom(0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--grey)]"><Plus className="h-4 w-4" /></button>
            <button data-ui onClick={fit} title="Ajuster" className="nt-press grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--grey)]"><Maximize2 className="h-4 w-4" /></button>
          </div>
          <button data-ui onClick={() => setSel("add")} className="nt-press flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-3.5 py-2 text-sm font-medium text-[var(--cream)] shadow-sm hover:bg-[#20231a]"><Plus className="h-4 w-4" /> Brique</button>
        </div>
      </div>

      {/* Drawer de configuration */}
      {sel && (
        <aside data-lock className="nt-scroll nt-in absolute right-4 top-20 bottom-4 w-[380px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/95 p-5 shadow-[var(--sh-3)] backdrop-blur">
          <button data-ui onClick={() => setSel(null)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-[var(--faint)] hover:bg-[var(--grey)]"><X className="h-4 w-4" /></button>

          {insertIdx != null && bricks[insertIdx + 1] ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--lime-soft)] text-[var(--forest)]"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-[var(--ink)]">Insérer une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Ajouter une étape <strong>entre « {bricks[insertIdx].title} » et « {bricks[insertIdx + 1].title} »</strong> : webhook, enrichissement de données, validation/QA, règle conditionnelle…</p>
              <p className="mt-3 rounded-xl bg-[#f6ead0] px-3 py-2 text-xs text-[#8a5a1f]">L'édition du workflow depuis la map arrive dans une prochaine itération.</p>
            </div>
          ) : sel === "add" ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--lime-soft)] text-[var(--forest)]"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-[var(--ink)]">Ajouter une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Étends le pipeline : webhook entrant (téléphonie, paiement), API d'enrichissement, MCP, nouveau canal de captation, règle d'attribution sur-mesure.</p>
              <p className="mt-3 rounded-xl bg-[#f6ead0] px-3 py-2 text-xs text-[#8a5a1f]">Configuration depuis la map à venir.</p>
            </div>
          ) : selBrick ? (
            <BrickDetail brick={selBrick} />
          ) : null}
        </aside>
      )}

      <p data-ui className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-3 py-1 text-[0.7rem] text-[var(--faint)] backdrop-blur">Deux doigts (ou glisser) pour déplacer · pincez ou ⌘+molette pour zoomer</p>
    </div>
  );
}

function StatusTag({ live, label, aConnecter }: { live: boolean; label: string; aConnecter?: boolean }) {
  if (live) return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-[var(--forest)]"><span className="nt-live-dot h-1.5 w-1.5 rounded-full bg-[var(--forest)]" /> {label}</span>;
  if (aConnecter) return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-[#8a5a1f]"><Plug className="h-3 w-3" /> {label}</span>;
  return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--faint)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--line-2)]" /> {label}</span>;
}

function BrickDetail({ brick: b }: { brick: Brick }) {
  const Icon = ICONS[b.icon];
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: b.tint }}><Icon className="h-5 w-5" strokeWidth={2.2} /></span>
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">{b.title}</h3>
          <span className={`text-xs font-medium ${b.live ? "text-[var(--forest)]" : "text-[var(--faint)]"}`}>{b.kind === "integration" ? "Intégration" : b.kind === "ia" ? "IA" : b.kind === "data" ? "Données" : "Code"} · {b.statusLabel}</span>
        </div>
      </div>

      {b.integration && (
        <div className={`mt-3 rounded-xl border p-3 ${b.integration.status === "connecte" ? "border-[var(--lime-deep)] bg-[var(--lime-soft)]" : "border-[#e3cf9e] bg-[#f6ead0]"}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]"><Webhook className="h-3.5 w-3.5" /> {b.integration.via.toUpperCase()}</span>
            <span className={`text-xs font-medium ${b.integration.status === "connecte" ? "text-[var(--forest)]" : "text-[#8a5a1f]"}`}>{b.integration.status === "connecte" ? "connecté" : "à connecter"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {b.integration.providers.map((p) => <span key={p} className="rounded-md bg-white px-2 py-0.5 text-[0.7rem] font-medium text-[var(--muted)] shadow-sm">{p}</span>)}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {b.sections.map((s, i) => <SectionView key={i} s={s} />)}
      </div>

      {b.links.length > 0 && (
        <div className="mt-5 space-y-2">
          {b.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="nt-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--cream)] hover:bg-[#20231a]">
              {l.label} <ArrowUpRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CadenceEditor({ offsets, title }: { offsets: number[]; title?: string }) {
  const [list, setList] = useState<number[]>(offsets);
  const [val, setVal] = useState("");
  const add = () => {
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n > 0 && !list.includes(n)) setList([...list, n].sort((a, b) => a - b));
    setVal("");
  };
  return (
    <form action={setRelancesCadence}>
      {title && <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--faint)]">{title}</p>}
      <input type="hidden" name="offsets" value={list.join(",")} />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] p-2.5">
        {list.map((n) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full bg-[var(--lime-soft)] px-2.5 py-1 text-xs font-medium text-[var(--forest)]">
            J+{n}
            <button type="button" onClick={() => setList(list.filter((x) => x !== n))} className="text-[var(--olive)] hover:text-[var(--forest)]"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} type="number" min={1} placeholder="J+" className="w-14 rounded-lg border border-[var(--line)] px-2 py-1 text-xs outline-none" />
          <button type="button" onClick={add} className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--grey)] text-[var(--muted)] hover:bg-[var(--line-2)]"><Plus className="h-3.5 w-3.5" /></button>
        </span>
      </div>
      <button type="submit" className="nt-press mt-2 w-full rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--cream)] hover:bg-[#20231a]">Enregistrer la cadence</button>
    </form>
  );
}

function SectionView({ s }: { s: Section }) {
  if (s.type === "note") return <p className="text-sm leading-relaxed text-[var(--muted)]">{s.text}</p>;
  if (s.type === "cadence") return <CadenceEditor offsets={s.offsets} title={s.title} />;
  if (s.type === "kv")
    return (
      <div>
        {s.title && <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--faint)]">{s.title}</p>}
        <dl className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {s.rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <dt className="shrink-0 font-medium text-[var(--muted)]">{r.k}</dt>
              <dd className="text-right text-[var(--ink)]">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  if (s.type === "table")
    return (
      <div>
        {s.title && <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--faint)]">{s.title}</p>}
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-soft)] text-left text-[var(--faint)]">
                {s.columns.map((c) => <th key={c} className="px-2.5 py-1.5 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  {row.map((cell, j) => <td key={j} className={`px-2.5 py-1.5 ${j === 0 ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  // code
  return (
    <details className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]">
      <summary className="cursor-pointer px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--faint)]">{s.title ?? "Code"}</summary>
      <pre className="max-h-72 overflow-auto border-t border-[var(--line)] p-3 text-[0.7rem] leading-relaxed text-[var(--muted)]"><code>{s.text}</code></pre>
    </details>
  );
}
