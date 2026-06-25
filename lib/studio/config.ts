import "server-only";

/** Le Studio est-il configuré ? (clé Anthropic + token GitHub) */
export function studioConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.STUDIO_API_KEY) missing.push("STUDIO_API_KEY");
  if (!process.env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  return { ok: missing.length === 0, missing };
}

export const GITHUB_REPO = process.env.GITHUB_REPO || "ihsaneGTM/neotravel-app";

/** URL de production (pour le before/after). */
export const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://neotravel-app-fefd.vercel.app";

/**
 * Surface ÉDITABLE par le Studio (whitelist). L'IA ne peut modifier que ces fichiers.
 * Choisi pour rester sûr (aucun secret/infra) et fiable (périmètre borné).
 */
export const EDITABLE_FILES = [
  "app/globals.css",
  "app/(office)/dashboard/page.tsx",
  "app/page.tsx",
  "lib/ai/prompts.ts",
  "lib/ui/statuts.ts",
  "components/office/ui.tsx",
] as const;
