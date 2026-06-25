"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Gauge, Users, PhoneCall, FileText, Bell, BarChart3,
  Plus, Minus, Maximize2, ArrowUpRight, X, Waypoints, Webhook, Plug, type LucideIcon,
} from "lucide-react";
import type { Brick, IconName, Section } from "@/lib/workflow/bricks";

const ICONS: Record<IconName, LucideIcon> = {
  chat: MessageSquare, gauge: Gauge, users: Users, phone: PhoneCall, file: FileText, bell: Bell, chart: BarChart3,
};

const NODE_W = 250;
const NODE_H = 150;

export function PipelineMap({ bricks }: { bricks: Brick[] }) {
  const maxX = Math.max(...bricks.map((b) => b.x));
  const maxY = Math.max(...bricks.map((b) => b.y));
  const addNode = { x: maxX + 320, y: 70 };
  const WORLD_W = addNode.x + NODE_W + 120;
  const WORLD_H = maxY + NODE_H + 140;

  const [view, setView] = useState({ x: 60, y: 120, k: 0.9 });
  const [drag, setDrag] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
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
  useEffect(() => { fit(); }, [fit]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        setView((v) => {
          const k = Math.max(0.4, Math.min(1.9, v.k * (1 - e.deltaY * 0.012)));
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
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    setDrag(true);
    panStart.current = { mx: e.clientX, my: e.clientY, x: view.x, y: view.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setView((v) => ({ ...v, x: panStart.current.x + (e.clientX - panStart.current.mx), y: panStart.current.y + (e.clientY - panStart.current.my) }));
  };
  const stop = () => setDrag(false);
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.max(0.4, Math.min(1.9, v.k + f)) }));

  const aR = (b: { x: number; y: number }) => ({ x: b.x + NODE_W, y: b.y + NODE_H / 2 });
  const aL = (b: { x: number; y: number }) => ({ x: b.x, y: b.y + NODE_H / 2 });
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
            return (
              <g key={b.key}>
                <path d={path(a, c)} fill="none" stroke="#cdd5e1" strokeWidth={4} strokeLinecap="round" />
                <path d={path(a, c)} fill="none" stroke={b.live ? "#6366f1" : "#aab2c0"} strokeWidth={2.4} strokeLinecap="round" className="nt-edge-flow" style={{ opacity: b.live ? 0.85 : 0.4 }} />
              </g>
            );
          })}
          <path d={path(aR(bricks[bricks.length - 1]), aL(addNode))} fill="none" stroke="#c0c8d4" strokeWidth={2.2} strokeDasharray="2 7" strokeLinecap="round" />
        </svg>

        {/* Briques */}
        {bricks.map((b, i) => {
          const Icon = ICONS[b.icon];
          const integ = b.kind === "integration";
          const aConnecter = b.integration?.status === "a_connecter";
          return (
            <button
              key={b.key}
              data-ui
              onClick={() => setSel(b.key)}
              onMouseEnter={() => (i < bricks.length - 1 ? setEdge(i) : scheduleClear())}
              onMouseLeave={scheduleClear}
              className={`nt-node-card absolute rounded-[18px] text-left transition-all ${integ ? "border-2 border-dashed" : "border"}`}
              style={{ left: b.x, top: b.y, width: NODE_W, minHeight: NODE_H, borderColor: sel === b.key ? b.tint : integ ? "#cbd5e1" : "var(--line-2)", boxShadow: sel === b.key ? `0 0 0 2px ${b.tint}, var(--sh-3)` : undefined }}
            >
              <div className="flex items-center gap-2.5 px-4 pt-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: b.tint }}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-[13.5px] font-semibold leading-tight text-slate-800">{b.title}</span>
                {integ && <Webhook className="h-4 w-4 text-slate-300" />}
              </div>
              <div className="px-4 pb-1 pt-2.5">
                <StatusTag live={b.live} label={b.statusLabel} aConnecter={aConnecter} />
              </div>
              <div className="flex gap-5 px-4 pb-4 pt-1">
                {b.metrics.map((m) => (
                  <div key={m.label}>
                    <p className="text-base font-bold leading-none text-slate-900">{m.value}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-400">{m.label}</p>
                  </div>
                ))}
              </div>
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
                className={`absolute left-[10px] top-[10px] grid h-9 w-9 place-items-center rounded-full border-2 border-dashed bg-white text-indigo-500 shadow-sm transition-all duration-150 ${hoverEdge === i ? "scale-100 border-indigo-300 opacity-100 hover:bg-indigo-50" : "pointer-events-none scale-50 border-slate-300 opacity-0"}`}>
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          );
        })}

        {/* Ajouter une brique */}
        <button data-ui onClick={() => setSel("add")} className="absolute grid place-items-center rounded-[18px] border-2 border-dashed border-slate-300 bg-white/40 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500" style={{ left: addNode.x, top: addNode.y, width: NODE_W, height: NODE_H }}>
          <Plus className="h-7 w-7" strokeWidth={2} />
          <span className="mt-1 text-sm font-medium">Ajouter une brique</span>
          <span className="mt-0.5 px-6 text-center text-[0.68rem] text-slate-400">webhook, API, enrichissement, canal…</span>
        </button>
      </div>

      {/* Toolbar */}
      <div data-ui className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><Waypoints className="h-5 w-5" strokeWidth={2.2} /></span>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">Workflow</p>
            <p className="text-xs text-slate-400">Configuration réelle du pipeline · cliquez une brique</p>
          </div>
          <div className="ml-3 flex items-center gap-3 border-l border-[var(--line)] pl-3 text-[0.7rem] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="nt-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> live</span>
            <span className="flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5 text-slate-400" /> intégration</span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[var(--line)] bg-white/80 p-1 shadow-sm backdrop-blur">
            <button data-ui onClick={() => zoom(-0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Minus className="h-4 w-4" /></button>
            <span className="w-11 text-center text-xs font-medium text-slate-500">{Math.round(view.k * 100)}%</span>
            <button data-ui onClick={() => zoom(0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Plus className="h-4 w-4" /></button>
            <button data-ui onClick={fit} title="Ajuster" className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Maximize2 className="h-4 w-4" /></button>
          </div>
          <button data-ui onClick={() => setSel("add")} className="nt-press flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"><Plus className="h-4 w-4" /> Brique</button>
        </div>
      </div>

      {/* Drawer de configuration */}
      {sel && (
        <aside data-ui className="nt-scroll nt-in absolute right-4 top-20 bottom-4 w-[380px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/95 p-5 shadow-[var(--sh-3)] backdrop-blur">
          <button data-ui onClick={() => setSel(null)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>

          {insertIdx != null && bricks[insertIdx + 1] ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Insérer une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Ajouter une étape <strong>entre « {bricks[insertIdx].title} » et « {bricks[insertIdx + 1].title} »</strong> : webhook, enrichissement de données, validation/QA, règle conditionnelle…</p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">L'édition du workflow depuis la map arrive dans une prochaine itération.</p>
            </div>
          ) : sel === "add" ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Ajouter une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Étends le pipeline : webhook entrant (téléphonie, paiement), API d'enrichissement, MCP, nouveau canal de captation, règle d'attribution sur-mesure.</p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Configuration depuis la map à venir.</p>
            </div>
          ) : selBrick ? (
            <BrickDetail brick={selBrick} />
          ) : null}
        </aside>
      )}

      <p data-ui className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-3 py-1 text-[0.7rem] text-slate-400 backdrop-blur">Deux doigts (ou glisser) pour déplacer · pincez ou ⌘+molette pour zoomer</p>
    </div>
  );
}

function StatusTag({ live, label, aConnecter }: { live: boolean; label: string; aConnecter?: boolean }) {
  if (live) return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-emerald-600"><span className="nt-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> {label}</span>;
  if (aConnecter) return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-amber-600"><Plug className="h-3 w-3" /> {label}</span>;
  return <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> {label}</span>;
}

function BrickDetail({ brick: b }: { brick: Brick }) {
  const Icon = ICONS[b.icon];
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: b.tint }}><Icon className="h-5 w-5" strokeWidth={2.2} /></span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{b.title}</h3>
          <span className={`text-xs font-medium ${b.live ? "text-emerald-600" : "text-slate-400"}`}>{b.kind === "integration" ? "Intégration" : b.kind === "ia" ? "IA" : b.kind === "data" ? "Données" : "Code"} · {b.statusLabel}</span>
        </div>
      </div>

      {b.integration && (
        <div className={`mt-3 rounded-xl border p-3 ${b.integration.status === "connecte" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Webhook className="h-3.5 w-3.5" /> {b.integration.via.toUpperCase()}</span>
            <span className={`text-xs font-medium ${b.integration.status === "connecte" ? "text-emerald-700" : "text-amber-700"}`}>{b.integration.status === "connecte" ? "connecté" : "à connecter"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {b.integration.providers.map((p) => <span key={p} className="rounded-md bg-white px-2 py-0.5 text-[0.7rem] font-medium text-slate-600 shadow-sm">{p}</span>)}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {b.sections.map((s, i) => <SectionView key={i} s={s} />)}
      </div>

      {b.links.length > 0 && (
        <div className="mt-5 space-y-2">
          {b.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="nt-press flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
              {l.label} <ArrowUpRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionView({ s }: { s: Section }) {
  if (s.type === "note") return <p className="text-sm leading-relaxed text-slate-600">{s.text}</p>;
  if (s.type === "kv")
    return (
      <div>
        {s.title && <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">{s.title}</p>}
        <dl className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {s.rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <dt className="shrink-0 font-medium text-slate-500">{r.k}</dt>
              <dd className="text-right text-slate-700">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  if (s.type === "table")
    return (
      <div>
        {s.title && <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">{s.title}</p>}
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-400">
                {s.columns.map((c) => <th key={c} className="px-2.5 py-1.5 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  {row.map((cell, j) => <td key={j} className={`px-2.5 py-1.5 ${j === 0 ? "font-medium text-slate-700" : "text-slate-500"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  // code
  return (
    <details className="rounded-xl border border-[var(--line)] bg-slate-50/50">
      <summary className="cursor-pointer px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">{s.title ?? "Code"}</summary>
      <pre className="max-h-72 overflow-auto border-t border-[var(--line)] p-3 text-[0.7rem] leading-relaxed text-slate-600"><code>{s.text}</code></pre>
    </details>
  );
}
