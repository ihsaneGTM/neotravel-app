import "server-only";
import { GITHUB_REPO, githubToken } from "./config";

const API = "https://api.github.com";

function headers() {
  const token = githubToken();
  if (!token) throw new Error("GITHUB_TOKEN manquant : le Studio n'est pas configuré.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GitHub ${r.status} ${path}: ${body.slice(0, 300)}`);
  }
  return (await r.json()) as T;
}

/** Contenu actuel d'un fichier sur une branche (null si absent). */
export async function getFile(path: string, ref = "main"): Promise<string | null> {
  try {
    const data = await gh<{ content: string; encoding: string }>(
      `/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${ref}`
    );
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/** Crée une branche depuis main et y commit plusieurs fichiers (1 commit). Renvoie le SHA du commit. */
export async function createBranchWithFiles(
  branch: string,
  files: { path: string; content: string }[],
  message: string
): Promise<string> {
  const repo = `/repos/${GITHUB_REPO}`;
  const ref = await gh<{ object: { sha: string } }>(`${repo}/git/ref/heads/main`);
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(`${repo}/git/commits/${baseSha}`);

  const blobs = await Promise.all(
    files.map((f) => gh<{ sha: string }>(`${repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.content, encoding: "utf-8" }) }))
  );
  const tree = await gh<{ sha: string }>(`${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: files.map((f, i) => ({ path: f.path, mode: "100644", type: "blob", sha: blobs[i].sha })),
    }),
  });
  const commit = await gh<{ sha: string }>(`${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
  });
  await gh(`${repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) });
  return commit.sha;
}

export type DeployState = "pending" | "building" | "ready" | "error";

/** Statut du déploiement Vercel pour une branche (via les GitHub Deployments que Vercel publie). */
export async function deploymentStatus(ref: string): Promise<{ state: DeployState; url: string | null }> {
  const repo = `/repos/${GITHUB_REPO}`;
  const deps = await gh<{ id: number }[]>(`${repo}/deployments?ref=${encodeURIComponent(ref)}&per_page=1`);
  if (!deps.length) return { state: "pending", url: null };
  const statuses = await gh<{ state: string; environment_url?: string; target_url?: string }[]>(`${repo}/deployments/${deps[0].id}/statuses?per_page=1`);
  if (!statuses.length) return { state: "pending", url: null };
  const s = statuses[0];
  const url = s.environment_url || s.target_url || null;
  const map: Record<string, DeployState> = { success: "ready", failure: "error", error: "error", in_progress: "building", queued: "building", pending: "pending", inactive: "pending" };
  return { state: map[s.state] ?? "building", url };
}

/** Merge la branche dans main (déclenche un déploiement de production). */
export async function mergeToMain(branch: string, message: string): Promise<void> {
  await gh(`/repos/${GITHUB_REPO}/merges`, { method: "POST", body: JSON.stringify({ base: "main", head: branch, commit_message: message }) });
}
