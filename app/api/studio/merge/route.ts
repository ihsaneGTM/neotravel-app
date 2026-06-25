import { studioConfigured } from "@/lib/studio/config";
import { mergeToMain } from "@/lib/studio/github";

export const maxDuration = 30;

export async function POST(req: Request) {
  const cfg = studioConfigured();
  if (!cfg.ok) return Response.json({ error: `Studio non configuré.` }, { status: 400 });
  try {
    const { branch, summary } = (await req.json()) as { branch?: string; summary?: string };
    if (!branch) return Response.json({ error: "branch requis." }, { status: 400 });
    await mergeToMain(branch, `studio: ${summary ?? "validation"} (merge ${branch})`);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
