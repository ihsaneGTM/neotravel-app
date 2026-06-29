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
  /** Nombre total de relances planifiées pour ce lead. */
  relancesTotal?: number;
  /** Nombre de relances échues (envoyées OU dont la date est passée). */
  relancesDues?: number;
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
    case "quote_sent": {
      const total = ctx.relancesTotal ?? 0;
      const dues = ctx.relancesDues ?? 0;
      if (total > 0 && dues >= total)
        return { owner: "commercial", icon: "phone", label: "À rappeler", detail: "Toutes les relances ont été envoyées sans réponse — reprenez la main et rappelez le client.", cta: "Faire avancer", ctaKind: "avancer" };
      if (dues > 0)
        return { owner: "prospect", icon: "clock", label: "En cours de relance", detail: `Relance ${dues}/${total} envoyée — en attente de la réponse du client.` };
      return { owner: "prospect", icon: "clock", label: "En attente client", detail: "Devis envoyé — en attente de la réponse du client. Les relances automatiques sont planifiées." };
    }
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

// ── Colonnes du board (timeline) — au-delà des statuts DB ────────────────────
// quote_sent est éclaté en 3 sous-états selon l'avancement des relances :
// « Devis envoyé » → « En cours de relance » → « À rappeler » (le commercial reprend la main).
export type BoardKey = "new" | "qualified" | "contacted" | "devis_envoye" | "relance" | "a_rappeler" | "negotiation" | "won" | "lost";

export interface BoardColumn {
  key: BoardKey;
  label: string;
  owner: ActionOwner;
  hex: string;
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: "new", label: "Nouveau", owner: "ia", hex: "#6f7163" },
  { key: "qualified", label: "Qualifié", owner: "ia", hex: "#38471f" },
  { key: "contacted", label: "Contacté", owner: "commercial", hex: "#2c3a1b" },
  { key: "devis_envoye", label: "Devis envoyé", owner: "prospect", hex: "#c2d23f" },
  { key: "relance", label: "En cours de relance", owner: "prospect", hex: "#a8bc3c" },
  { key: "a_rappeler", label: "À rappeler", owner: "commercial", hex: "#b4452f" },
  { key: "negotiation", label: "Négociation", owner: "commercial", hex: "#a8bc3c" },
  { key: "won", label: "Gagné", owner: "done", hex: "#d8e762" },
  { key: "lost", label: "Perdu", owner: "done", hex: "#b4452f" },
];

/** Statut DB cible quand on dépose un lead dans une colonne (drag-and-drop). */
export const BOARD_TO_STATUT: Record<BoardKey, Statut> = {
  new: "new",
  qualified: "qualified",
  contacted: "contacted",
  devis_envoye: "quote_sent",
  relance: "quote_sent",
  a_rappeler: "quote_sent",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
};

/** Colonne board d'un lead à partir de son statut (+ avancement des relances). */
export function boardColumnOf(statut: Statut, ctx: LeadActionCtx = {}): BoardKey {
  if (statut === "quote_sent") {
    const total = ctx.relancesTotal ?? 0;
    const dues = ctx.relancesDues ?? 0;
    if (total > 0 && dues >= total) return "a_rappeler";
    if (dues > 0) return "relance";
    return "devis_envoye";
  }
  return statut as BoardKey; // new/qualified/contacted/negotiation/won/lost → 1:1
}
