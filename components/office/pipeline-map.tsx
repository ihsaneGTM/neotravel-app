"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Gauge,
  Users,
  FileText,
  Bell,
  BarChart3,
  Plus,
  Minus,
  Maximize2,
  ArrowUpRight,
  Settings2,
  X,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { MapData } from "@/lib/dashboard/office-data";
import { eur } from "@/lib/ui/format";

interface NodeDef {
  key: string;
  title: string;
  icon: LucideIcon;
  tint: string;
  x: number;
  y: number;
  live: boolean;
  href: string;
  hrefLabel: string;
  stats: { label: string; value: string | number }[];
  desc: string;
  extra?: { label: string; value: string }[];
}

const NODE_W = 248;
const NODE_H = 148;
const WORLD_W = 2180;
const WORLD_H = 470;

export function PipelineMap({ data }: { data: MapData }) {
  const nodes: NodeDef[] = [
    {
      key: "chat", title: "Conversation IA", icon: MessageSquare, tint: "#4f46e5", x: 40, y: 70, live: data.captation.total > 0,
      href: "/", hrefLabel: "Ouvrir le chat",
      stats: [{ label: "Leads captés", value: data.captation.total }, { label: "via chat IA", value: data.captation.via_chat }],
      desc: "Point d'entrée : l'assistant qualifie le besoin, capte les coordonnées (email obligatoire) et crée le lead. Aucun prix communiqué au prospect.",
      extra: [{ label: "Modèle", value: data.model_agent }],
    },
    {
      key: "qualif", title: "Qualification & scoring", icon: Gauge, tint: "#0ea5e9", x: 360, y: 220, live: data.qualification.progresses > 0,
      href: "/leads", hrefLabel: "Voir les leads",
      stats: [{ label: "Leads avancés", value: data.qualification.progresses }, { label: "Score moyen", value: data.qualification.avg_score }],
      desc: "Matrice de complexité + scoring multi-facteurs (budget, urgence, volume, complétude). Définit la priorité et le routage.",
    },
    {
      key: "attrib", title: "Attribution / CRM", icon: Users, tint: "#10b981", x: 680, y: 70, live: data.attribution.attribues > 0,
      href: "/leads", hrefLabel: "Ouvrir le CRM",
      stats: [{ label: "Attribués", value: data.attribution.attribues }, { label: "Commerciaux", value: data.attribution.commerciaux }],
      desc: "Attribution automatique (équité des commissions, puis spécialité) avec un résumé enrichi pour le commercial.",
    },
    {
      key: "devis", title: "Devis", icon: FileText, tint: "#f59e0b", x: 1000, y: 220, live: data.devis.count > 0,
      href: "/simulateur", hrefLabel: "Ouvrir le simulateur",
      stats: [{ label: "Devis", value: data.devis.count }, { label: "Pipeline", value: eur(data.devis.pipeline) }],
      desc: "calculer_devis() déterministe. Preview puis envoi réel par email (preuve enregistrée). Le statut « envoyé » n'apparaît qu'après envoi.",
    },
    {
      key: "relances", title: "Relances", icon: Bell, tint: "#8b5cf6", x: 1320, y: 70, live: data.relances.pending > 0,
      href: "/follow-ups", hrefLabel: "Centre de relances",
      stats: [{ label: "En attente", value: data.relances.pending }, { label: "En retard", value: data.relances.overdue }],
      desc: "Relances email automatiques (J+1 / J+3 / J+7) via Vercel Cron + Resend, jusqu'à conversion ou clôture.",
    },
    {
      key: "pilotage", title: "Pilotage", icon: BarChart3, tint: "#64748b", x: 1640, y: 220, live: data.pilotage.won > 0 || data.pilotage.conversion != null,
      href: "/dashboard", hrefLabel: "Ouvrir le dashboard",
      stats: [{ label: "Gagnés", value: data.pilotage.won }, { label: "Conversion", value: data.pilotage.conversion == null ? "—" : `${data.pilotage.conversion} %` }],
      desc: "Funnel, délais de prise en charge (<48 h), taux de conversion et équité des commissions, alimentés en continu.",
    },
  ];
  const addNode = { x: 1960, y: 70 };

  const [view, setView] = useState({ x: 60, y: 120, k: 0.92 });
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
  }, []);

  useEffect(() => { fit(); }, [fit]);

  // Zoom molette (non-passif) centré sur le curseur
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Pincer (trackpad) ou Ctrl/⌘+molette → zoom centré sur le curseur.
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setView((v) => {
          const k = Math.max(0.4, Math.min(1.9, v.k * (1 - e.deltaY * 0.012)));
          const wx = (cx - v.x) / v.k;
          const wy = (cy - v.y) / v.k;
          return { k, x: cx - wx * k, y: cy - wy * k };
        });
      } else {
        // Deux doigts sur le trackpad (façon Figma) → déplacement.
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

  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.max(0.45, Math.min(1.8, v.k + f)) }));

  const anchorR = (n: { x: number; y: number }) => ({ x: n.x + NODE_W, y: n.y + NODE_H / 2 });
  const anchorL = (n: { x: number; y: number }) => ({ x: n.x, y: n.y + NODE_H / 2 });
  const path = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.max(70, (b.x - a.x) / 2);
    return `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  };

  const selNode = nodes.find((n) => n.key === sel);
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
      {/* Monde transformable */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transition: drag ? "none" : "transform .18s var(--ease-out)" }}
      >
        {/* Connecteurs */}
        <svg width={WORLD_W} height={WORLD_H} className="absolute left-0 top-0 overflow-visible" style={{ pointerEvents: "none" }}>
          {nodes.slice(0, -1).map((n, i) => {
            const a = anchorR(n);
            const b = anchorL(nodes[i + 1]);
            const live = n.live;
            return (
              <g key={n.key}>
                <path d={path(a, b)} fill="none" stroke="#cdd5e1" strokeWidth={4} strokeLinecap="round" />
                <path d={path(a, b)} fill="none" stroke={live ? "#6366f1" : "#aab2c0"} strokeWidth={2.4} strokeLinecap="round" className="nt-edge-flow" style={{ opacity: live ? 0.85 : 0.45 }} />
              </g>
            );
          })}
          {/* vers "ajouter une brique" (pointillé, inactif) */}
          <path d={path(anchorR(nodes[nodes.length - 1]), anchorL(addNode))} fill="none" stroke="#c0c8d4" strokeWidth={2.2} strokeDasharray="2 7" strokeLinecap="round" />
        </svg>

        {/* Nœuds */}
        {nodes.map((n, i) => (
          <button
            key={n.key}
            data-ui
            onClick={() => setSel(n.key)}
            onMouseEnter={() => (i < nodes.length - 1 ? setEdge(i) : scheduleClear())}
            onMouseLeave={scheduleClear}
            className="nt-node-card absolute rounded-[18px] border text-left transition-all"
            style={{
              left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H,
              borderColor: sel === n.key ? n.tint : "var(--line-2)",
              boxShadow: sel === n.key ? `0 0 0 2px ${n.tint}, var(--sh-3)` : undefined,
            }}
          >
            <div className="flex items-center gap-2.5 px-4 pt-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: n.tint }}>
                <n.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-[13.5px] font-semibold leading-tight text-slate-800">{n.title}</span>
            </div>
            <div className="px-4 pb-1 pt-2.5">
              {n.live ? (
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-emerald-600">
                  <span className="nt-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> EN ATTENTE
                </span>
              )}
            </div>
            <div className="flex gap-5 px-4 pb-4 pt-1">
              {n.stats.map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-bold leading-none text-slate-900">{s.value}</p>
                  <p className="mt-1 text-[0.7rem] text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </button>
        ))}

        {/* + d'insertion entre deux briques (au hover) */}
        {nodes.slice(0, -1).map((n, i) => {
          const a = anchorR(n);
          const b = anchorL(nodes[i + 1]);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const on = hoverEdge === i;
          return (
            <div
              key={`ins-${i}`}
              data-ui
              onMouseEnter={() => setEdge(i)}
              onMouseLeave={scheduleClear}
              className="absolute"
              style={{ left: mx - 28, top: my - 28, width: 56, height: 56 }}
            >
              <button
                onClick={() => setSel(`insert-${i}`)}
                title={`Insérer une brique entre « ${n.title} » et « ${nodes[i + 1].title} »`}
                className={`absolute left-[10px] top-[10px] grid h-9 w-9 place-items-center rounded-full border-2 border-dashed bg-white text-indigo-500 shadow-sm transition-all duration-150 ${
                  on ? "scale-100 border-indigo-300 opacity-100 hover:bg-indigo-50" : "pointer-events-none scale-50 border-slate-300 opacity-0"
                }`}
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          );
        })}

        {/* Ajouter une brique */}
        <button
          data-ui
          onClick={() => setSel("add")}
          className="absolute grid place-items-center rounded-[18px] border-2 border-dashed border-slate-300 bg-white/40 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500"
          style={{ left: addNode.x, top: addNode.y, width: NODE_W, height: NODE_H }}
        >
          <Plus className="h-7 w-7" strokeWidth={2} />
          <span className="mt-1 text-sm font-medium">Ajouter une brique</span>
          <span className="mt-0.5 px-6 text-center text-[0.68rem] text-slate-400">enrichissement, scoring avancé, canal…</span>
        </button>
      </div>

      {/* Toolbar — titre + légende */}
      <div data-ui className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Waypoints className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">Workflow</p>
            <p className="text-xs text-slate-400">Automatisations & connecteurs · configuration</p>
          </div>
          <div className="ml-3 flex items-center gap-3 border-l border-[var(--line)] pl-3 text-[0.7rem] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="nt-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> live</span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#6366f1" strokeWidth="2.4" strokeDasharray="9 17" className="nt-edge-flow" /></svg>
              flux actif
            </span>
          </div>
        </div>

        {/* Contrôles zoom + ajouter */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[var(--line)] bg-white/80 p-1 shadow-sm backdrop-blur">
            <button data-ui onClick={() => zoom(-0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Minus className="h-4 w-4" /></button>
            <span className="w-11 text-center text-xs font-medium text-slate-500">{Math.round(view.k * 100)}%</span>
            <button data-ui onClick={() => zoom(0.15)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Plus className="h-4 w-4" /></button>
            <button data-ui onClick={fit} title="Ajuster" className="nt-press grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Maximize2 className="h-4 w-4" /></button>
          </div>
          <button data-ui onClick={() => setSel("add")} className="nt-press flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Brique
          </button>
        </div>
      </div>

      {/* Panneau de détail (overlay, ne réduit pas le canvas) */}
      {sel && (
        <aside data-ui className="absolute right-4 top-20 bottom-4 w-[330px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/95 p-5 shadow-[var(--sh-3)] backdrop-blur nt-in nt-scroll">
          <button data-ui onClick={() => setSel(null)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          {insertIdx != null && nodes[insertIdx + 1] ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Insérer une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Ajouter une étape <strong>entre « {nodes[insertIdx].title} » et « {nodes[insertIdx + 1].title} »</strong> : enrichissement de données, validation/QA, scoring complémentaire, ou une règle conditionnelle.
              </p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">L'édition du workflow depuis la map arrive dans une prochaine itération.</p>
            </div>
          ) : sel === "add" ? (
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Ajouter une brique</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Étends le pipeline avec de nouvelles étapes : enrichissement de données (API tierces), scoring avancé, nouveau canal de captation, ou une règle d'attribution sur-mesure.
              </p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">L'édition du workflow depuis la map arrive dans une prochaine itération.</p>
            </div>
          ) : selNode ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: selNode.tint }}>
                  <selNode.icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{selNode.title}</h3>
                  <span className={`text-xs font-medium ${selNode.live ? "text-emerald-600" : "text-slate-400"}`}>{selNode.live ? "● en activité" : "○ en attente"}</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{selNode.desc}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {selNode.stats.map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
              {selNode.extra?.map((e) => (
                <div key={e.label} className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-[var(--line-2)] px-3 py-2.5">
                  <span className="text-xs text-slate-400">{e.label}</span>
                  <span className="font-mono text-xs font-medium text-slate-700">{e.value}</span>
                </div>
              ))}
              <div className="mt-auto space-y-2 pt-5">
                <Link href={selNode.href} className="nt-press flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                  {selNode.hrefLabel} <ArrowUpRight className="h-4 w-4" />
                </Link>
                <button disabled title="Bientôt" className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-400">
                  <Settings2 className="h-4 w-4" /> Régler cette étape
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      )}

      {/* Aide pan/zoom */}
      <p data-ui className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-3 py-1 text-[0.7rem] text-slate-400 backdrop-blur">
        Deux doigts (ou glisser) pour déplacer · pincez ou ⌘+molette pour zoomer
      </p>
    </div>
  );
}
