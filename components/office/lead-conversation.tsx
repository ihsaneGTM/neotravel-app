"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, ChevronDown, PhoneCall, ArrowUpRight } from "lucide-react";
import { Transcript } from "@/components/office/transcript";
import { depuis } from "@/lib/ui/format";

type Conv = {
  id: string;
  statut: string;
  nb_messages: number;
  updated_at: string;
  transcript: { role: string; text: string }[];
};

/** Aperçu repliable de la conversation IA, intégré à la fiche demande. */
export function LeadConversation({ conv }: { conv: Conv }) {
  // Conversation courte → ouverte d'emblée ; longue → repliée pour ne pas noyer la fiche.
  const [open, setOpen] = useState(conv.transcript.length <= 8);
  const aRappeler = conv.statut === "a_rappeler";

  return (
    <div className="nt-card overflow-hidden p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-soft)]"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--lime-soft)] text-[var(--forest)]">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">Conversation IA</span>
            <span className="block text-xs text-[var(--faint)]">{conv.nb_messages} messages · {depuis(conv.updated_at)}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {aRappeler && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--terracotta-soft)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--terracotta-ink)]">
              <PhoneCall className="h-3 w-3" /> À rappeler
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-[var(--faint)] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--line)]">
          <div className="nt-scroll max-h-[460px] overflow-y-auto bg-[var(--bg-soft)]/40 p-5">
            <Transcript messages={conv.transcript} />
          </div>
          <div className="flex justify-end border-t border-[var(--line)] px-5 py-2.5">
            <Link
              href="/conversations"
              className="flex items-center gap-1 text-xs font-semibold text-[var(--forest)] hover:underline"
            >
              Ouvrir dans Conversations <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
