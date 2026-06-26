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
  "Rends l'accueil du chat plus chaleureux",
  "Sur le dashboard, mets la valeur pipeline en premier",
];
const ROUTES = ["/dashboard", "/", "/leads", "/workflow"];
const STORAGE = "nt-studio-v1";

const STEPS = [
  { label: "Analyse & génération du code" },
  { label: "Création de la branche" },
  { label: "Build de la preview Vercel" },
  { label: "Validation & merge sur main" },
];

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function StudioConsole({ configured, missing, prodUrl }: { configured: boolean; missing: string[]; prodUrl: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [deploy, setDeploy] = useState<{ state: DeployState; url: string | null }>({ state: "pending", url: null });
  const [route, setRoute] = useState("/dashboard");
  const [opStart, setOpStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [restored, setRestored] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restauration depuis localStorage (survit à la navigation) ───────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const s = JSON.parse(raw);
        setPrompt(s.prompt ?? "");
        setProposal(s.proposal ?? null);
        setBranch(s.branch ?? null);
        setOpStart(s.opStart ?? null);
        // Normalise les états in-flight non reprenables (le fetch a été coupé).
        if (s.stage === "proposing") { setStage("idle"); setError("Ta demande a été interrompue (page quittée). Relance-la."); }
        else if (s.stage === "creating") setStage("proposed");
        else if (s.stage === "merging") setStage("preview");
        else setStage(s.stage ?? "idle");
      }
    } catch { /* ignore */ }
    setRestored(true);
  }, []);

  // ── Sauvegarde à chaque changement ──────────────────────────────────────
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE, JSON.stringify({ stage, prompt, proposal, branch, opStart })); } catch { /* ignore */ }
  }, [restored, stage, prompt, proposal, branch, opStart]);

  // ── Minuteur (tant qu'une opération tourne) ─────────────────────────────
  const building = stage === "preview" && deploy.state !== "ready" && deploy.state !== "error";
  const inflight = stage === "proposing" || stage === "creating" || stage === "merging" || building;
  useEffect(() => {
    if (!inflight) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inflight]);

  // ── Poll du statut de la preview ────────────────────────────────────────
  useEffect(() => {
    if (stage !== "preview" || !branch) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/studio/status?ref=${encodeURIComponent(branch)}`);
        const j = await r.json();
        if (j.state) setDeploy({ state: j.state, url: j.url });
        if (j.state === "ready" || j.state === "error") { if (pollRef.current) clearInterval(pollRef.current); }
      } catch { /* retry */ }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, branch]);

  const reset = () => {
    setStage("idle"); setProposal(null); setBranch(null); setError(null); setDeploy({ state: "pending", url: null }); setOpStart(null);
    try { localStorage.removeItem(STORAGE); } catch { /* ignore */ }
  };

  async function propose() {
    if (!prompt.trim()) return;
    setStage("proposing"); setError(null); setOpStart(Date.now()); setNow(Date.now());
    try {
      const r = await fetch("/api/studio/propose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Échec de la proposition.");
      setProposal(j); setStage("proposed");
    } catch (e) { setError((e as Error).message); setStage("idle"); }
  }

  async function createPreview() {
    if (!proposal) return;
    setStage("creating"); setError(null); setOpStart(Date.now()); setNow(Date.now());
    try {
      const r = await fetch("/api/studio/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: proposal.summary, files: proposal.files.map((f) => ({ path: f.path, content: f.content })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Échec de création de la preview.");
      setBranch(j.branch); setDeploy({ state: "pending", url: null }); setStage("preview");
    } catch (e) { setError((e as Error).message); setStage("proposed"); }
  }

  async function merge() {
    if (!branch || !proposal) return;
    setStage("merging"); setError(null); setOpStart(Date.now()); setNow(Date.now());
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
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lime-soft)] text-[var(--forest)]"><Wand2 className="h-6 w-6" /></span>
        <h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">Studio à configurer</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Ajoute ces variables (.env.local + Vercel) puis redéploie :</p>
        <ul className="mt-3 inline-flex flex-col gap-1 text-left">{missing.map((m) => <li key={m} className="font-mono text-sm text-[var(--ink)]">• {m}</li>)}</ul>
      </div>
    );
  }

  const activeStep = stage === "proposing" ? 0 : stage === "proposed" ? 0 : stage === "creating" ? 1 : stage === "preview" ? 2 : stage === "merging" ? 3 : stage === "merged" ? 4 : -1;
  const stepState = (i: number): "done" | "active" | "error" | "pending" => {
    if (i === 2 && stage === "preview") return deploy.state === "ready" ? "done" : deploy.state === "error" ? "error" : "active";
    if (i < activeStep) return "done";
    if (i === activeStep) return inflight ? "active" : "done";
    return "pending";
  };
  const elapsed = opStart ? fmt(now - opStart) : "00:00";

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--terracotta-soft)] bg-[var(--terracotta-soft)] p-3 text-sm text-[var(--terracotta-ink)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Étape 1 — Demande */}
      <div className="nt-card p-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]"><Sparkles className="h-4 w-4 text-[var(--olive)]" /> Décrivez la modification souhaitée</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={stage !== "idle" && stage !== "proposed"} rows={3}
          placeholder="Ex. : passe l'accent de l'app au teal et arrondis davantage les cartes…"
          className="w-full resize-none rounded-xl border border-[var(--line)] bg-white p-3 text-sm outline-none focus:border-[var(--lime-deep)]" />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => <button key={ex} onClick={() => setPrompt(ex)} disabled={stage === "proposing"} className="rounded-full border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-1 text-xs text-[var(--muted)] transition hover:bg-[var(--grey)]">{ex}</button>)}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={propose} disabled={!prompt.trim() || stage === "proposing"} className="nt-press flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[#20231a] disabled:opacity-40">
            {stage === "proposing" ? <><Loader2 className="h-4 w-4 animate-spin" /> Claude code… {elapsed}</> : <><Wand2 className="h-4 w-4" /> Générer la proposition</>}
          </button>
        </div>
      </div>

      {/* Stepper de progression (persistant) */}
      {stage !== "idle" && (
        <div className="nt-card p-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ink)]">Progression</p>
            {inflight && <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {elapsed}</span>}
          </div>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((st, i) => {
              const s = stepState(i);
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    s === "done" ? "bg-[var(--lime)] text-[var(--ink)]" : s === "active" ? "bg-[var(--ink)] text-[var(--cream)]" : s === "error" ? "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]" : "bg-[var(--grey)] text-[var(--faint)]"
                  }`}>
                    {s === "done" ? <Check className="h-3.5 w-3.5" /> : s === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s === "error" ? <X className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-sm ${s === "active" ? "font-medium text-[var(--ink)]" : s === "pending" ? "text-[var(--faint)]" : "text-[var(--muted)]"}`}>{st.label}</span>
                  {s === "active" && <span className="ml-auto font-mono text-xs text-[var(--faint)]">{elapsed}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Étape 2 — Proposition */}
      {proposal && (stage === "proposed" || stage === "creating") && (
        <div className="nt-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-base font-semibold text-[var(--ink)]">{proposal.summary}</h3><p className="mt-1 text-sm text-[var(--muted)]">{proposal.explanation}</p></div>
            <span className="shrink-0 rounded-full bg-[var(--lime-soft)] px-2.5 py-1 text-xs font-medium text-[var(--forest)]">{proposal.files.length} fichier(s)</span>
          </div>
          <div className="mt-4 space-y-2">
            {proposal.files.map((f) => (
              <details key={f.path} className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/50">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--ink)]"><Code2 className="h-4 w-4 text-[var(--faint)]" /> {f.path}</summary>
                <div className="grid gap-2 border-t border-[var(--line)] p-3 md:grid-cols-2">
                  <CodeBox label="Avant" text={f.before} tone="rose" /><CodeBox label="Après" text={f.content} tone="emerald" />
                </div>
              </details>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={reset} className="nt-press rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg-soft)]">Annuler</button>
            <button onClick={createPreview} disabled={stage === "creating"} className="nt-press flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--cream)] hover:bg-[#20231a] disabled:opacity-50">
              {stage === "creating" ? <><Loader2 className="h-4 w-4 animate-spin" /> Création… {elapsed}</> : <><GitBranch className="h-4 w-4" /> Créer la preview</>}
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — Preview avant/après */}
      {(stage === "preview" || stage === "merging" || stage === "merged") && (
        <div className="nt-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><DeployBadge state={stage === "merged" ? "ready" : deploy.state} />{branch && <span className="font-mono text-xs text-[var(--faint)]">branche {branch}</span>}</div>
            <div className="flex items-center gap-2"><span className="text-xs text-[var(--faint)]">Page :</span>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs">{ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            </div>
          </div>
          {stage === "merged" ? (
            <div className="mt-4 rounded-xl bg-[var(--lime-soft)] p-4 text-center">
              <Check className="mx-auto h-6 w-6 text-[var(--forest)]" />
              <p className="mt-1 text-sm font-semibold text-[var(--forest)]">Modification mergée sur main 🎉</p>
              <p className="text-xs text-[var(--forest)]/80">La production se redéploie (~1 min). Rafraîchis ensuite pour voir le résultat.</p>
              <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--forest)] px-4 py-2 text-sm font-medium text-[var(--cream)]"><RefreshCw className="h-4 w-4" /> Nouvelle modification</button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Frame label="Avant (production)" src={prodUrl + route} />
                {deploy.state === "ready" && deploy.url ? <Frame label="Après (preview)" src={deploy.url + route} accent /> : (
                  <div className="grid h-[460px] place-items-center rounded-xl border border-dashed border-[var(--line-2)] bg-[var(--bg-soft)] text-center">
                    <div>
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--olive)]" />
                      <p className="mt-2 text-sm text-[var(--muted)]">{deploy.state === "error" ? "Le build de la preview a échoué." : "Vercel construit la preview…"}</p>
                      <p className="font-mono text-xs text-[var(--faint)]">{deploy.state === "error" ? "Le code proposé ne compile pas — merge bloqué." : elapsed}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={reset} className="nt-press rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--bg-soft)]">Abandonner</button>
                <button onClick={merge} disabled={deploy.state !== "ready" || stage === "merging"} title={deploy.state !== "ready" ? "Disponible une fois la preview construite" : undefined}
                  className="nt-press flex items-center gap-2 rounded-xl bg-[var(--forest)] px-5 py-2.5 text-sm font-medium text-[var(--cream)] transition hover:bg-[#20231a] disabled:opacity-40">
                  {stage === "merging" ? <><Loader2 className="h-4 w-4 animate-spin" /> Merge… {elapsed}</> : <><Check className="h-4 w-4" /> Valider & merger sur main</>}
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
    <div className={`overflow-hidden rounded-xl border ${accent ? "border-[var(--lime-deep)] ring-1 ring-[var(--lime-deep)]" : "border-[var(--line)]"}`}>
      <div className="flex items-center justify-between bg-[var(--bg-soft)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]"><span>{label}</span><a href={src} target="_blank" rel="noreferrer" className="text-[var(--faint)] hover:text-[var(--muted)]"><ExternalLink className="h-3.5 w-3.5" /></a></div>
      <iframe src={src} className="h-[460px] w-full bg-white" loading="lazy" />
    </div>
  );
}

function DeployBadge({ state }: { state: DeployState }) {
  const map = { pending: { t: "En attente", c: "bg-[var(--grey)] text-[var(--muted)]", spin: true }, building: { t: "Build en cours", c: "bg-[#f6ead0] text-[#8a5a1f]", spin: true }, ready: { t: "Preview prête", c: "bg-[var(--lime-soft)] text-[var(--forest)]", spin: false }, error: { t: "Build échoué", c: "bg-[var(--terracotta-soft)] text-[var(--terracotta-ink)]", spin: false } }[state];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.c}`}>{map.spin ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />} {map.t}</span>;
}

function CodeBox({ label, text, tone }: { label: string; text: string; tone: "rose" | "emerald" }) {
  return (
    <div>
      <p className={`mb-1 text-[0.65rem] font-semibold uppercase tracking-wide ${tone === "rose" ? "text-[var(--terracotta-ink)]" : "text-[var(--forest)]"}`}>{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--ink)] p-3 text-[0.7rem] leading-relaxed text-[var(--cream)]"><code>{text.slice(0, 4000)}</code></pre>
    </div>
  );
}
