"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Wand2, GitBranch, Check, X, AlertTriangle, ArrowRight, RefreshCw, Code2, Loader2, ExternalLink,
} from "lucide-react";

type FileChange = { path: string; before: string; content: string };
type Proposal = { summary: string; explanation: string; files: FileChange[] };
type DeployState = "pending" | "building" | "ready" | "error";
type Stage = "idle" | "proposing" | "proposed" | "creating" | "preview" | "merging" | "merged";

const EXAMPLES = [
  "Passe l'accent de l'app du indigo au teal",
  "Renomme le KPI « Nouveaux leads » en « Leads entrants »",
  "Ajoute une formule de politesse plus chaleureuse au message d'accueil du chat",
  "Sur le dashboard, mets la valeur pipeline en premier",
];

const ROUTES = ["/dashboard", "/", "/leads", "/workflow"];

export function StudioConsole({ configured, missing, prodUrl }: { configured: boolean; missing: string[]; prodUrl: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [deploy, setDeploy] = useState<{ state: DeployState; url: string | null }>({ state: "pending", url: null });
  const [route, setRoute] = useState("/dashboard");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll du statut de déploiement de la preview
  useEffect(() => {
    if (stage !== "preview" || !branch) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/studio/status?ref=${encodeURIComponent(branch)}`);
        const j = await r.json();
        if (j.state) setDeploy({ state: j.state, url: j.url });
        if (j.state === "ready" || j.state === "error") { if (pollRef.current) clearInterval(pollRef.current); }
      } catch { /* on retente */ }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, branch]);

  const reset = () => { setStage("idle"); setProposal(null); setBranch(null); setError(null); setDeploy({ state: "pending", url: null }); };

  async function propose() {
    if (!prompt.trim()) return;
    setStage("proposing"); setError(null);
    try {
      const r = await fetch("/api/studio/propose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Échec de la proposition.");
      setProposal(j); setStage("proposed");
    } catch (e) { setError((e as Error).message); setStage("idle"); }
  }

  async function createPreview() {
    if (!proposal) return;
    setStage("creating"); setError(null);
    try {
      const r = await fetch("/api/studio/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: proposal.summary, files: proposal.files.map((f) => ({ path: f.path, content: f.content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Échec de création de la preview.");
      setBranch(j.branch); setStage("preview");
    } catch (e) { setError((e as Error).message); setStage("proposed"); }
  }

  async function merge() {
    if (!branch || !proposal) return;
    setStage("merging"); setError(null);
    try {
      const r = await fetch("/api/studio/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branch, summary: proposal.summary }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Échec du merge.");
      setStage("merged");
    } catch (e) { setError((e as Error).message); setStage("preview"); }
  }

  if (!configured) {
    return (
      <div className="nt-card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Wand2 className="h-6 w-6" /></span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Studio à configurer</h2>
        <p className="mt-2 text-sm text-slate-500">Ajoute ces variables d'environnement (.env.local + Vercel), puis redéploie :</p>
        <ul className="mt-3 inline-flex flex-col gap-1 text-left">
          {missing.map((m) => <li key={m} className="font-mono text-sm text-slate-700">• {m}</li>)}
        </ul>
        <p className="mt-3 text-xs text-slate-400">STUDIO_API_KEY = clé Anthropic (sk-ant-…) · GITHUB_TOKEN = PAT avec accès au repo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Étape 1 — Demande */}
      <div className="nt-card p-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-indigo-500" /> Décrivez la modification souhaitée</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={stage !== "idle" && stage !== "proposed"}
          rows={3}
          placeholder="Ex. : passe l'accent de l'app au teal et arrondis davantage les cartes du dashboard…"
          className="w-full resize-none rounded-xl border border-[var(--line)] bg-white p-3 text-sm outline-none focus:border-indigo-300"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} disabled={stage === "proposing"} className="rounded-full border border-[var(--line)] bg-slate-50 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100">{ex}</button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={propose} disabled={!prompt.trim() || stage === "proposing"} className="nt-press flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
            {stage === "proposing" ? <><Loader2 className="h-4 w-4 animate-spin" /> Claude code…</> : <><Wand2 className="h-4 w-4" /> Générer la proposition</>}
          </button>
        </div>
      </div>

      {/* Étape 2 — Proposition (diff) */}
      {proposal && (stage === "proposed" || stage === "creating") && (
        <div className="nt-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{proposal.summary}</h3>
              <p className="mt-1 text-sm text-slate-500">{proposal.explanation}</p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">{proposal.files.length} fichier(s)</span>
          </div>
          <div className="mt-4 space-y-2">
            {proposal.files.map((f) => (
              <details key={f.path} className="rounded-xl border border-[var(--line)] bg-slate-50/50">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700"><Code2 className="h-4 w-4 text-slate-400" /> {f.path}</summary>
                <div className="grid gap-2 border-t border-[var(--line)] p-3 md:grid-cols-2">
                  <CodeBox label="Avant" text={f.before} tone="rose" />
                  <CodeBox label="Après" text={f.content} tone="emerald" />
                </div>
              </details>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={reset} className="nt-press rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">Annuler</button>
            <button onClick={createPreview} disabled={stage === "creating"} className="nt-press flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {stage === "creating" ? <><Loader2 className="h-4 w-4 animate-spin" /> Création de la branche…</> : <><GitBranch className="h-4 w-4" /> Créer la preview</>}
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — Preview avant/après */}
      {(stage === "preview" || stage === "merging" || stage === "merged") && (
        <div className="nt-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DeployBadge state={stage === "merged" ? "ready" : deploy.state} />
              {branch && <span className="font-mono text-xs text-slate-400">branche {branch}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Page :</span>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs">
                {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {stage === "merged" ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
              <Check className="mx-auto h-6 w-6 text-emerald-600" />
              <p className="mt-1 text-sm font-semibold text-emerald-700">Modification mergée sur main 🎉</p>
              <p className="text-xs text-emerald-700/80">La production se redéploie (~1 min). Rafraîchis ensuite pour voir le résultat en live.</p>
              <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" /> Nouvelle modification</button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Frame label="Avant (production)" src={prodUrl + route} />
                {deploy.state === "ready" && deploy.url ? (
                  <Frame label="Après (preview)" src={deploy.url + route} accent />
                ) : (
                  <div className="grid h-[460px] place-items-center rounded-xl border border-dashed border-[var(--line-2)] bg-slate-50 text-center">
                    <div>
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                      <p className="mt-2 text-sm text-slate-500">{deploy.state === "error" ? "Le build de la preview a échoué." : "Vercel construit la preview…"}</p>
                      <p className="text-xs text-slate-400">{deploy.state === "error" ? "Le code proposé ne compile pas — merge bloqué." : "~1 min"}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={reset} className="nt-press rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">Abandonner</button>
                <button
                  onClick={merge}
                  disabled={deploy.state !== "ready" || stage === "merging"}
                  title={deploy.state !== "ready" ? "Disponible une fois la preview construite" : undefined}
                  className="nt-press flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {stage === "merging" ? <><Loader2 className="h-4 w-4 animate-spin" /> Merge en cours…</> : <><Check className="h-4 w-4" /> Valider & merger sur main</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Frame({ label, src, accent }: { label: string; src: string; accent?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border ${accent ? "border-indigo-300 ring-1 ring-indigo-200" : "border-[var(--line)]"}`}>
      <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
        <span>{label}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600"><ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      <iframe src={src} className="h-[460px] w-full bg-white" loading="lazy" />
    </div>
  );
}

function DeployBadge({ state }: { state: DeployState }) {
  const map = {
    pending: { t: "En attente", c: "bg-slate-100 text-slate-500", spin: true },
    building: { t: "Build en cours", c: "bg-amber-50 text-amber-600", spin: true },
    ready: { t: "Preview prête", c: "bg-emerald-50 text-emerald-700", spin: false },
    error: { t: "Build échoué", c: "bg-rose-50 text-rose-600", spin: false },
  }[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.c}`}>
      {map.spin ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />} {map.t}
    </span>
  );
}

function CodeBox({ label, text, tone }: { label: string; text: string; tone: "rose" | "emerald" }) {
  return (
    <div>
      <p className={`mb-1 text-[0.65rem] font-semibold uppercase tracking-wide ${tone === "rose" ? "text-rose-500" : "text-emerald-600"}`}>{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[0.7rem] leading-relaxed text-slate-200"><code>{text.slice(0, 4000)}</code></pre>
    </div>
  );
}
