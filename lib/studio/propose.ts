import "server-only";
import { EDITABLE_FILES, anthropicKey } from "./config";
import { getFile } from "./github";

export interface FileChange {
  path: string;
  before: string;
  content: string;
}
export interface Proposal {
  summary: string;
  explanation: string;
  files: FileChange[];
}

const SYSTEM = `Tu es un ingénieur frontend senior qui modifie l'application NeoTravel (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, design clair indigo).
On te donne le contenu ACTUEL d'un ensemble RESTREINT de fichiers éditables. Tu ne peux modifier QUE ces fichiers.
À partir de la demande de l'utilisateur, produis les fichiers modifiés (contenu COMPLET, pas un diff) en respectant strictement :
- le code doit COMPILER (TypeScript strict, Tailwind v4, imports valides) ;
- ne touche pas à la logique métier sensible (prix, sécurité) sauf si explicitement demandé ;
- garde le style et la cohérence visuelle ; modifications minimales et ciblées ;
- n'invente pas de nouveaux fichiers ni d'imports vers des paquets non installés.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
{"summary":"<résumé court FR>","explanation":"<ce que tu changes et pourquoi, FR, 2-3 phrases>","files":[{"path":"<chemin exact>","content":"<contenu complet du fichier modifié>"}]}
N'inclus dans "files" QUE les fichiers réellement modifiés.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Réponse IA non parsable (pas de JSON).");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function proposeChange(prompt: string): Promise<Proposal> {
  const key = anthropicKey();
  if (!key) throw new Error("Clé Anthropic manquante (STUDIO_API_KEY).");

  // Contenu actuel des fichiers éditables (lu via GitHub = source de vérité, prod-safe).
  const current = await Promise.all(
    EDITABLE_FILES.map(async (p) => ({ path: p, content: (await getFile(p)) ?? "" }))
  );
  const filesBlock = current
    .filter((f) => f.content)
    .map((f) => `=== FICHIER: ${f.path} ===\n${f.content}`)
    .join("\n\n");

  const userContent = `Demande de modification :\n"""${prompt}"""\n\nFichiers éditables (contenu actuel) :\n\n${filesBlock}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");

  const parsed = extractJson(text) as { summary?: string; explanation?: string; files?: { path: string; content: string }[] };
  const allowed = new Set(EDITABLE_FILES as readonly string[]);
  const files: FileChange[] = (parsed.files ?? [])
    .filter((f) => allowed.has(f.path) && typeof f.content === "string")
    .map((f) => ({ path: f.path, content: f.content, before: current.find((c) => c.path === f.path)?.content ?? "" }))
    .filter((f) => f.content.trim() && f.content !== f.before);

  if (!files.length) throw new Error("L'IA n'a proposé aucun changement applicable (périmètre éditable limité).");
  return { summary: parsed.summary ?? "Modification", explanation: parsed.explanation ?? "", files };
}
