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

/** Fil de discussion IA ↔ prospect (bulles), partagé entre la page Conversations et la fiche demande. */
export function Transcript({ messages }: { messages: { role: string; text: string }[] }) {
  return (
    <div className="space-y-3">
      {messages.length === 0 && <p className="text-center text-sm text-[var(--faint)]">Transcript vide.</p>}
      {messages.map((msg, i) => {
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
