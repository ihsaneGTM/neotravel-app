/** Statuts pipeline + métadonnées d'affichage (utilisable client ET serveur). */

export const STATUTS = [
  "new",
  "qualified",
  "contacted",
  "quote_sent",
  "negotiation",
  "won",
  "lost",
] as const;
export type Statut = (typeof STATUTS)[number];

export const STATUT_LABEL: Record<Statut, string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  contacted: "Contacté",
  quote_sent: "Devis envoyé",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

/** Couleurs par statut — rampe de marque (neutre froid → lime), `lost` en terracotta.
 *  hex = SVG/donut/dots ; badge = pills chaudes Tailwind (arbitraires var()). */
export const STATUT_META: Record<Statut, { hex: string; dot: string; badge: string }> = {
  new: { hex: "#6f7163", dot: "bg-[var(--faint)]", badge: "bg-[var(--grey)] text-[var(--forest)]" },
  qualified: { hex: "#38471f", dot: "bg-[var(--olive)]", badge: "bg-[var(--lime-soft)] text-[var(--forest)]" },
  contacted: { hex: "#2c3a1b", dot: "bg-[var(--forest)]", badge: "bg-[var(--lime-soft)] text-[var(--forest)]" },
  quote_sent: { hex: "#c2d23f", dot: "bg-[var(--lime-deep)]", badge: "bg-[var(--lime-soft)] text-[var(--forest)]" },
  negotiation: { hex: "#a8bc3c", dot: "bg-[#a8bc3c]", badge: "bg-[var(--lime-soft)] text-[var(--forest)]" },
  won: { hex: "#d8e762", dot: "bg-[var(--lime)]", badge: "bg-[var(--lime)] text-[var(--ink)]" },
  lost: { hex: "#b4452f", dot: "bg-[var(--terracotta)]", badge: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]" },
};

export const URGENCE_BADGE: Record<string, string> = {
  Urgent: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]",
  High: "bg-[#f6ead0] text-[#8a5a1f]",
  Medium: "bg-[var(--lime-soft)] text-[var(--forest)]",
  Low: "bg-[var(--grey)] text-[var(--faint)]",
};
