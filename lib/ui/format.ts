/** Helpers de formatage partagés (client + serveur). */

export const eur = (n: number, frac = 0) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: frac }).format(n);

export const eur2 = (n: number) => eur(n, 2);

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
