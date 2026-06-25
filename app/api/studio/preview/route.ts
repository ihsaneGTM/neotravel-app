import { studioConfigured } from "@/lib/studio/config";
import { createBranchWithFiles } from "@/lib/studio/github";

export const maxDuration = 60;

export async function POST(req: Request) {
  const cfg = studioConfigured();
  if (!cfg.ok) return Response.json({ error: `Studio non configuré (${cfg.missing.join(", ")}).` }, { status: 400 });
  try {
    const { summary, files } = (await req.json()) as { summary?: string; files?: { path: string; content: string }[] };
    if (!files?.length) return Response.json({ error: "Aucun fichier à committer." }, { status: 400 });
    const branch = `studio/${Date.now().toString(36)}`;
    const message = `studio: ${summary ?? "modification via Studio"}`;
    const commitSha = await createBranchWithFiles(branch, files, message);
    return Response.json({ branch, commitSha });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
