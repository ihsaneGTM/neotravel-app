"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Conversation } from "@/components/chat/conversation";

const EVT = "neotravel:open-chat";

/** Ouvre le chat depuis n'importe quel bouton (même rendu côté serveur via OpenChatButton). */
export function openChat(message?: string) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { message } }));
}

/** Bouton client qui déclenche l'ouverture du chat. */
export function OpenChatButton({
  children,
  message,
  className = "lp-btn lp-btn-primary",
  ...rest
}: {
  children: ReactNode;
  message?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={className} onClick={() => openChat(message)} {...rest}>
      {children}
    </button>
  );
}

/** Hôte unique de l'overlay de conversation. À monter une fois dans la page. */
export function ChatProvider() {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      setInitial(msg);
      setOpen(true);
    };
    window.addEventListener(EVT, onOpen as EventListener);
    return () => window.removeEventListener(EVT, onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Assistant NeoTravel">
      <div className="lp-overlay-scrim" onClick={() => setOpen(false)} />
      <div className="lp-sheet">
        <div className="lp-sheet-head">
          <div className="lp-sheet-avatar" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            </svg>
          </div>
          <div>
            <div className="lp-sheet-title">Assistant NeoTravel</div>
            <div className="lp-sheet-sub">En ligne · réponse immédiate</div>
          </div>
          <button className="lp-sheet-close" onClick={() => setOpen(false)} aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* key=initial : remonte une conversation neuve à chaque trajet différent */}
        <Conversation key={initial ?? "blank"} initialMessage={initial} />
      </div>
    </div>
  );
}
