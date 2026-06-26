import { estimerDistanceKm } from "@/lib/geo/distance";

export const maxDuration = 15;

/** GET /api/distance?depart=Bordeaux&arrivee=Paris&via=Lyon,Genève → { distance_km, source } */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const depart = searchParams.get("depart")?.trim();
  const arrivee = searchParams.get("arrivee")?.trim();
  const via = (searchParams.get("via") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!depart || !arrivee) {
    return Response.json({ error: "Paramètres « depart » et « arrivee » requis." }, { status: 400 });
  }
  const res = await estimerDistanceKm([depart, ...via, arrivee]);
  return Response.json(res);
}
