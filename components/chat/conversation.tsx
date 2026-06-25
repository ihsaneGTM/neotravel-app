"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

/** Marqueurs émis par l'agent pour afficher des éléments interactifs. */
function parseMarkers(text: string) {
  const lines = text.split("\n");
  let choices: { question: string; options: string[] } | null = null;
  let contact = false;
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("::choices::")) {
      const body = t.slice("::choices::".length).trim();
      const [q, opts] = body.split("||");
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

export function Conversation() {
  const [convId] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conv-${Date.now()}`));
  const { messages, sendMessage, status } = useChat({ id: convId });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 380 }}>
        {messages.length === 0 && (
          <Bubble role="assistant">
            Bonjour&nbsp;! Où souhaitez-vous aller, pour combien de personnes et à quelle date&nbsp;? Je vous aide à préparer votre demande.
          </Bubble>
        )}

        {messages.map((m, i) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const usesTool = m.role !== "user" && m.parts.some((p) => p.type.startsWith("tool-"));
          const isAssistant = m.role !== "user";
          const { display, choices, contact } = isAssistant ? parseMarkers(text) : { display: text, choices: null, contact: false };
          const isLast = i === messages.length - 1 && isAssistant && !busy;

          return (
            <div key={m.id} className="space-y-2">
              {display && <Bubble role={m.role === "user" ? "user" : "assistant"}>{display}</Bubble>}
              {usesTool && !display && <p className="pl-1 text-xs text-slate-400">Enregistrement de votre demande…</p>}
              {isLast && choices && <ChoiceWidget question={choices.question} options={choices.options} onPick={send} />}
              {isLast && contact && <ContactForm onSubmit={send} />}
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
          send(t);
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

function ChoiceWidget({ question, options, onPick }: { question: string; options: string[]; onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-2 pl-1">
      {question && <p className="text-sm text-slate-600">{question}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactForm({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [f, setF] = useState({ prenom: "", nom: "", email: "", telephone: "", consent: false });
  const [done, setDone] = useState(false);
  const ok = f.prenom.trim() && f.nom.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) && f.telephone.trim() && f.consent;

  if (done) return null;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">Vos coordonnées — un commercial vous rappelle dans la journée.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Prénom" value={f.prenom} onChange={(v) => setF({ ...f, prenom: v })} />
        <Field label="Nom" value={f.nom} onChange={(v) => setF({ ...f, nom: v })} />
      </div>
      <div className="mt-2">
        <Field label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
      </div>
      <div className="mt-2">
        <Field label="Téléphone" type="tel" value={f.telephone} onChange={(v) => setF({ ...f, telephone: v })} />
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 accent-emerald-600" />
        J'accepte d'être recontacté par NeoTravel au sujet de ma demande (RGPD).
      </label>
      <button
        disabled={!ok}
        onClick={() => {
          setDone(true);
          onSubmit(
            `Voici mes coordonnées — Prénom : ${f.prenom.trim()} · Nom : ${f.nom.trim()} · Email : ${f.email.trim()} · Téléphone : ${f.telephone.trim()} · Consentement RGPD : oui`
          );
        }}
        className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
      >
        Envoyer mes coordonnées
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
      />
    </label>
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
