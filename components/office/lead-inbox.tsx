"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, List, LayoutGrid, MapPin, Users, Calendar, Sparkles, PhoneCall, Loader2 } from "lucide-react";
import type { LeadListItem } from "@/lib/dashboard/office-data";
import { STATUTS, STATUT_LABEL, STATUT_META, type Statut } from "@/lib/ui/statuts";
import { eur } from "@/lib/ui/format";
import { StatusBadge, UrgenceBadge, ScorePill } from "./ui";

type Tri = "score" | "valeur" | "date";

export function LeadInbox({ leads }: { leads: LeadListItem[] }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Statut | "all">("all");
  const [vue, setVue] = useState<"list" | "kanban">("list");
  const [tri, setTri] = useState<Tri>("score");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUTS) c[s] = leads.filter((l) => l.statut === s).length;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = leads.filter((l) => (filtre === "all" ? true : l.statut === filtre));
    if (term) r = r.filter((l) => `${l.client} ${l.trajet} ${l.resume}`.toLowerCase().includes(term));
    r = [...r].sort((a, b) =>
      tri === "score" ? b.score - a.score : tri === "valeur" ? (b.valeur ?? 0) - (a.valeur ?? 0) : +new Date(b.created_at) - +new Date(a.created_at)
    );
    return r;
  }, [leads, q, filtre, tri]);

  const nouveaux = counts["new"] ?? 0;

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Lead Inbox</h1>
            <p className="text-sm text-slate-500">
              {leads.length} leads · {nouveaux} nouveau{nouveaux > 1 ? "x" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un lead…"
            className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-300"
          />
        </div>
        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as Tri)}
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-slate-600 outline-none"
        >
          <option value="score">Trier par score</option>
          <option value="valeur">Trier par valeur</option>
          <option value="date">Trier par date</option>
        </select>
        <div className="flex rounded-xl border border-[var(--line)] bg-white p-1">
          {([["list", List], ["kanban", LayoutGrid]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`nt-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                vue === v ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {v === "list" ? "Liste" : "Kanban"}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres statut */}
      <div className="nt-scroll mb-5 flex gap-2 overflow-x-auto pb-1">
        <Chip active={filtre === "all"} onClick={() => setFiltre("all")} label={`Tous (${counts.all})`} />
        {STATUTS.map((s) => (
          <Chip key={s} active={filtre === s} onClick={() => setFiltre(s)} label={`${STATUT_LABEL[s]} (${counts[s] ?? 0})`} dot={STATUT_META[s].hex} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="nt-card py-16 text-center text-sm text-slate-400">Aucun lead ne correspond.</div>
      ) : vue === "list" ? (
        <div className="space-y-3">
          {filtered.map((l) => (
            <LeadRow key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <Kanban leads={filtered} />
      )}
    </>
  );
}

function Chip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`nt-press flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-transparent bg-indigo-600 text-white" : "border-[var(--line)] bg-white text-slate-500 hover:text-slate-800"
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#fff" : dot }} />}
      {label}
    </button>
  );
}

function LeadRow({ l }: { l: LeadListItem }) {
  return (
    <Link href={`/leads/${l.id}`} className="nt-card nt-lift block p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{l.client}</span>
            <StatusBadge statut={l.statut} />
            <UrgenceBadge niveau={l.urgence} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {l.trajet}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {l.nb_voyageurs} pax</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {l.date_depart}</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="line-clamp-2">{l.resume}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ScorePill score={l.score} />
          <span className="font-semibold text-slate-900">{l.valeur != null ? eur(l.valeur) : "—"}</span>
          {l.commercial && <span className="text-xs text-slate-400">{l.commercial}</span>}
        </div>
      </div>
    </Link>
  );
}

function Kanban({ leads }: { leads: LeadListItem[] }) {
  return (
    <div className="nt-scroll flex gap-4 overflow-x-auto pb-2">
      {STATUTS.map((s) => {
        const col = leads.filter((l) => l.statut === s);
        return (
          <div key={s} className="w-[280px] shrink-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUT_META[s].hex }} />
              <span className="text-sm font-semibold text-slate-700">{STATUT_LABEL[s]}</span>
              <span className="ml-auto text-xs text-slate-400">{col.length}</span>
            </div>
            <div className="space-y-3">
              {col.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--line-2)] py-8 text-center text-xs text-slate-300">
                  Aucun lead
                </div>
              )}
              {col.map((l) => (
                <div key={l.id} className="space-y-1.5">
                  <Link href={`/leads/${l.id}`} className="nt-card nt-lift block p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{l.client}</span>
                      <ScorePill score={l.score} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.trajet}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {l.nb_voyageurs}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">{l.resume}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <UrgenceBadge niveau={l.urgence} />
                      <span className="text-sm font-semibold text-slate-800">{l.valeur != null ? eur(l.valeur) : "—"}</span>
                    </div>
                  </Link>
                  {l.statut === "qualified" && <CallSim id={l.id} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simulation (démo) d'appel commercial sur un lead « Qualifié » :
// après ~10 s → génère la retranscription (clé Gateway, côté serveur) et passe en « Contacté ».
const simTriggered = new Set<string>();
function CallSim({ id }: { id: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"call" | "transcribe" | "error">("call");
  useEffect(() => {
    let cancelled = false;
    const t1 = setTimeout(() => { if (!cancelled) setPhase("transcribe"); }, 6000);
    const t2 = setTimeout(async () => {
      if (simTriggered.has(id)) return;
      simTriggered.add(id);
      try {
        const r = await fetch("/api/appel/simuler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demande_id: id }) });
        if (cancelled) return;
        if (r.ok) router.refresh();
        else setPhase("error");
      } catch {
        if (!cancelled) setPhase("error");
      }
    }, 10000);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [id, router]);

  if (phase === "error")
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[0.7rem] text-rose-600">Échec de la simulation d'appel.</div>;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.7rem] font-medium text-amber-700">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <PhoneCall className="h-3 w-3" />
      {phase === "call" ? "Appel commercial en cours… (démo)" : "Retranscription en cours… (démo)"}
    </div>
  );
}
