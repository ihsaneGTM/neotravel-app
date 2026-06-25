import { studioConfigured } from "@/lib/studio/config";
import { deploymentStatus } from "@/lib/studio/github";

export const maxDuration = 30;

export async function GET(req: Request) {
  const cfg = studioConfigured();
  if (!cfg.ok) return Response.json({ error: `Studio non configuré.` }, { status: 400 });
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) return Response.json({ error: "ref requis." }, { status: 400 });
  try {
    const res = await deploymentStatus(ref);
    return Response.json(res);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
