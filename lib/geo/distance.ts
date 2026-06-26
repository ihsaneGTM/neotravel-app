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

export interface RouteGeometry {
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  /** Tracé routier complet, en [lat, lon] (prêt pour Leaflet). */
  coords: [number, number][];
  distance_km: number;
  duration_min: number | null;
}

/**
 * Géométrie complète de l'itinéraire routier entre deux villes (pour la carte).
 * Géocodage Nominatim → tracé OSRM (overview=full). Repli ligne droite si OSRM échoue.
 */
export async function getRouteGeometry(villeDepart: string, villeArrivee: string): Promise<RouteGeometry | null> {
  try {
    const [a, b] = await Promise.all([geocode(villeDepart), geocode(villeArrivee)]);
    if (!a || !b) return null;
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const j = (await r.json()) as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
      const route = j.routes?.[0];
      const line = route?.geometry?.coordinates;
      if (route && Array.isArray(line) && line.length > 1) {
        return {
          start: a,
          end: b,
          coords: line.map(([lon, lat]) => [lat, lon] as [number, number]),
          distance_km: Math.round(route.distance / 1000),
          duration_min: Math.round(route.duration / 60),
        };
      }
    }
    // Repli : segment direct géocodé
    return { start: a, end: b, coords: [[a.lat, a.lon], [b.lat, b.lon]], distance_km: Math.round(haversineKm(a, b) * 1.3), duration_min: null };
  } catch {
    return null;
  }
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
