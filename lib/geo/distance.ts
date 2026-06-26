/**
 * Estimation de la distance routière entre plusieurs villes (départ → étapes → arrivée).
 *
 * Géocodage via OpenStreetMap Nominatim, puis distance routière réelle via OSRM
 * (serveur public, sans clé) en une requête multi-points. Repli haversine × 1.3
 * (facteur route) si OSRM échoue, puis valeur par défaut en dernier recours.
 *
 * Important : on ne force PAS « , France » dans le géocodage — c'était la cause de
 * villes étrangères mal placées (« Madrid » résolu en France) et de distances
 * impossibles à l'international. On laisse Nominatim désambiguïser par importance,
 * avec une préférence linguistique FR.
 */

interface Coord {
  lat: number;
  lon: number;
}

const UA = { "User-Agent": "NeoTravel-devis/1.0 (atelier MBA)" } as const;

async function geocode(ville: string): Promise<Coord | null> {
  const q = ville.trim();
  if (!q) return null;
  // Pas de suffixe pays : Nominatim classe par importance (Madrid → Espagne,
  // Marseille → France…). accept-language=fr pour des libellés cohérents.
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=fr`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = (await r.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(j) || j.length === 0) return null;
  return { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
}

/** Géocode une liste de villes en parallèle (null pour celles introuvables). */
async function geocodeMany(villes: string[]): Promise<(Coord | null)[]> {
  return Promise.all(villes.map(geocode));
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distance haversine cumulée le long d'une séquence de points (repli sans OSRM). */
function haversineChainKm(coords: Coord[]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i++) km += haversineKm(coords[i - 1], coords[i]);
  return km;
}

/** Chaîne OSRM `lon,lat;lon,lat;…` pour une requête multi-points. */
const osrmCoords = (coords: Coord[]) => coords.map((c) => `${c.lon},${c.lat}`).join(";");

export interface DistanceEstimee {
  distance_km: number;
  source: "osrm" | "haversine" | "defaut";
}

export interface RouteGeometry {
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  /** Coordonnées de chaque arrêt (départ, étapes, arrivée) pour les marqueurs. */
  stops: { lat: number; lon: number }[];
  /** Tracé routier complet, en [lat, lon] (prêt pour Leaflet). */
  coords: [number, number][];
  distance_km: number;
  duration_min: number | null;
}

/**
 * Géométrie complète de l'itinéraire routier passant par toutes les villes
 * (pour la carte). Géocodage Nominatim → tracé OSRM multi-points (overview=full).
 * Repli segments directs si OSRM échoue.
 */
export async function getRouteGeometry(villes: string[]): Promise<RouteGeometry | null> {
  try {
    const pts = villes.map((v) => v?.trim()).filter(Boolean) as string[];
    if (pts.length < 2) return null;
    const geo = await geocodeMany(pts);
    const coords = geo.filter((c): c is Coord => !!c);
    if (coords.length < 2) return null;

    const stops = coords.map((c) => ({ lat: c.lat, lon: c.lon }));
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords(coords)}?overview=full&geometries=geojson`;
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const j = (await r.json()) as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
      const route = j.routes?.[0];
      const line = route?.geometry?.coordinates;
      if (route && Array.isArray(line) && line.length > 1) {
        return {
          start: coords[0],
          end: coords[coords.length - 1],
          stops,
          coords: line.map(([lon, lat]) => [lat, lon] as [number, number]),
          distance_km: Math.round(route.distance / 1000),
          duration_min: Math.round(route.duration / 60),
        };
      }
    }
    // Repli : segments directs entre arrêts géocodés
    return {
      start: coords[0],
      end: coords[coords.length - 1],
      stops,
      coords: coords.map((c) => [c.lat, c.lon] as [number, number]),
      distance_km: Math.round(haversineChainKm(coords) * 1.3),
      duration_min: null,
    };
  } catch {
    return null;
  }
}

/**
 * Distance routière (km) d'un trajet départ → étapes → arrivée.
 * Accepte 2 villes ou plus ; OSRM gère le multi-points en une requête.
 */
export async function estimerDistanceKm(villes: string[]): Promise<DistanceEstimee> {
  try {
    const pts = villes.map((v) => v?.trim()).filter(Boolean) as string[];
    if (pts.length >= 2) {
      const geo = await geocodeMany(pts);
      const coords = geo.filter((c): c is Coord => !!c);
      if (coords.length >= 2) {
        const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords(coords)}?overview=false`;
        const r = await fetch(url, { headers: UA });
        if (r.ok) {
          const j = (await r.json()) as { routes?: Array<{ distance: number }> };
          const d = j.routes?.[0]?.distance;
          if (typeof d === "number" && d > 0) return { distance_km: Math.round(d / 1000), source: "osrm" };
        }
        return { distance_km: Math.round(haversineChainKm(coords) * 1.3), source: "haversine" };
      }
    }
  } catch {
    /* repli ci-dessous */
  }
  return { distance_km: 120, source: "defaut" };
}
