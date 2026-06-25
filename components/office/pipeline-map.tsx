"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Gauge,
  Users,
  FileText,
  Bell,
  BarChart3,
  ChevronRight,
  ArrowUpRight,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { MapData } from "@/lib/dashboard/office-data";
import { eur } from "@/lib/ui/format";

interface NodeDef {
  key: string;
  title: string;
  icon: LucideIcon;
  tint: string; // couleur d'accent (hex)
  href: string;
  hrefLabel: string;
  stats: { label: string; value: string | number }[];
  desc: string;
  extra?: { label: string; value: string }[];
}

export function PipelineMap({ data }: { data: MapData }) {
  const nodes: NodeDef[] = [
    {
      key: "chat",
      title: "Conversation IA",
      icon: MessageSquare,
      tint: "#4f46e5",
      href: "/",
      hrefLabel: "Ouvrir le chat",
      stats: [
        { label: "Leads captés", value: data.captation.total },
        { label: "via chat IA", value: data.captation.via_chat },
      ],
      desc: "Point d'entrée : l'assistant qualifie le besoin, capte le contact et crée le lead. Aucun prix n'est communiqué au prospect.",
      extra: [{ label: "Modèle de l'agent", value: data.model_agent }],
    },
    {
      key: "qualif",
      title: "Qualification & scoring",
      icon: Gauge,
      tint: "#0ea5e9",
      href: "/leads",
      hrefLabel: "Voir les leads",
      stats: [
        { label: "Leads avancés", value: data.qualification.progresses },
        { label: "Score moyen", value: data.qualification.avg_score },
      ],
      desc: "Matrice de complexité + scoring multi-facteurs (budget, urgence, volume, complétude). Détermine la priorité et le routage.",
    },
    {
      key: "attrib",
      title: "Attribution / CRM",
      icon: Users,
      tint: "#10b981",
      href: "/leads",
      hrefLabel: "Ouvrir le CRM",
      stats: [
        { label: "Leads attribués", value: data.attribution.attribues },
        { label: "Commerciaux", value: data.attribution.commerciaux },
      ],
      desc: "Le lead est attribué automatiquement (équité des commissions, puis spécialité), avec un résumé enrichi pour le commercial.",
    },
    {
      key: "devis",
      title: "Devis",
      icon: FileText,
      tint: "#f59e0b",
      href: "/simulateur",
      hrefLabel: "Ouvrir le simulateur",
      stats: [
        { label: "Devis générés", value: data.devis.count },
        { label: "Pipeline", value: eur(data.devis.pipeline) },
      ],
      desc: "Le commercial déclenche calculer_devis() (moteur déterministe). Estimation interne pour le scoring, devis ferme communiqué par le commercial.",
    },
    {
      key: "relances",
      title: "Relances",
      icon: Bell,
      tint: "#8b5cf6",
      href: "/follow-ups",
      hrefLabel: "Centre de relances",
      stats: [
        { label: "En attente", value: data.relances.pending },
        { label: "En retard", value: data.relances.overdue },
      ],
      desc: "Relances email automatiques (J+1 / J+3 / J+7) via Vercel Cron + Resend, jusqu'à conversion ou clôture.",
    },
    {
      key: "pilotage",
      title: "Pilotage",
      icon: BarChart3,
      tint: "#64748b",
      href: "/dashboard",
      hrefLabel: "Ouvrir le dashboard",
      stats: [
        { label: "Gagnés", value: data.pilotage.won },
        { label: "Conversion", value: data.pilotage.conversion == null ? "—" : `${data.pilotage.conversion} %` },
      ],
      desc: "Funnel, délais de prise en charge (<48 h), taux de conversion et équité des commissions — alimentés en continu.",
    },
  ];

  const [sel, setSel] = useState(0);
  const node = nodes[sel];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
      {/* Canvas */}
      <div className="nt-dots nt-scroll overflow-x-auto rounded-2xl border border-[var(--line)] p-6">
        <div className="flex min-w-max items-stretch gap-1">
          {nodes.map((n, i) => (
            <div key={n.key} className="flex items-center">
              <button
                onClick={() => setSel(i)}
                className={`nt-press w-[208px] rounded-2xl border bg-white p-4 text-left transition-all ${
                  sel === i ? "border-transparent shadow-[0_0_0_2px_var(--accent),var(--sh-2)]" : "border-[var(--line)] shadow-[var(--sh-1)] hover:-translate-y-0.5 hover:shadow-[var(--sh-2)]"
                }`}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: n.tint }}>
                    <n.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{n.title}</span>
                </div>
                <div className="flex gap-4">
                  {n.stats.map((s) => (
                    <div key={s.label}>
                      <p className="text-lg font-bold leading-none text-slate-900">{s.value}</p>
                      <p className="mt-1 text-[0.7rem] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </button>
              {i < nodes.length - 1 && (
                <div className="flex w-9 items-center justify-center">
                  <span className="h-px w-4 bg-slate-300" />
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">
          Flux temps réel du pipeline commercial — cliquez sur une étape pour la piloter.
        </p>
      </div>

      {/* Panneau de détail */}
      <aside className="nt-card flex flex-col p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: node.tint }}>
            <node.icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{node.title}</h3>
            <p className="text-xs text-slate-400">Étape {sel + 1} / {nodes.length}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">{node.desc}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {node.stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {node.extra?.map((e) => (
          <div key={e.label} className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-[var(--line-2)] px-3 py-2.5">
            <span className="text-xs text-slate-400">{e.label}</span>
            <span className="font-mono text-xs font-medium text-slate-700">{e.value}</span>
          </div>
        ))}

        <div className="mt-auto space-y-2 pt-5">
          <Link
            href={node.href}
            className="nt-press flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {node.hrefLabel} <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button
            disabled
            title="Bientôt : régler les variables de cette étape"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            <Settings2 className="h-4 w-4" /> Régler cette étape
          </button>
        </div>
      </aside>
    </div>
  );
}
