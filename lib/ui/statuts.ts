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

/** Couleurs par statut (hex pour SVG/donut + classes Tailwind pour les badges). */
export const STATUT_META: Record<Statut, { hex: string; dot: string; badge: string }> = {
  new: { hex: "#6366f1", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  qualified: { hex: "#10b981", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  contacted: { hex: "#0ea5e9", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700" },
  quote_sent: { hex: "#f59e0b", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  negotiation: { hex: "#8b5cf6", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700" },
  won: { hex: "#059669", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800" },
  lost: { hex: "#f43f5e", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
};

export const URGENCE_BADGE: Record<string, string> = {
  Urgent: "bg-rose-50 text-rose-600",
  High: "bg-orange-50 text-orange-600",
  Medium: "bg-amber-50 text-amber-600",
  Low: "bg-slate-100 text-slate-500",
};
