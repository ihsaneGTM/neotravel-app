"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, UserRound, ShieldQuestion, PhoneCall, ArrowUpRight, Headset, Sparkles, Send } from "lucide-react";
import type { ConversationItem } from "@/lib/dashboard/office-data";
import { depuis } from "@/lib/ui/format";
import { Transcript } from "@/components/office/transcript";
import { reprendreMain, rendreMainIA, envoyerMessageCommercial } from "@/app/(office)/conversations/actions";

type Filtre = "all" | "a_rappeler" | "anonymes" | "terminee";
const STATUT_REPRISE = "reprise_humaine";
type Msg = { role: string; text: string; author?: string; event?: string };

function statutMeta(s: string) {
  if (s === STATUT_REPRISE) return { t: "Vous pilotez", c: "bg-[var(--forest)] text-[var(--cream)]", dot: "bg-[var(--lime)]" };
  if (s === "a_rappeler") return { t: "À rappeler", c: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]", dot: "bg-[var(--terracotta)]" };
  if (s === "terminee") return { t: "Terminée", c: "bg-[var(--lime-soft)] text-[var(--forest)]", dot: "bg-[var(--forest)]" };
  return { t: "En cours", c: "bg-[var(--grey)] text-[var(--muted)]", dot: "bg-[var(--faint)]" };
}

export function ConversationsViewer({ conversations }: { conversations: ConversationItem[] }) {
  const [filtre, setFiltre] = useState<Filtre>("all");
  const [sel, setSel] = useState<string | null>(conversations[0]?.id ?? null);
  // État live (mode + transcript) de la conversation sélectionnée, rafraîchi en polling.
  const [live, setLive] = useState<{ id: string; mode: "ia" | "humain"; transcript: Msg[]; commercial: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () =>
      conversations.filter((c) =>
        filtre === "all" ? true : filtre === "a_rappeler" ? c.statut === "a_rappeler" : filtre === "anonymes" ? !c.client : c.statut === "terminee"
      ),
    [conversations, filtre]
  );
  const current = conversations.find((c) => c.id === sel) ?? list[0] ?? null;
  const aRappeler = conversations.filter((c) => c.statut === "a_rappeler").length;

  // Polling de l'état live de la conversation ouverte (toutes les 2,5 s).
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/conversations/${current.id}/live`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (alive && d.exists) setLive({ id: current.id, mode: d.mode, transcript: d.transcript ?? [], commercial: d.commercial });
      } catch { /* réseau indispo → on réessaie au prochain tick */ }
    };
    setLive(null);
    tick();
    const iv = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(iv); };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveForCurrent = live && current && live.id === current.id ? live : null;
  const transcript: Msg[] = liveForCurrent?.transcript ?? (current?.transcript as Msg[] ?? []);
  const mode: "ia" | "humain" = liveForCurrent?.mode ?? (current?.statut === STATUT_REPRISE ? "humain" : "ia");
  const auteur = liveForCurrent?.commercial ?? "Vous";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript.length, mode]);

  const optimistic = (msg: Msg) =>
    setLive((l) => (l && current && l.id === current.id ? { ...l, transcript: [...l.transcript, msg] } : l));

  const handleReprendre = () => {
    if (!current) return;
    optimistic({ role: "system", event: "takeover", text: `${auteur} a rejoint la conversation` });
    setLive((l) => (l && current && l.id === current.id ? { ...l, mode: "humain" } : l));
    startTransition(async () => { await reprendreMain(current.id); });
  };
  const handleRendre = () => {
    if (!current) return;
    optimistic({ role: "system", event: "handback", text: "L'assistant a repris la main" });
    setLive((l) => (l && current && l.id === current.id ? { ...l, mode: "ia" } : l));
    startTransition(async () => { await rendreMainIA(current.id); });
  };
  const handleSend = () => {
    const t = draft.trim();
    if (!t || !current) return;
    setDraft("");
    optimistic({ role: "commercial", text: t, author: liveForCurrent?.commercial ?? undefined });
    startTransition(async () => { await envoyerMessageCommercial(current.id, t); });
  };

  return (
    <div className="flex h-[calc(100vh-210px)] min-h-[460px] gap-4">
      {/* Liste */}
      <div className="nt-card flex w-[336px] shrink-0 flex-col overflow-hidden p-0">
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--line)] p-3">
          {(["all", "a_rappeler", "anonymes", "terminee"] as Filtre[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`nt-press shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filtre === f ? "bg-[var(--ink)] text-[var(--cream)]" : "bg-[var(--grey)] text-[var(--muted)] hover:bg-[var(--line-2)]"
              }`}
            >
              {{ all: "Toutes", a_rappeler: `À rappeler${aRappeler ? ` (${aRappeler})` : ""}`, anonymes: "Anonymes", terminee: "Terminées" }[f]}
            </button>
          ))}
        </div>
        <div className="nt-scroll flex-1 overflow-y-auto">
          {list.length === 0 && <p className="p-6 text-center text-sm text-[var(--faint)]">Aucune conversation.</p>}
          {list.map((c) => {
            const m = statutMeta(c.statut);
            const active = current?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={`flex w-full items-start gap-3 border-b border-[var(--line)] px-3.5 py-3 text-left transition-colors ${active ? "bg-[var(--lime-soft)]/60" : "hover:bg-[var(--bg-soft)]"}`}
              >
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${c.client ? "bg-[var(--lime-soft)] text-[var(--forest)]" : "bg-[var(--grey)] text-[var(--faint)]"}`}>
                  {c.client ? <UserRound className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--ink)]">{c.client ?? "Anonyme"}</span>
                    <span className="shrink-0 text-[0.65rem] text-[var(--faint)]">{depuis(c.updated_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--faint)]">{c.dernier_message || "—"}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${m.c}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.t}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transcript */}
      <div className={`nt-card flex min-w-0 flex-1 flex-col overflow-hidden p-0 ${mode === "humain" ? "ring-2 ring-[var(--forest)] nt-human-pulse" : ""}`}>
        {current ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${mode === "humain" ? "bg-[var(--forest)] text-[var(--cream)]" : current.client ? "bg-[var(--lime-soft)] text-[var(--forest)]" : "bg-[var(--grey)] text-[var(--faint)]"}`}>
                  {mode === "humain" ? <Headset className="h-4 w-4" /> : current.client ? <UserRound className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{current.client ?? "Conversation anonyme"}</p>
                  <p className="flex items-center gap-1.5 text-xs text-[var(--faint)]">
                    {mode === "humain" ? (
                      <span className="font-medium text-[var(--forest)]">● Pilotage humain en cours</span>
                    ) : (
                      <span>{transcript.length} messages · {depuis(current.updated_at)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mode === "ia" ? (
                  <button
                    onClick={handleReprendre}
                    disabled={pending}
                    className="nt-press flex items-center gap-1.5 rounded-lg bg-[var(--forest)] px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:bg-[#243016] disabled:opacity-60"
                  >
                    <Headset className="h-3.5 w-3.5" /> Reprendre la main
                  </button>
                ) : (
                  <button
                    onClick={handleRendre}
                    disabled={pending}
                    className="nt-press flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--bg-soft)] disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Rendre la main à l'IA
                  </button>
                )}
                {current.demande_id && (
                  <Link href={`/leads/${current.demande_id}`} className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[#20231a]">
                    Voir le lead <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {mode === "humain" && (
              <div className="nt-takeover-banner flex items-center gap-2 bg-[var(--forest)] px-5 py-2 text-xs font-medium text-[var(--cream)]">
                <Headset className="h-3.5 w-3.5" /> Vous pilotez cette conversation — l'IA est en pause. Vos messages apparaissent à votre nom, côté prospect aussi.
              </div>
            )}

            <div className="nt-scroll flex-1 overflow-y-auto bg-[var(--bg-soft)]/40 p-5">
              <Transcript messages={transcript} />
              <div ref={endRef} />
            </div>

            {/* Composer commercial — visible uniquement quand on pilote */}
            {mode === "humain" && (
              <div className="border-t border-[var(--line)] p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                    placeholder="Écrivez en tant que conseiller…"
                    className="nt-scroll max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--forest)]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || pending}
                    className="nt-press grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--forest)] text-[var(--cream)] transition-colors hover:bg-[#243016] disabled:opacity-40"
                    aria-label="Envoyer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-[var(--faint)]">
            <div className="text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-[var(--faint)]" />
              <p className="mt-2">Aucune conversation à afficher.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
