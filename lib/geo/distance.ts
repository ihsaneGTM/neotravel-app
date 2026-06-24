/**
 * Estimation de distance ville→ville.
 *
 * ⚠️ MVP STUB — à remplacer en J6 par une vraie API de routing
 * (OpenRouteService / Google Distance Matrix). Pour la démo, petite table de
 * paires courantes + valeur par défaut. Déterministe (ordre des villes ignoré).
 */
const TABLE: Record<string, number> = {
  "annecy|lyon": 140,
  "lyon|paris": 465,
  "lille|paris": 225,
  "marseille|nice": 200,
  "bordeaux|toulouse": 245,
  "grenoble|lyon": 110,
  "paris|rouen": 135,
  "chambery|lyon": 100,
  "lyon|marseille": 315,
  "nantes|paris": 385,
};

export interface DistanceEstimee {
  distance_km: number;
  source: "table" | "defaut";
}

export function estimerDistanceKm(villeA: string, villeB: string): DistanceEstimee {
  const key = [villeA, villeB]
    .map((s) => s.trim().toLowerCase())
    .sort()
    .join("|");
  if (key in TABLE) return { distance_km: TABLE[key], source: "table" };
  return { distance_km: 120, source: "defaut" };
}
