"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { Rich } from "@/components/ui/rich-text";

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

export function Conversation({
  initialMessage,
  greeting = "Bonjour ! Où souhaitez-vous aller, pour combien de personnes et à quelle date ? Je vous aide à préparer votre demande.",
}: {
  initialMessage?: string;
  greeting?: string;
}) {
  const [convId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conv-${Date.now()}`
  );
  const { messages, sendMessage, status } = useChat({ id: convId });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const busy = status === "submitted" || status === "streaming";

  // Auto-amorçage : envoie le trajet composé dans le hero une seule fois.
  useEffect(() => {
    if (initialMessage && !startedRef.current) {
      startedRef.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, sendMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
  };

  return (
    <div className="lp-chat">
      <div className="lp-chat-scroll">
        {messages.length === 0 && !initialMessage && <Bubble role="assistant">{greeting}</Bubble>}

        {messages.map((m, i) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          const usesTool = m.role !== "user" && m.parts.some((p) => p.type.startsWith("tool-"));
          const isAssistant = m.role !== "user";
          const { display, choices, contact } = isAssistant
            ? parseMarkers(text)
            : { display: text, choices: null, contact: false };
          const isLast = i === messages.length - 1 && isAssistant && !busy;

          return (
            <div key={m.id} className="lp-chat-row" style={{ display: "contents" }}>
              {display && <Bubble role={m.role === "user" ? "user" : "assistant"}>{display}</Bubble>}
              {usesTool && !display && <p style={{ fontSize: "0.78rem", color: "var(--ink-faint)", paddingLeft: 4 }}>Enregistrement de votre demande…</p>}
              {isLast && choices && <ChoiceWidget question={choices.question} options={choices.options} onPick={send} />}
              {isLast && contact && <ContactForm onSubmit={send} />}
            </div>
          );
        })}

        {busy && (
          <div className="lp-typing">
            <i /><i /><i />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="lp-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || busy) return;
          send(t);
          setInput("");
        }}
      >
        <input
          className="lp-chat-input"
          placeholder="Écrivez votre réponse…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <button type="submit" className="lp-chat-send" disabled={busy || !input.trim()} aria-label="Envoyer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function ChoiceWidget({ question, options, onPick }: { question: string; options: string[]; onPick: (t: string) => void }) {
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 8 }}>
      {question && <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>{question}</p>}
      <div className="lp-chips">
        {options.map((o) => (
          <button key={o} className="lp-chip" onClick={() => onPick(o)}>
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
  const ok =
    f.prenom.trim() &&
    f.nom.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) &&
    f.telephone.trim() &&
    f.consent;

  if (done) return null;

  return (
    <div className="lp-cform">
      <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
        Vos coordonnées — un conseiller vous rappelle dans la journée.
      </p>
      <div className="lp-cform-grid">
        <Field label="Prénom" value={f.prenom} onChange={(v) => setF({ ...f, prenom: v })} />
        <Field label="Nom" value={f.nom} onChange={(v) => setF({ ...f, nom: v })} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Field label="Téléphone" type="tel" value={f.telephone} onChange={(v) => setF({ ...f, telephone: v })} />
      </div>
      <label style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.78rem", color: "var(--ink-soft)" }}>
        <input
          type="checkbox"
          checked={f.consent}
          onChange={(e) => setF({ ...f, consent: e.target.checked })}
          style={{ marginTop: 2, accentColor: "var(--green)" }}
        />
        J&apos;accepte d&apos;être recontacté par NeoTravel au sujet de ma demande (RGPD).
      </label>
      <button
        disabled={!ok}
        onClick={() => {
          setDone(true);
          onSubmit(
            `Voici mes coordonnées — Prénom : ${f.prenom.trim()} · Nom : ${f.nom.trim()} · Email : ${f.email.trim()} · Téléphone : ${f.telephone.trim()} · Consentement RGPD : oui`
          );
        }}
        className="lp-btn lp-btn-primary"
        style={{ marginTop: 14, width: "100%" }}
      >
        Envoyer mes coordonnées
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={role === "user" ? "lp-bubble lp-bubble-me" : "lp-bubble lp-bubble-bot"}>
      {typeof children === "string" ? <Rich text={children} /> : children}
    </div>
  );
}
