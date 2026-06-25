import "server-only";

/** Clé Anthropic du Studio (tolère plusieurs noms de variable). */
export function anthropicKey(): string {
  return process.env.STUDIO_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY || "";
}

/** Token GitHub (tolère plusieurs noms de variable). */
export function githubToken(): string {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || process.env.GITHUB_ACCESS_TOKEN || "";
}

/** Le Studio est-il configuré ? (clé Anthropic + token GitHub) */
export function studioConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!anthropicKey()) missing.push("STUDIO_API_KEY (ou ANTHROPIC_API_KEY)");
  if (!githubToken()) missing.push("GITHUB_TOKEN");
  return { ok: missing.length === 0, missing };
}

export const GITHUB_REPO = process.env.GITHUB_REPO || "ihsaneGTM/neotravel-app";

/** URL de production (pour le before/after). */
export const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://neotravel-app.vercel.app";

/**
 * Surface ÉDITABLE par le Studio (whitelist). L'IA ne peut modifier que ces fichiers.
 */
export const EDITABLE_FILES = [
  "app/globals.css",
  "app/(office)/dashboard/page.tsx",
  "app/page.tsx",
  "lib/ai/prompts.ts",
  "lib/ui/statuts.ts",
  "components/office/ui.tsx",
] as const;
