import { Sparkles, Headset } from "lucide-react";
import { Rich } from "@/components/ui/rich-text";

/** Sépare le texte affichable des marqueurs interactifs (QCM / formulaire de contact). */
export function parseMarkers(text: string) {
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

type Msg = { role: string; text: string; author?: string; event?: string };

const initiales = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C";

/** Divider animé pour les évènements de reprise en main / retour à l'IA. */
function SystemDivider({ msg, fresh }: { msg: Msg; fresh: boolean }) {
  const takeover = msg.event === "takeover";
  return (
    <div className={`flex items-center justify-center py-1 ${fresh ? "nt-takeover-in" : ""}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-semibold ${
          takeover ? "bg-[var(--forest)] text-[var(--cream)]" : "bg-[var(--grey)] text-[var(--muted)]"
        }`}
      >
        {takeover ? <Headset className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        {msg.text}
      </span>
    </div>
  );
}

/** Fil de discussion : prospect (droite), IA (gauche, blanc), commercial humain (gauche, forêt), évènements système (centre). */
export function Transcript({ messages }: { messages: Msg[] }) {
  // Index du dernier évènement système → animé une seule fois.
  let lastSystem = -1;
  messages.forEach((m, i) => { if (m.role === "system") lastSystem = i; });

  return (
    <div className="space-y-3">
      {messages.length === 0 && <p className="text-center text-sm text-[var(--faint)]">Transcript vide.</p>}
      {messages.map((msg, i) => {
        if (msg.role === "system") return <SystemDivider key={i} msg={msg} fresh={i === lastSystem} />;

        if (msg.role === "user") {
          const t = msg.text.trim();
          if (!t) return null;
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl bg-[var(--ink)] px-3.5 py-2 text-sm leading-relaxed text-[var(--cream)]">
                <Rich text={t} />
              </div>
            </div>
          );
        }

        if (msg.role === "commercial") {
          const t = msg.text.trim();
          if (!t) return null;
          return (
            <div key={i} className="flex items-end gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--forest)] text-[0.6rem] font-bold text-[var(--cream)]">
                {initiales(msg.author ?? "")}
              </span>
              <div className="max-w-[78%]">
                <p className="mb-0.5 ml-1 text-[0.65rem] font-semibold text-[var(--forest)]">{msg.author ?? "Conseiller"}</p>
                <div className="rounded-2xl rounded-bl-sm bg-[var(--lime-soft)] px-3.5 py-2 text-sm leading-relaxed text-[var(--ink)] ring-1 ring-[var(--lime-deep)]/30">
                  <Rich text={t} />
                </div>
              </div>
            </div>
          );
        }

        const { display, choices, contact } = parseMarkers(msg.text);
        if (!display && !choices && !contact) return null;
        return (
          <div key={i} className="flex flex-col items-start gap-1.5">
            {display && (
              <div className="max-w-[78%] rounded-2xl bg-white px-3.5 py-2 text-sm leading-relaxed text-[var(--ink)] shadow-sm">
                <Rich text={display} />
              </div>
            )}
            {choices && (
              <div className="max-w-[80%] rounded-xl border border-dashed border-[var(--lime-deep)] bg-[var(--lime-soft)]/50 px-3 py-2">
                <p className="mb-1.5 text-[0.7rem] font-medium text-[var(--olive)]">
                  Choix proposés{choices.question ? ` · ${choices.question}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {choices.options.map((o) => (
                    <span key={o} className="rounded-full bg-white px-2.5 py-1 text-xs text-[var(--muted)] shadow-sm">{o}</span>
                  ))}
                </div>
              </div>
            )}
            {contact && (
              <div className="rounded-xl border border-dashed border-[var(--lime-deep)] bg-[var(--lime-soft)]/50 px-3 py-1.5 text-[0.7rem] font-medium text-[var(--forest)]">
                🧾 Formulaire de coordonnées proposé
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
