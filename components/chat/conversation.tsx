"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { Rich } from "@/components/ui/rich-text";

type LiveMsg = { role: string; text: string; author?: string; event?: string };
const initiales = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C";

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

  // Reprise humaine : on interroge l'état live ; si un conseiller pilote, l'IA se tait.
  const [human, setHuman] = useState(false);
  const [conseiller, setConseiller] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<LiveMsg[]>([]);
  const [sendingHuman, setSendingHuman] = useState(false);
  const wasHuman = useRef(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/conversations/${convId}/live`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!alive || !d.exists) return;
        const isHuman = d.mode === "humain";
        setHuman(isHuman);
        setConseiller(d.commercial ?? null);
        if (isHuman || wasHuman.current) setLiveTranscript(Array.isArray(d.transcript) ? d.transcript : []);
        if (isHuman) wasHuman.current = true;
      } catch { /* réessai au prochain tick */ }
    };
    const iv = setInterval(poll, 2500);
    poll();
    return () => { alive = false; clearInterval(iv); };
  }, [convId]);

  // Auto-amorçage : envoie le trajet composé dans le hero une seule fois.
  useEffect(() => {
    if (initialMessage && !startedRef.current) {
      startedRef.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, sendMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, liveTranscript.length, human]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    // Mode humain : on poste au conseiller (pas à l'IA).
    if (human) {
      setSendingHuman(true);
      setLiveTranscript((prev) => [...prev, { role: "user", text: t }]);
      try {
        await fetch(`/api/conversations/${convId}/message`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
      } catch { /* réseau : le message réapparaîtra au prochain poll si échec */ }
      setSendingHuman(false);
      return;
    }
    if (busy) return;
    sendMessage({ text });
  };

  return (
    <div className="lp-chat">
      <div className="lp-chat-scroll">
        {human && <TakeoverBanner conseiller={conseiller} />}

        {human ? (
          <HumanThread transcript={liveTranscript} />
        ) : (
          <AiThread />
        )}
        <div ref={endRef} />
      </div>

      <form
        className="lp-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t || (human ? sendingHuman : busy)) return;
          send(t);
          setInput("");
        }}
      >
        <input
          className="lp-chat-input"
          placeholder={human ? `Écrivez à ${conseiller ?? "votre conseiller"}…` : "Écrivez votre réponse…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={human ? sendingHuman : busy}
          autoFocus
        />
        <button type="submit" className="lp-chat-send" disabled={(human ? sendingHuman : busy) || !input.trim()} aria-label="Envoyer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );

  // ── Rendu mode IA (agent) ────────────────────────────────────────────
  function AiThread() {
    return (
      <>
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
      </>
    );
  }
}

/** Bandeau « un conseiller a rejoint » côté prospect (effet de reprise en main). */
function TakeoverBanner({ conseiller }: { conseiller: string | null }) {
  return (
    <div
      className="nt-takeover-banner"
      style={{
        display: "flex", alignItems: "center", gap: 8, alignSelf: "stretch",
        background: "var(--forest)", color: "var(--cream)", borderRadius: 14,
        padding: "10px 14px", marginBottom: 4, fontSize: "0.82rem", fontWeight: 600,
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,.18)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11a9 9 0 0 1 18 0M21 16v1a3 3 0 0 1-3 3h-3M3 11v3a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2zM18 11v5h1a2 2 0 0 0 2-2v-1" /></svg>
      </span>
      {conseiller ? `${conseiller} a rejoint la conversation` : "Un conseiller a rejoint la conversation"}
    </div>
  );
}

/** Fil en mode reprise humaine côté prospect : prospect (droite), conseiller (gauche, humain), évènements (centre). */
function HumanThread({ transcript }: { transcript: LiveMsg[] }) {
  let lastSystem = -1;
  transcript.forEach((m, i) => { if (m.role === "system") lastSystem = i; });
  return (
    <>
      {transcript.map((m, i) => {
        if (m.role === "system") {
          return (
            <div key={i} className={i === lastSystem ? "nt-takeover-in" : ""} style={{ alignSelf: "center", fontSize: "0.72rem", color: "var(--ink-soft, #777)", padding: "2px 0" }}>
              {m.text}
            </div>
          );
        }
        if (m.role === "user") {
          if (!m.text.trim()) return null;
          return <Bubble key={i} role="user">{m.text}</Bubble>;
        }
        if (m.role === "commercial") {
          if (!m.text.trim()) return null;
          return (
            <div key={i} style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "85%" }}>
              <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999, background: "var(--forest)", color: "var(--cream)", fontSize: "0.62rem", fontWeight: 700, flexShrink: 0 }}>
                {initiales(m.author ?? "")}
              </span>
              <div>
                <p style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--forest)", margin: "0 0 2px 2px" }}>{m.author ?? "Conseiller"}</p>
                <div className="lp-bubble lp-bubble-bot" style={{ borderColor: "var(--forest)" }}>
                  <Rich text={m.text} />
                </div>
              </div>
            </div>
          );
        }
        // assistant (historique IA avant la reprise) — texte seul, sans widgets
        const { display } = parseMarkers(m.text);
        if (!display) return null;
        return <Bubble key={i} role="assistant">{display}</Bubble>;
      })}
    </>
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
