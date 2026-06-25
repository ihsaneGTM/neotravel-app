import { studioConfigured } from "@/lib/studio/config";
import { proposeChange } from "@/lib/studio/propose";

export const maxDuration = 120;

export async function POST(req: Request) {
  const cfg = studioConfigured();
  if (!cfg.ok) return Response.json({ error: `Studio non configuré (${cfg.missing.join(", ")}).` }, { status: 400 });
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) return Response.json({ error: "Demande vide." }, { status: 400 });
    const proposal = await proposeChange(prompt.trim());
    return Response.json(proposal);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
