"use client";

import { useMemo, useState } from "react";
import {
  calculerDevis,
  DevisError,
  MATRICES_DEFAUT,
  type DevisResult,
  type TypeDeplacement,
} from "@/lib/pricing/calculer-devis";

// ── Helpers d'affichage ──────────────────────────────────────────────────────
const M = MATRICES_DEFAUT;
const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

type Calc =
  | { ok: true; devis: DevisResult }
  | { ok: false; code: string; message: string };

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Simulateur() {
  const [type, setType] = useState<TypeDeplacement>("aller_retour");
  const [distance, setDistance] = useState(582);
  const [pax, setPax] = useState(27);
  const [dateDepart, setDateDepart] = useState(isoPlusDays(45));
  const [dateRetour, setDateRetour] = useState(isoPlusDays(47));
  const [depart, setDepart] = useState("Bordeaux");
  const [arrivee, setArrivee] = useState("Paris");
  const [geo, setGeo] = useState<{ source: string; loading: boolean } | null>(null);

  const calc: Calc = useMemo(() => {
    try {
      const devis = calculerDevis({
        type_deplacement: type,
        distance_km: distance,
        nb_passagers: pax,
        date_depart: dateDepart,
        date_demande: TODAY,
        date_retour: type === "aller_retour" ? dateRetour : undefined,
      });
      return { ok: true, devis };
    } catch (e) {
      if (e instanceof DevisError) return { ok: false, code: e.code, message: e.message };
      return { ok: false, code: "INCONNU", message: (e as Error).message };
    }
  }, [type, distance, pax, dateDepart, dateRetour]);

  const moisDepart = Number(dateDepart.slice(5, 7));
  const ecartJours = Math.round((new Date(dateDepart).getTime() - new Date(TODAY).getTime()) / 86_400_000);

  async function estimerDistance() {
    setGeo({ source: "", loading: true });
    try {
      const r = await fetch(`/api/distance?depart=${encodeURIComponent(depart)}&arrivee=${encodeURIComponent(arrivee)}`);
      const j = await r.json();
      if (typeof j.distance_km === "number") {
        setDistance(j.distance_km);
        setGeo({ source: j.source, loading: false });
      } else setGeo(null);
    } catch {
      setGeo(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--forest)]">NeoTravel · moteur de devis</p>
          <a href="/" className="text-sm font-medium text-[var(--forest)] underline underline-offset-2">
            ← Retour au chat
          </a>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">Simulateur tarifaire</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Le prix vient <strong>uniquement du code</strong> (fonction <code className="rounded bg-[var(--grey)] px-1 py-0.5 text-[0.8em]">calculerDevis()</code> déterministe,
          jamais du LLM). Réglez les paramètres : tout est recalculé en direct et chaque étape est tracée.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Panneau de réglages ───────────────────────────────────────── */}
        <section className="space-y-6 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
          {/* Type */}
          <Field label="Type de déplacement">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["aller_simple", "Aller simple"],
                ["aller_retour", "Aller-retour"],
                ["circuit", "Circuit"],
              ] as const).map(([v, lib]) => (
                <button
                  key={v}
                  onClick={() => setType(v)}
                  className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                    type === v ? "bg-[var(--ink)] text-[var(--cream)] shadow-sm" : "bg-[var(--grey)] text-[var(--muted)] hover:bg-[var(--line-2)]"
                  }`}
                >
                  {lib}
                </button>
              ))}
            </div>
          </Field>

          {/* Distance */}
          <Field label={`Distance (aller) — ${distance} km`}>
            <input
              type="range"
              min={5}
              max={900}
              step={1}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="w-full accent-[var(--forest)]"
            />
            <div className="mt-2 flex gap-2">
              <input
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                placeholder="Départ"
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
              />
              <input
                value={arrivee}
                onChange={(e) => setArrivee(e.target.value)}
                placeholder="Arrivée"
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
              />
              <button
                onClick={estimerDistance}
                disabled={geo?.loading}
                className="shrink-0 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] disabled:opacity-50"
              >
                {geo?.loading ? "…" : "Estimer"}
              </button>
            </div>
            {geo && !geo.loading && (
              <p className="mt-1 text-[0.7rem] text-[var(--muted)]">
                {distance} km — source&nbsp;: <span className="font-medium">{geo.source}</span>
              </p>
            )}
          </Field>

          {/* Passagers */}
          <Field label={`Nombre de passagers — ${pax}`}>
            <input
              type="range"
              min={1}
              max={95}
              step={1}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              className="w-full accent-[var(--forest)]"
            />
            {pax > M.capacite_max && (
              <p className="mt-1 text-[0.7rem] font-medium text-[#8a5a1f]">
                &gt; {M.capacite_max} passagers → multi-véhicules, flux manuel commercial.
              </p>
            )}
          </Field>

          {/* Dates */}
          <Field label="Date de départ">
            <input
              type="date"
              value={dateDepart}
              min={TODAY}
              onChange={(e) => setDateDepart(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-[0.7rem] text-[var(--muted)]">Dans {ecartJours} jours · demande émise le {TODAY}</p>
          </Field>

          {type === "aller_retour" && (
            <Field label="Date de retour">
              <input
                type="date"
                value={dateRetour}
                min={dateDepart}
                onChange={(e) => setDateRetour(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
              />
            </Field>
          )}
        </section>

        {/* ── Résultat ──────────────────────────────────────────────────── */}
        <section className="space-y-6">
          {calc.ok ? (
            <ResultatChiffre devis={calc.devis} />
          ) : (
            <FluxManuel code={calc.code} message={calc.message} />
          )}

          {/* Matrices de référence */}
          <div className="grid gap-4 md:grid-cols-2">
            <MatriceSaison moisActif={moisDepart} />
            <MatriceAnticipation ecart={ecartJours} actif={calc.ok} />
            <MatriceCapacite pax={pax} />
            <MatriceGrille distance={distance} />
          </div>
        </section>
      </div>
    </main>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

function ResultatChiffre({ devis }: { devis: DevisResult }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      {/* En-tête TTC */}
      <div className="flex flex-wrap items-end justify-between gap-4 bg-[var(--ink)] px-6 py-5 text-[var(--cream)]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cream)]">Estimation indicative TTC</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{eur(devis.prix_ttc)}</p>
        </div>
        <div className="text-right text-sm text-[var(--cream)]">
          <p>HT&nbsp;: {eur(devis.prix_ht)}</p>
          <p>TVA&nbsp;: {eur(devis.tva)}</p>
          <p className="mt-1 text-xs text-[var(--cream)]">
            {devis.meta.distance_km} km · {devis.meta.type_vehicule.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {/* Décomposition ligne à ligne */}
      <div className="px-6 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">Décomposition (audit)</p>
        <table className="w-full text-sm">
          <tbody>
            {devis.lignes.map((l, i) => {
              const fort = /Prix TTC|Prix HT|Sous-total/i.test(l.libelle);
              const neg = l.montant < 0;
              return (
                <tr key={i} className={fort ? "border-t border-[var(--line)] font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>
                  <td className="py-1.5 pr-4">{l.libelle}</td>
                  <td className={`py-1.5 text-right tabular-nums ${neg ? "text-[var(--forest)]" : ""}`}>
                    {neg ? "−" : ""}
                    {eur(Math.abs(l.montant))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Coefficients appliqués (chips) */}
        <div className="mt-4 flex flex-wrap gap-2">
          {devis.coefficients.map((c) => (
            <span
              key={c.nom}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--grey)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--muted)]"
            >
              {c.nom} ×{c.valeur}
              {c.detail ? <span className="text-[var(--faint)]">· {c.detail}</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FluxManuel({ code, message }: { code: string; message: string }) {
  return (
    <div className="rounded-2xl border border-[#e7d4a8] bg-[#f6ead0] p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a1f]">Pas d&apos;estimation automatique</p>
      <p className="mt-2 text-lg font-semibold text-[#6b4416]">Ce dossier part en flux manuel commercial</p>
      <p className="mt-1 text-sm text-[#7a4f1a]">{message}</p>
      <p className="mt-3 inline-block rounded-full bg-[#efdcb4] px-2.5 py-1 font-mono text-[0.7rem] text-[#8a5a1f]">{code}</p>
    </div>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">{titre}</p>
      {children}
    </div>
  );
}

function MatriceSaison({ moisActif }: { moisActif: number }) {
  return (
    <Carte titre="Coefficient saison (mois de départ)">
      <div className="grid grid-cols-6 gap-1.5">
        {MOIS.map((m, i) => {
          const mois = i + 1;
          const s = M.saison[mois];
          const actif = mois === moisActif;
          return (
            <div
              key={mois}
              className={`rounded-md px-1 py-1.5 text-center text-[0.7rem] ${
                actif ? "bg-[var(--ink)] text-[var(--cream)] shadow-sm ring-2 ring-[var(--lime-deep)]" : "bg-[var(--bg-soft)] text-[var(--muted)]"
              }`}
            >
              <div className="font-medium">{m}</div>
              <div className={actif ? "text-[var(--cream)]" : "text-[var(--faint)]"}>×{s.coeff}</div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

function MatriceAnticipation({ ecart, actif }: { ecart: number; actif: boolean }) {
  return (
    <Carte titre={`Anticipation (écart ${ecart} j)`}>
      <ul className="space-y-1">
        {M.anticipation.map((p) => {
          const hit = actif && ecart >= p.jours_min && (p.jours_max == null || ecart < p.jours_max);
          return (
            <li
              key={p.code}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                hit ? "bg-[var(--ink)] text-[var(--cream)]" : "bg-[var(--bg-soft)] text-[var(--muted)]"
              }`}
            >
              <span>{p.libelle}</span>
              <span className="font-medium tabular-nums">×{p.coeff}</span>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}

function MatriceCapacite({ pax }: { pax: number }) {
  return (
    <Carte titre={`Capacité (${pax} passagers)`}>
      <ul className="space-y-1">
        {M.capacite.map((p) => {
          const hit = pax >= p.pax_min && (p.pax_max == null || pax <= p.pax_max);
          return (
            <li
              key={p.libelle}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                hit ? "bg-[var(--ink)] text-[var(--cream)]" : "bg-[var(--bg-soft)] text-[var(--muted)]"
              }`}
            >
              <span>{p.libelle.replace(/\s*\([^)]*\)/, "")} · {p.type_vehicule.replace(/_/g, " ")}</span>
              <span className="font-medium tabular-nums">×{p.coeff}</span>
            </li>
          );
        })}
        {pax > M.capacite_max && (
          <li className="rounded-md bg-[#efdcb4] px-2 py-1.5 text-xs font-medium text-[#8a5a1f]">
            &gt; {M.capacite_max} → multi-véhicules (manuel)
          </li>
        )}
      </ul>
    </Carte>
  );
}

function MatriceGrille({ distance }: { distance: number }) {
  const auDela = distance > M.seuil_grille_km;
  const maxPrix = Math.max(...M.forfait.map((f) => f.prix));
  return (
    <Carte titre={`Base transfert simple ${auDela ? "(formule > 180 km)" : "(grille forfait)"}`}>
      {auDela ? (
        <div className="rounded-lg bg-[var(--bg-soft)] p-3 text-sm text-[var(--muted)]">
          <p className="font-mono text-[0.8rem]">
            ({distance} × 2) × {M.prix_km_au_dela} €/km
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{eur(distance * 2 * M.prix_km_au_dela)}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--faint)]">km aller + retour à vide · avant AR/coefficients</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {M.forfait.map((f) => {
            const hit = distance <= f.km_max && (M.forfait[M.forfait.indexOf(f) - 1]?.km_max ?? 0) < distance;
            return (
              <div key={f.km_max} className="flex items-center gap-2">
                <span className={`w-12 shrink-0 text-right text-[0.7rem] tabular-nums ${hit ? "font-semibold text-[var(--forest)]" : "text-[var(--faint)]"}`}>
                  ≤{f.km_max}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--grey)]">
                  <div
                    className={hit ? "h-full bg-[var(--forest)]" : "h-full bg-[var(--line-2)]"}
                    style={{ width: `${(f.prix / maxPrix) * 100}%` }}
                  />
                </div>
                <span className={`w-12 text-right text-[0.7rem] tabular-nums ${hit ? "font-semibold text-[var(--forest)]" : "text-[var(--faint)]"}`}>
                  {f.prix}€
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Carte>
  );
}
