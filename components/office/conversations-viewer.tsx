"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, UserRound, ShieldQuestion, PhoneCall, ArrowUpRight } from "lucide-react";
import type { ConversationItem } from "@/lib/dashboard/office-data";
import { depuis } from "@/lib/ui/format";
import { Transcript } from "@/components/office/transcript";

type Filtre = "all" | "a_rappeler" | "anonymes" | "terminee";

function statutMeta(s: string) {
  if (s === "a_rappeler") return { t: "À rappeler", c: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]", dot: "bg-[var(--terracotta)]" };
  if (s === "terminee") return { t: "Terminée", c: "bg-[var(--lime-soft)] text-[var(--forest)]", dot: "bg-[var(--forest)]" };
  return { t: "En cours", c: "bg-[var(--grey)] text-[var(--muted)]", dot: "bg-[var(--faint)]" };
}

export function ConversationsViewer({ conversations }: { conversations: ConversationItem[] }) {
  const [filtre, setFiltre] = useState<Filtre>("all");
  const [sel, setSel] = useState<string | null>(conversations[0]?.id ?? null);

  const list = useMemo(
    () =>
      conversations.filter((c) =>
        filtre === "all" ? true : filtre === "a_rappeler" ? c.statut === "a_rappeler" : filtre === "anonymes" ? !c.client : c.statut === "terminee"
      ),
    [conversations, filtre]
  );
  const current = conversations.find((c) => c.id === sel) ?? list[0] ?? null;
  const aRappeler = conversations.filter((c) => c.statut === "a_rappeler").length;

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
      <div className="nt-card flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        {current ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${current.client ? "bg-[var(--lime-soft)] text-[var(--forest)]" : "bg-[var(--grey)] text-[var(--faint)]"}`}>
                  {current.client ? <UserRound className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{current.client ?? "Conversation anonyme"}</p>
                  <p className="text-xs text-[var(--faint)]">{current.nb_messages} messages · {depuis(current.updated_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statutMeta(current.statut).c}`}>{statutMeta(current.statut).t}</span>
                {current.demande_id && (
                  <Link href={`/leads/${current.demande_id}`} className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[#20231a]">
                    Voir le lead <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {current.statut === "a_rappeler" && (
              <div className="flex items-center gap-2 bg-[var(--terracotta-soft)] px-5 py-2 text-xs font-medium text-[var(--terracotta-ink)]">
                <PhoneCall className="h-3.5 w-3.5" /> L'IA a jugé ce dossier prioritaire — un commercial doit rappeler.
              </div>
            )}

            <div className="nt-scroll flex-1 overflow-y-auto bg-[var(--bg-soft)]/40 p-5">
              <Transcript messages={current.transcript} />
            </div>
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
