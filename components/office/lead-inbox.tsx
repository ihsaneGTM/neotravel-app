"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, List, LayoutGrid, MapPin, Users, Calendar, Sparkles, PhoneCall, Loader2, Clock } from "lucide-react";
import type { LeadListItem } from "@/lib/dashboard/office-data";
import { STATUTS, STATUT_LABEL, STATUT_META, type Statut } from "@/lib/ui/statuts";
import { leadAction, isCommercialAction, boardColumnOf, BOARD_COLUMNS, BOARD_TO_STATUT, type BoardKey } from "@/lib/pipeline/lead-action";
import { deplacerLead } from "@/app/commercial/actions";
import { slaInfo, WAIT_TIER_META, type SlaInfo } from "@/lib/pipeline/sla";
import { eur, dateFR } from "@/lib/ui/format";
import { StatusBadge, UrgenceBadge, ScorePill, OwnerBadge } from "./ui";

/** Contexte d'action d'un lead (devis prêt + avancement des relances). */
const ctxOf = (l: LeadListItem) => ({ devisPret: l.devis_pret, relancesTotal: l.relances_total, relancesDues: l.relances_dues });
/** Action canonique d'un lead de l'inbox. */
const actionOf = (l: LeadListItem) => leadAction(l.statut, ctxOf(l));
/** Colonne board (timeline) d'un lead. */
const boardOf = (l: LeadListItem) => boardColumnOf(l.statut, ctxOf(l));
/** État SLA (délai d'attente) d'un lead. */
const slaOf = (l: LeadListItem) => slaInfo(l.created_at, l.entered_at, actionOf(l).owner);

type Tri = "priorite" | "score" | "valeur" | "date";

const PREFS_KEY = "neotravel:inbox-prefs";

export function LeadInbox({ leads }: { leads: LeadListItem[] }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Statut | "all">("all");
  const [vue, setVue] = useState<"list" | "kanban">("kanban");
  const [tri, setTri] = useState<Tri>("priorite");

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
      tri === "priorite"
        ? // Urgents (départ imminent) en tête, puis demandes de rappel humain, puis score.
          Number(b.urgent) - Number(a.urgent) || Number(b.contact_humain) - Number(a.contact_humain) || b.score - a.score
        : tri === "score"
          ? b.score - a.score
          : tri === "valeur"
            ? (b.valeur ?? 0) - (a.valeur ?? 0)
            : +new Date(b.created_at) - +new Date(a.created_at)
    );
    return r;
  }, [leads, q, filtre, tri]);

  const nouveaux = counts["new"] ?? 0;
  // Compteur SLA : leads où l'équipe doit agir et qui patientent au-delà des 24 h cibles.
  const enRetard = useMemo(() => leads.filter((l) => { const t = slaOf(l).tier; return t === "late" || t === "breach"; }).length, [leads]);

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--cream)] shadow-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Demandes</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--muted)]">
              <span>{leads.length} leads · {nouveaux} nouveau{nouveaux > 1 ? "x" : ""}</span>
              {enRetard > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--terracotta-ink)]">
                  <Clock className="h-3 w-3" /> {enRetard} en attente &gt; 24 h
                </span>
              )}
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
          <option value="priorite">Trier par priorité</option>
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

      {/* Filtres statut — masqués en Kanban (les colonnes organisent déjà par statut) */}
      {vue === "list" && (
        <div className="nt-scroll mb-5 flex gap-2 overflow-x-auto pb-1">
          <Chip active={filtre === "all"} onClick={() => setFiltre("all")} label={`Tous (${counts.all})`} />
          {STATUTS.map((s) => (
            <Chip key={s} active={filtre === s} onClick={() => setFiltre(s)} label={`${STATUT_LABEL[s]} (${counts[s] ?? 0})`} dot={STATUT_META[s].hex} />
          ))}
        </div>
      )}

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

/** Horloge d'attente : ancienneté de la demande, colorée selon le palier SLA. */
function WaitChip({ sla, dense }: { sla: SlaInfo; dense?: boolean }) {
  if (sla.tier === "none") return null;
  const meta = WAIT_TIER_META[sla.tier];
  const colored = sla.tier === "late" || sla.tier === "breach";
  const title = `${sla.status} · demande reçue il y a ${sla.ageLabel}${sla.columnLabel ? ` · dans cette étape depuis ${sla.columnLabel}` : ""}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${dense ? "text-[0.66rem]" : "text-xs"} ${
        colored ? `px-1.5 py-0.5 ${meta.chip}` : "text-[var(--faint)]"
      } ${meta.pulse ? "animate-pulse" : ""}`}
    >
      <Clock className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} /> {sla.ageLabel}
    </span>
  );
}

/** Pastille « Urgent » — départ imminent, priorité absolue. */
function UrgentBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta)] px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-white">
      <Clock className="h-3 w-3" /> Urgent
    </span>
  );
}

/** Pastille « Rappel demandé » — le prospect veut parler à un conseiller. */
function RappelBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--forest)] px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-[var(--cream)]">
      <PhoneCall className="h-3 w-3" /> Rappel demandé
    </span>
  );
}

function LeadRow({ l }: { l: LeadListItem }) {
  return (
    <Link href={`/leads/${l.id}`} className={`nt-card nt-lift block p-4 ${l.urgent ? "ring-2 ring-[var(--terracotta)]" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">{l.client}</span>
            {l.urgent && <UrgentBadge />}
            {l.contact_humain && <RappelBadge />}
            <StatusBadge statut={l.statut} />
            <OwnerBadge action={actionOf(l)} />
            <WaitChip sla={slaOf(l)} />
            <UrgenceBadge niveau={l.urgence} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {l.trajet}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {l.nb_voyageurs} pax</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {dateFR(l.date_depart)}</span>
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

// La colonne mise en avant à l'arrivée depuis un KPI (statut DB → colonne board).
const HIGHLIGHT_BOARD: Partial<Record<Statut, BoardKey>> = { quote_sent: "devis_envoye" };

function Kanban({ leads, highlight }: { leads: LeadListItem[]; highlight?: Statut | null }) {
  const hiCol = highlight ? (HIGHLIGHT_BOARD[highlight] ?? (highlight as BoardKey)) : null;
  const router = useRouter();
  const [, startMove] = useTransition();
  // Déplacements optimistes (id → colonne cible), nettoyés quand les données serveur changent.
  const [moved, setMoved] = useState<Record<string, BoardKey>>({});
  const [dragOver, setDragOver] = useState<BoardKey | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => setMoved({}), [leads]);

  const colOf = (l: LeadListItem) => moved[l.id] ?? boardOf(l);

  const onDrop = (target: BoardKey, id: string) => {
    setDragOver(null);
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    // No-op si la cible mappe vers le même statut DB (ex. sous-colonnes de quote_sent).
    if (BOARD_TO_STATUT[colOf(lead)] === BOARD_TO_STATUT[target]) return;
    setMoved((m) => ({ ...m, [id]: target }));
    startMove(async () => {
      try {
        await deplacerLead({ id, board: target });
      } finally {
        router.refresh();
      }
    });
  };

  return (
    <div className="nt-scroll flex gap-4 overflow-x-auto pb-3 pt-1 px-0.5">
      {BOARD_COLUMNS.map((bc) => {
        const col = leads.filter((l) => colOf(l) === bc.key);
        const isHi = bc.key === hiCol;
        const commercialCol = bc.owner === "commercial";
        const actions = commercialCol ? col.length : 0;
        const enRetard = col.filter((l) => { const t = slaOf(l).tier; return t === "late" || t === "breach"; }).length;
        // Colonnes sans action = grisées (juste attendre / auto / terminé) ; colonnes commerciales = pleine couleur.
        const greyed = !commercialCol;
        return (
          <div
            key={bc.key}
            ref={isHi ? (el) => el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }) : undefined}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(bc.key); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver((d) => (d === bc.key ? null : d)); }}
            onDrop={(e) => { e.preventDefault(); onDrop(bc.key, e.dataTransfer.getData("text/plain")); }}
            className={`w-[280px] shrink-0 rounded-2xl p-2.5 transition-colors ${
              dragOver === bc.key
                ? "ring-2 ring-[var(--ink)] bg-[var(--lime-soft)]/40"
                : isHi
                  ? "nt-pop"
                  : commercialCol && actions > 0
                    ? "ring-1 ring-[var(--lime-deep)]"
                    : ""
            } ${greyed ? "bg-[var(--bg-soft)]" : ""}`}
            style={isHi && dragOver !== bc.key ? { background: "color-mix(in srgb, var(--lime-soft) 55%, transparent)" } : undefined}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: greyed ? "var(--line-2)" : bc.hex }} />
              <span className={`text-sm font-semibold ${greyed ? "text-[var(--faint)]" : "text-[var(--ink)]"}`}>{bc.label}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {enRetard > 0 && (
                  <span
                    title={`${enRetard} demande(s) en attente depuis plus de 24 h`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--terracotta-ink)]"
                  >
                    <Clock className="h-3 w-3" /> {enRetard}
                  </span>
                )}
                {commercialCol && actions > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lime-soft)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--forest)] ring-1 ring-[var(--lime-deep)]">
                    {actions} à faire
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-[var(--faint)]">
                    {greyed && bc.owner !== "done" && <span className="text-[0.62rem] uppercase tracking-wide">{bc.owner === "ia" ? "auto" : "attente"}</span>}
                    {col.length}
                  </span>
                )}
              </span>
            </div>
            <div className={`space-y-3 ${greyed ? "opacity-80" : ""}`}>
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
                      draggable
                      onDragStart={(e) => { setDragId(l.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      className={`nt-card nt-lift block cursor-grab p-3.5 active:cursor-grabbing ${
                        dragId === l.id ? "opacity-50" : ""
                      } ${
                        l.urgent
                          ? "bg-[var(--terracotta-soft)] ring-2 ring-[var(--terracotta)]"
                          : commercial
                            ? "border-l-[3px] border-l-[var(--lime-deep)]"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--ink)]">{l.client}</span>
                        <ScorePill score={l.score} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">{l.urgent && <UrgentBadge />}{l.contact_humain && <RappelBadge />}<OwnerBadge action={act} /><WaitChip sla={slaOf(l)} dense /></div>
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
