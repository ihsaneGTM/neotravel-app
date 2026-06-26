import { NextRequest, NextResponse } from "next/server";
import { getRouteGeometry } from "@/lib/geo/distance";

export const dynamic = "force-dynamic";

/**
 * Géométrie d'un itinéraire pour la carte du lead.
 * Multi-points : /api/route?from=Marseille&via=Berlin,Lyon&to=Madrid
 * (`via` = étapes intermédiaires séparées par des virgules, optionnel).
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const via = req.nextUrl.searchParams.get("via");
  if (!from || !to) return NextResponse.json({ error: "Paramètres from et to requis." }, { status: 400 });
  const etapes = (via ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const geo = await getRouteGeometry([from, ...etapes, to]);
  if (!geo) return NextResponse.json({ error: "Itinéraire indisponible." }, { status: 404 });
  // Cache 24h : un trajet ville→ville ne bouge pas.
  return NextResponse.json(geo, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
