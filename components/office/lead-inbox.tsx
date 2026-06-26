"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, List, LayoutGrid, MapPin, Users, Calendar, Sparkles, PhoneCall, Loader2 } from "lucide-react";
import type { LeadListItem } from "@/lib/dashboard/office-data";
import { STATUTS, STATUT_LABEL, STATUT_META, type Statut } from "@/lib/ui/statuts";
import { leadAction, isCommercialAction } from "@/lib/pipeline/lead-action";
import { eur } from "@/lib/ui/format";
import { StatusBadge, UrgenceBadge, ScorePill, OwnerBadge } from "./ui";

/** Action canonique d'un lead de l'inbox (statut + devis prêt). */
const actionOf = (l: LeadListItem) => leadAction(l.statut, { devisPret: l.devis_pret });

type Tri = "score" | "valeur" | "date";

const PREFS_KEY = "neotravel:inbox-prefs";

export function LeadInbox({ leads }: { leads: LeadListItem[] }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Statut | "all">("all");
  const [vue, setVue] = useState<"list" | "kanban">("list");
  const [tri, setTri] = useState<Tri>("score");

  // Restaure la vue/filtre/tri d'où on venait (persistés entre navigations).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { vue?: "list" | "kanban"; filtre?: Statut | "all"; tri?: Tri };
      if (p.vue === "list" || p.vue === "kanban") setVue(p.vue);
      if (p.filtre) setFiltre(p.filtre);
      if (p.tri) setTri(p.tri);
    } catch {
      /* localStorage indisponible : on garde les valeurs par défaut */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ vue, filtre, tri }));
    } catch {
      /* ignore */
    }
  }, [vue, filtre, tri]);

  // Arrivée depuis un KPI du dashboard : force la vue Kanban + surligne une colonne.
  const sp = useSearchParams();
  const [highlight, setHighlight] = useState<Statut | null>(null);
  useEffect(() => {
    const v = sp.get("view");
    if (v === "kanban" || v === "list") setVue(v);
    const h = sp.get("highlight");
    if (h && (STATUTS as readonly string[]).includes(h)) {
      setVue("kanban");
      setHighlight(h as Statut);
    }
  }, [sp]);

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
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--cream)] shadow-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">AI Lead Inbox</h1>
            <p className="text-sm text-[var(--muted)]">
              {leads.length} leads · {nouveaux} nouveau{nouveaux > 1 ? "x" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un lead…"
            className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
          />
        </div>
        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as Tri)}
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--muted)] outline-none"
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
                vue === v ? "bg-[var(--ink)] text-[var(--cream)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
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
        <div className="nt-card py-16 text-center text-sm text-[var(--faint)]">Aucun lead ne correspond.</div>
      ) : vue === "list" ? (
        <div className="space-y-3">
          {filtered.map((l) => (
            <LeadRow key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <Kanban leads={filtered} highlight={highlight} />
      )}
    </>
  );
}

function Chip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`nt-press flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-transparent bg-[var(--ink)] text-[var(--cream)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
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
            <span className="font-semibold text-[var(--ink)]">{l.client}</span>
            <StatusBadge statut={l.statut} />
            <OwnerBadge action={actionOf(l)} />
            <UrgenceBadge niveau={l.urgence} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {l.trajet}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {l.nb_voyageurs} pax</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {l.date_depart}</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--muted)]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--olive)]" />
            <span className="line-clamp-2">{l.resume}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ScorePill score={l.score} />
          <span className="font-semibold text-[var(--ink)]">{l.valeur != null ? eur(l.valeur) : "—"}</span>
          {l.commercial && <span className="text-xs text-[var(--faint)]">{l.commercial}</span>}
        </div>
      </div>
    </Link>
  );
}

function Kanban({ leads, highlight }: { leads: LeadListItem[]; highlight?: Statut | null }) {
  return (
    <div className="nt-scroll flex gap-4 overflow-x-auto pb-2">
      {STATUTS.map((s) => {
        const col = leads.filter((l) => l.statut === s);
        const isHi = s === highlight;
        const actions = col.filter((l) => isCommercialAction(actionOf(l))).length;
        return (
          <div
            key={s}
            ref={isHi ? (el) => el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }) : undefined}
            className={`w-[280px] shrink-0 rounded-2xl ${isHi ? "nt-pop p-2.5" : actions > 0 ? "p-2.5 ring-1 ring-[var(--lime-deep)]" : ""}`}
            style={isHi ? { background: "color-mix(in srgb, var(--lime-soft) 55%, transparent)" } : undefined}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUT_META[s].hex }} />
              <span className="text-sm font-semibold text-[var(--ink)]">{STATUT_LABEL[s]}</span>
              {actions > 0 ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--lime-soft)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--forest)] ring-1 ring-[var(--lime-deep)]">
                  {actions} à faire
                </span>
              ) : (
                <span className="ml-auto text-xs text-[var(--faint)]">{col.length}</span>
              )}
            </div>
            <div className="space-y-3">
              {col.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--line-2)] py-8 text-center text-xs text-[var(--faint)]">
                  Aucun lead
                </div>
              )}
              {col.map((l) => {
                const act = actionOf(l);
                const commercial = isCommercialAction(act);
                return (
                  <div key={l.id} className="space-y-1.5">
                    <Link
                      href={`/leads/${l.id}`}
                      className={`nt-card nt-lift block p-3.5 ${commercial ? "border-l-[3px] border-l-[var(--lime-deep)]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--ink)]">{l.client}</span>
                        <ScorePill score={l.score} />
                      </div>
                      <div className="mt-2"><OwnerBadge action={act} /></div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--faint)]">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.trajet}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {l.nb_voyageurs}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{l.resume}</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <UrgenceBadge niveau={l.urgence} />
                        <span className="text-sm font-semibold text-[var(--ink)]">{l.valeur != null ? eur(l.valeur) : "—"}</span>
                      </div>
                    </Link>
                    {l.statut === "qualified" && <CallSim id={l.id} />}
                  </div>
                );
              })}
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
    return <div className="rounded-lg border border-[var(--terracotta-soft)] bg-[var(--terracotta-soft)] px-2.5 py-1.5 text-[0.7rem] text-[var(--terracotta-ink)]">Échec de la simulation d'appel.</div>;
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#f6ead0] bg-[#f6ead0] px-2.5 py-1.5 text-[0.7rem] font-medium text-[#8a5a1f]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <PhoneCall className="h-3 w-3" />
      {phase === "call" ? "Appel commercial en cours… (démo)" : "Retranscription en cours… (démo)"}
    </div>
  );
}
