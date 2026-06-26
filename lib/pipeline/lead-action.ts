/**
 * Source UNIQUE de vérité du "propriétaire d'action" d'un lead.
 * Module PUR (pas de server-only, pas de lucide) → importable client ET serveur,
 * comme lib/ui/statuts.ts. Les icônes sont des clés string mappées côté UI.
 *
 * 3 propriétaires : 🤖 ia (le système travaille), 👤 commercial (action humaine
 * requise), ⏳ prospect (on attend le client). + done (état terminal).
 */
import type { Statut } from "@/lib/ui/statuts";

export type ActionOwner = "ia" | "commercial" | "prospect" | "done";
export type ActionIcon = "sparkles" | "phone" | "file" | "send" | "clock" | "user" | "check" | "x";
export type CtaKind = "generer" | "envoyer" | "avancer";

export interface LeadActionCtx {
  /** Un devis ferme existe déjà (généré, pas forcément envoyé). */
  devisPret?: boolean;
  /** Une relance de devis est en retard. */
  relanceEnRetard?: boolean;
}

export interface LeadAction {
  owner: ActionOwner;
  /** Libellé court (badge carte / colonne). */
  label: string;
  /** Phrase explicative (barre flottante). */
  detail: string;
  icon: ActionIcon;
  /** Libellé du bouton d'action principal (si owner = commercial). */
  cta?: string;
  ctaKind?: CtaKind;
}

/** Métadonnées de style par propriétaire (classes Tailwind ↔ tokens de marque). */
export const OWNER_META: Record<ActionOwner, { label: string; icon: ActionIcon; badge: string; dot: string }> = {
  // commercial = signal FORT (action requise) : lime-soft + forest + anneau lime-deep
  commercial: { label: "À vous", icon: "user", badge: "bg-[var(--lime-soft)] text-[var(--forest)] ring-1 ring-[var(--lime-deep)]", dot: "var(--lime-deep)" },
  // ia = discret (laisser faire) : olive sur gris chaud
  ia: { label: "IA", icon: "sparkles", badge: "bg-[var(--grey)] text-[var(--olive)]", dot: "var(--olive)" },
  // prospect = neutre/attente : gris + faint
  prospect: { label: "En attente", icon: "clock", badge: "bg-[var(--grey)] text-[var(--faint)]", dot: "var(--faint)" },
  done: { label: "Terminé", icon: "check", badge: "bg-[var(--grey)] text-[var(--faint)]", dot: "var(--faint)" },
};

/** Retourne l'action canonique d'un lead à partir de son statut (+ contexte optionnel). */
export function leadAction(statut: Statut, ctx: LeadActionCtx = {}): LeadAction {
  switch (statut) {
    case "new":
      return { owner: "ia", icon: "sparkles", label: "Qualification IA", detail: "L'IA qualifie et attribue ce lead automatiquement — rien à faire de votre côté pour l'instant." };
    case "qualified":
      return { owner: "ia", icon: "phone", label: "Appel IA (démo)", detail: "Appel commercial et retranscription en cours (simulation démo). Le lead passera en « Contacté » automatiquement." };
    case "contacted":
      return ctx.devisPret
        ? { owner: "commercial", icon: "send", label: "Devis à envoyer", detail: "Le devis ferme est prêt. Vérifiez les informations puis envoyez-le au client.", cta: "Envoyer le devis", ctaKind: "envoyer" }
        : { owner: "commercial", icon: "file", label: "Devis à générer", detail: "Le client a été contacté. Générez le devis ferme pour pouvoir l'envoyer.", cta: "Générer le devis ferme", ctaKind: "generer" };
    case "quote_sent":
      return ctx.relanceEnRetard
        ? { owner: "commercial", icon: "clock", label: "Relance en retard", detail: "Une relance de devis est en retard — relancez le client.", cta: "Faire avancer", ctaKind: "avancer" }
        : { owner: "prospect", icon: "clock", label: "En attente client", detail: "Devis envoyé — en attente de la réponse du client. Les relances automatiques sont planifiées." };
    case "negotiation":
      return { owner: "commercial", icon: "user", label: "À finaliser", detail: "Le client négocie. Ajustez l'offre si besoin puis faites avancer le statut.", cta: "Faire avancer", ctaKind: "avancer" };
    case "won":
      return { owner: "done", icon: "check", label: "Gagné", detail: "Affaire gagnée. Aucune action requise." };
    case "lost":
      return { owner: "done", icon: "x", label: "Perdu", detail: "Affaire perdue. Aucune action requise." };
  }
}

/** Vrai si le commercial doit agir (pour les compteurs et la mise en avant). */
export function isCommercialAction(a: LeadAction): boolean {
  return a.owner === "commercial";
}
