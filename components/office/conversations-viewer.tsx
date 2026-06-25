"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, UserRound, ShieldQuestion, PhoneCall, ArrowUpRight } from "lucide-react";
import type { ConversationItem } from "@/lib/dashboard/office-data";
import { depuis } from "@/lib/ui/format";
import { Rich } from "@/components/ui/rich-text";

type Filtre = "all" | "a_rappeler" | "anonymes" | "terminee";

/** Sépare le texte affichable des marqueurs interactifs (QCM / formulaire). */
function parseMarkers(text: string) {
  let choices: { question: string; options: string[] } | null = null;
  let contact = false;
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("::choices::")) {
      const [q, opts] = t.slice("::choices::".length).trim().split("||");
      const options = (opts ?? "").split("|").map((s) => s.trim()).filter(Boolean);
      if (options.length) choices = { question: (q ?? "").trim(), options };
    } else if (t.startsWith("::contact::")) {
      contact = true;
    } else {
      kept.push(line);
    }
  }
  return { display: kept.join("\n").trim(), choices, contact };
}

function statutMeta(s: string) {
  if (s === "a_rappeler") return { t: "À rappeler", c: "bg-rose-50 text-rose-600", dot: "bg-rose-500" };
  if (s === "terminee") return { t: "Terminée", c: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  return { t: "En cours", c: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
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
                filtre === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {{ all: "Toutes", a_rappeler: `À rappeler${aRappeler ? ` (${aRappeler})` : ""}`, anonymes: "Anonymes", terminee: "Terminées" }[f]}
            </button>
          ))}
        </div>
        <div className="nt-scroll flex-1 overflow-y-auto">
          {list.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Aucune conversation.</p>}
          {list.map((c) => {
            const m = statutMeta(c.statut);
            const active = current?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={`flex w-full items-start gap-3 border-b border-[var(--line)] px-3.5 py-3 text-left transition-colors ${active ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}
              >
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${c.client ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                  {c.client ? <UserRound className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{c.client ?? "Anonyme"}</span>
                    <span className="shrink-0 text-[0.65rem] text-slate-400">{depuis(c.updated_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{c.dernier_message || "—"}</p>
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
                <span className={`grid h-9 w-9 place-items-center rounded-full ${current.client ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                  {current.client ? <UserRound className="h-4 w-4" /> : <ShieldQuestion className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{current.client ?? "Conversation anonyme"}</p>
                  <p className="text-xs text-slate-400">{current.nb_messages} messages · {depuis(current.updated_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statutMeta(current.statut).c}`}>{statutMeta(current.statut).t}</span>
                {current.demande_id && (
                  <Link href={`/leads/${current.demande_id}`} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                    Voir le lead <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {current.statut === "a_rappeler" && (
              <div className="flex items-center gap-2 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-600">
                <PhoneCall className="h-3.5 w-3.5" /> L'IA a jugé ce dossier prioritaire — un commercial doit rappeler.
              </div>
            )}

            <div className="nt-scroll flex-1 space-y-3 overflow-y-auto bg-slate-50/40 p-5">
              {current.transcript.length === 0 && <p className="text-center text-sm text-slate-400">Transcript vide.</p>}
              {current.transcript.map((msg, i) => {
                if (msg.role === "user") {
                  const t = msg.text.trim();
                  if (!t) return null;
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[78%] rounded-2xl bg-indigo-600 px-3.5 py-2 text-sm leading-relaxed text-white"><Rich text={t} /></div>
                    </div>
                  );
                }
                const { display, choices, contact } = parseMarkers(msg.text);
                if (!display && !choices && !contact) return null;
                return (
                  <div key={i} className="flex flex-col items-start gap-1.5">
                    {display && <div className="max-w-[78%] rounded-2xl bg-white px-3.5 py-2 text-sm leading-relaxed text-slate-700 shadow-sm"><Rich text={display} /></div>}
                    {choices && (
                      <div className="max-w-[80%] rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2">
                        <p className="mb-1.5 text-[0.7rem] font-medium text-indigo-500">Choix proposés{choices.question ? ` · ${choices.question}` : ""}</p>
                        <div className="flex flex-wrap gap-1.5">{choices.options.map((o) => <span key={o} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">{o}</span>)}</div>
                      </div>
                    )}
                    {contact && <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-[0.7rem] font-medium text-emerald-600">🧾 Formulaire de coordonnées proposé</div>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-slate-400">
            <div className="text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">Aucune conversation à afficher.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
