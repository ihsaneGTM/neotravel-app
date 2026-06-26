import { NextRequest, NextResponse } from "next/server";
import { getRouteGeometry } from "@/lib/geo/distance";

export const dynamic = "force-dynamic";

/** Géométrie d'un itinéraire pour la carte du lead : /api/route?from=Lille&to=Rennes */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "Paramètres from et to requis." }, { status: 400 });
  const geo = await getRouteGeometry(from, to);
  if (!geo) return NextResponse.json({ error: "Itinéraire indisponible." }, { status: 404 });
  // Cache 24h : un trajet ville→ville ne bouge pas.
  return NextResponse.json(geo, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
