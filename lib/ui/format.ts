/** Helpers de formatage partagés (client + serveur). */

export const eur = (n: number, frac = 0) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: frac }).format(n);

export const eur2 = (n: number) => eur(n, 2);

/** Date en format français long : "6 novembre 2026" (jamais le format ISO/américain). */
export function dateFR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Heure en format français : "09:00" / "09:00:00" → "9h00". Null si absente. */
export function heureFR(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${Number(m[1])}h${m[2]}` : h;
}

/** "il y a 3 h" / "il y a 2 j" à partir d'une date ISO. */
export function depuis(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}
