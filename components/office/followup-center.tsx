"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, TriangleAlert, Clock, CircleCheck, Check, X } from "lucide-react";
import type { FollowupsData, FollowupItem } from "@/lib/dashboard/office-data";
import { completerRelance, annulerRelance } from "@/app/commercial/actions";
import { Kpi } from "./ui";

type Filtre = "all" | "overdue" | "pending" | "completed";

export function FollowupCenter({ data }: { data: FollowupsData }) {
  const [filtre, setFiltre] = useState<Filtre>("all");

  const items = data.items.filter((i) =>
    filtre === "all" ? true : filtre === "overdue" ? i.overdue : filtre === "pending" ? i.statut === "planifiee" : i.statut === "envoyee"
  );

  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi icon={TriangleAlert} value={data.overdue} label="En retard" tone={data.overdue > 0 ? "rose" : "slate"} />
        <Kpi icon={Clock} value={data.pending} label="En attente" tone="amber" />
        <Kpi icon={CircleCheck} value={data.completed} label="Effectuées" tone="emerald" />
      </section>

      <div className="mb-5 flex gap-2">
        {(["all", "overdue", "pending", "completed"] as Filtre[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`nt-press rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filtre === f ? "border-transparent bg-indigo-600 text-white" : "border-[var(--line)] bg-white text-slate-500 hover:text-slate-800"
            }`}
          >
            {{ all: "Toutes", overdue: "En retard", pending: "En attente", completed: "Effectuées" }[f]}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="nt-card py-16 text-center text-sm text-slate-400">
          Aucune relance {filtre !== "all" ? "dans ce filtre" : "— elles se créent à l'envoi d'un devis"}.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => <Row key={i.id} i={i} />)}
        </div>
      )}
    </>
  );
}

function Row({ i }: { i: FollowupItem }) {
  const date = new Date(i.planifiee_pour).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const done = i.statut === "envoyee";
  const cancelled = i.statut === "annulee";
  const statusPill = done
    ? { t: "Effectuée", c: "bg-emerald-50 text-emerald-700" }
    : cancelled
    ? { t: "Annulée", c: "bg-slate-100 text-slate-400" }
    : i.overdue
    ? { t: "En retard", c: "bg-rose-50 text-rose-600" }
    : { t: "En attente", c: "bg-amber-50 text-amber-600" };

  return (
    <div className="nt-card flex items-center gap-4 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-500">
        <Phone className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-800">{i.objet}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill.c}`}>{statusPill.t}</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.7rem] font-medium uppercase text-slate-400">{i.type}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {date} · <Link href={`/leads/${i.demande_id}`} className="text-indigo-600 hover:underline">{i.client}</Link> · {i.trajet}
        </p>
      </div>
      {!done && !cancelled && (
        <div className="flex shrink-0 gap-2">
          <form action={completerRelance}>
            <input type="hidden" name="id" value={i.id} />
            <button className="nt-press flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              <Check className="h-3.5 w-3.5" /> Compléter
            </button>
          </form>
          <form action={annulerRelance}>
            <input type="hidden" name="id" value={i.id} />
            <button className="nt-press flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
              <X className="h-3.5 w-3.5" /> Annuler
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
