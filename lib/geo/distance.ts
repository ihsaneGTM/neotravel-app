/**
 * Estimation de la distance routière (aller) entre deux villes.
 *
 * Géocodage via OpenStreetMap Nominatim, puis distance routière réelle via OSRM
 * (serveur public, sans clé). Repli haversine × 1.3 (facteur route) si OSRM échoue,
 * puis valeur par défaut en dernier recours.
 */

interface Coord {
  lat: number;
  lon: number;
}

const UA = { "User-Agent": "NeoTravel-devis/1.0 (atelier MBA)" } as const;

async function geocode(ville: string): Promise<Coord | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${ville}, France`)}&format=json&limit=1`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = (await r.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(j) || j.length === 0) return null;
  return { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function drivingKm(a: Coord, b: Coord): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = (await r.json()) as { routes?: Array<{ distance: number }> };
  const d = j.routes?.[0]?.distance;
  return typeof d === "number" ? d / 1000 : null;
}

export interface DistanceEstimee {
  distance_km: number;
  source: "osrm" | "haversine" | "defaut";
}

export async function estimerDistanceKm(villeDepart: string, villeArrivee: string): Promise<DistanceEstimee> {
  try {
    const a = await geocode(villeDepart);
    const b = await geocode(villeArrivee);
    if (a && b) {
      const osrm = await drivingKm(a, b);
      if (osrm && osrm > 0) return { distance_km: Math.round(osrm), source: "osrm" };
      return { distance_km: Math.round(haversineKm(a, b) * 1.3), source: "haversine" };
    }
  } catch {
    /* repli ci-dessous */
  }
  return { distance_km: 120, source: "defaut" };
}
