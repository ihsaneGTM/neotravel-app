/**
 * SLA de traitement — « ne pas faire attendre les prospects ».
 *
 * Règle métier (dossier de cadrage) : les cas simples doivent être traités dans
 * la JOURNÉE ; au-delà de 48 h c'est un échec (l'historique PME : 50 % des
 * demandes > 48 h). On matérialise ce délai d'attente pour prioriser, en plus
 * du score business — pour qu'un petit deal qui traîne ne soit jamais oublié.
 *
 * Module PUR (pas de server-only, pas de lucide) → importable client ET serveur.
 * Respecte la contrainte design : terracotta est la SEULE couleur d'alerte,
 * graduée en deux paliers (soft = en retard 24-48 h, plein = SLA dépassé > 48 h).
 */
import type { ActionOwner } from "@/lib/pipeline/lead-action";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Seuils du SLA, exprimés en heures depuis la première demande. */
export const SLA_TODAY_H = 24; // objectif : traité dans la journée
export const SLA_LATE_H = 48; // au-delà : en retard, puis dépassé

export type WaitTier = "none" | "ok" | "late" | "breach";

/** Style par palier (classes Tailwind ↔ tokens de marque). */
export const WAIT_TIER_META: Record<WaitTier, { chip: string; dot: string; pulse: boolean }> = {
  none: { chip: "", dot: "var(--faint)", pulse: false },
  ok: { chip: "text-[var(--faint)]", dot: "var(--faint)", pulse: false },
  late: { chip: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]", dot: "var(--terracotta)", pulse: false },
  // Pas de pulse : sur un backlog chargé, des dizaines de chips clignotants nuiraient à la lisibilité.
  breach: { chip: "bg-[var(--terracotta)] text-white", dot: "var(--terracotta)", pulse: false },
};

/** Durée courte en français : « 3 j » / « 5 h » / « 12 min » / « à l'instant ». */
export function humanizeMs(ms: number): string {
  if (ms < 60_000) return "à l'instant";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(ms / HOUR);
  if (h < 24) return `${h} h`;
  const j = Math.floor(ms / DAY);
  return `${j} j`;
}

export interface SlaInfo {
  /** Ancienneté depuis la 1ʳᵉ demande (fin de conversation IA). */
  ageMs: number;
  ageLabel: string;
  /** Temps passé dans l'étape (colonne) actuelle, si connu. */
  columnMs: number | null;
  columnLabel: string | null;
  tier: WaitTier;
  /** Texte sémantique court (pour tooltip / en-tête de colonne). */
  status: string;
}

function baseTier(ageMs: number): WaitTier {
  const h = ageMs / HOUR;
  if (h < SLA_TODAY_H) return "ok";
  if (h < SLA_LATE_H) return "late";
  return "breach";
}

/**
 * Calcule l'état SLA d'un lead. Le palier d'alerte ne s'allume QUE quand la
 * balle est dans le camp de l'équipe (commercial), ou si l'automatisation a
 * calé (ia bloquée > 24 h). En attente client (prospect) → neutre, les relances
 * gèrent ce délai ; terminé → aucun indicateur.
 */
export function slaInfo(createdAt: string, enteredAt: string | null, owner: ActionOwner): SlaInfo {
  const now = Date.now();
  const ageMs = Math.max(0, now - new Date(createdAt).getTime());
  const columnMs = enteredAt ? Math.max(0, now - new Date(enteredAt).getTime()) : null;

  let tier: WaitTier;
  if (owner === "done") tier = "none";
  else if (owner === "commercial") tier = baseTier(ageMs);
  else if (owner === "ia") tier = ageMs / HOUR < SLA_TODAY_H ? "ok" : baseTier(ageMs); // doit être rapide
  else tier = "ok"; // prospect : on attend le client, relances en cours

  const status =
    tier === "breach" ? "SLA dépassé (> 48 h)" : tier === "late" ? "En retard (> 24 h)" : owner === "prospect" ? "En attente client" : "Dans les délais";

  return {
    ageMs,
    ageLabel: humanizeMs(ageMs),
    columnMs,
    // On masque le « depuis X » de l'étape s'il est trivial (< 1 h) — évite « depuis l'instant » trompeur.
    columnLabel: columnMs != null && columnMs >= HOUR ? humanizeMs(columnMs) : null,
    tier,
    status,
  };
}

/**
 * Rang de priorité (plus haut = plus urgent) pour le tri par défaut.
 * Mêle le score business et la pression d'attente : un lead où l'équipe doit
 * agir et qui patiente fait remonter même un petit panier — on ne laisse
 * jamais traîner. Plafonné à 120 h pour éviter qu'un très vieux lead écrase tout.
 */
export function priorityRank(score: number, ageMs: number, owner: ActionOwner): number {
  const hours = Math.min(ageMs / HOUR, 120);
  const weight = owner === "commercial" ? 2.2 : owner === "ia" ? 0.8 : owner === "prospect" ? 0.4 : 0;
  return score + hours * weight;
}
