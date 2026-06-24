"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

export function Conversation() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 380 }}>
        {messages.length === 0 && (
          <Bubble role="assistant">
            Bonjour&nbsp;! Où souhaitez-vous aller, pour combien de personnes et à quelle date&nbsp;? Je vous prépare une estimation.
          </Bubble>
        )}

        {messages.map((m) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const usesTool = m.role !== "user" && m.parts.some((p) => p.type.startsWith("tool-"));
          return (
            <div key={m.id} className="space-y-1">
              {text && <Bubble role={m.role === "user" ? "user" : "assistant"}>{text}</Bubble>}
              {usesTool && <p className="pl-1 text-xs text-slate-400">calcul du tarif / enregistrement…</p>}
            </div>
          );
        })}

        {busy && <p className="pl-1 text-xs text-slate-400">NeoTravel écrit…</p>}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || busy) return;
          sendMessage({ text: t });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Décrivez votre besoin…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
          disabled={busy || !input.trim()}
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          mine ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
