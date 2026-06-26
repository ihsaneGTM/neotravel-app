"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, FileText, Sliders, Loader2, Check, TriangleAlert } from "lucide-react";
import { eur, eur2 } from "@/lib/ui/format";
import {
  computeDevisAjuste,
  SAISON_OPTIONS,
  ANTICIPATION_OPTIONS,
  CAPACITE_OPTIONS,
  CAPACITE_MAX,
  pct,
  type CoeffOption,
  type DevisAjusteParams,
} from "@/lib/pricing/devis-ajuste";
import { enregistrerDevisAjuste } from "@/app/commercial/actions";

export interface DevisEditorData {
  id: string;
  numero: string | null;
  dateDevis: string;
  client: { nom: string; email: string | null; telephone: string | null };
  trajet: string;
  typeLabel: string;
  dateDepart: string;
  dateRetour: string | null;
  nbVoyageurs: number;
  vehiculeLabel: string;
  /** Coefficients automatiques (base + saison/délai/capacité/marge/distance). */
  auto: DevisAjusteParams;
  /** Surcharges déjà enregistrées (réédition d'un devis existant). */
  initial?: { saison: number; anticipation: number; capacite: number; marge: number; remise_pct: number; remise_eur: number } | null;
  sent: boolean;
}

const labelDe = (opts: CoeffOption[], coeff: number) => opts.find((o) => o.coeff === coeff)?.libelle ?? pct(coeff);

const INCLUS = ["Frais de chauffeur", "Assurance responsabilité civile professionnelle", "Mise à disposition du véhicule"];
const A_CHARGE = ["Péages autoroutiers", "Parkings éventuels"];

/** Bouton d'ouverture + modal. Écoute aussi l'événement global `neotravel:open-devis`. */
export function DevisEditorButton(props: DevisEditorData) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("neotravel:open-devis", h);
    return () => window.removeEventListener("neotravel:open-devis", h);
  }, []);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="nt-press flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--lime-deep)] bg-[var(--lime-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--forest)] transition-colors hover:bg-[var(--lime)]"
      >
        <Sliders className="h-4 w-4" />
        {props.numero || props.initial ? "Modifier le devis" : "Générer le devis"}
      </button>
      {open && <DevisEditorModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function DevisEditorModal({ onClose, ...props }: DevisEditorData & { onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const init = props.initial;
  const [saison, setSaison] = useState(init?.saison ?? props.auto.saison);
  const [antic, setAntic] = useState(init?.anticipation ?? props.auto.anticipation);
  const [capacite, setCapacite] = useState(init?.capacite ?? props.auto.capacite);
  const [margePct, setMargePct] = useState(Math.round((init?.marge ?? props.auto.marge) * 100));
  const [remiseMode, setRemiseMode] = useState<"pct" | "eur">(init && init.remise_eur > 0 ? "eur" : "pct");
  const [remise, setRemise] = useState<number>(init ? (init.remise_eur > 0 ? init.remise_eur : init.remise_pct) : 0);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Au-delà du plafond matrice (85 pax), la capacité n'est pas tarifée automatiquement :
  // le commercial DOIT saisir le coefficient (cas hors matrice, ≥ +40 % conseillé).
  const horsMatrice = props.nbVoyageurs > CAPACITE_MAX;

  // Esc pour fermer
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const result = useMemo(
    () =>
      computeDevisAjuste({
        base: props.auto.base,
        distance_km: props.auto.distance_km,
        saison,
        anticipation: antic,
        capacite,
        marge: margePct / 100,
        tva: 0.1,
        remise_pct: remiseMode === "pct" ? remise : undefined,
        remise_eur: remiseMode === "eur" ? remise : undefined,
        labels: {
          saison: labelDe(SAISON_OPTIONS, saison),
          anticipation: labelDe(ANTICIPATION_OPTIONS, antic),
          capacite: labelDe(CAPACITE_OPTIONS, capacite),
        },
      }),
    [props.auto.base, props.auto.distance_km, saison, antic, capacite, margePct, remise, remiseMode]
  );

  const save = () =>
    startTransition(async () => {
      setErr(null);
      try {
        await enregistrerDevisAjuste({
          id: props.id,
          saison,
          anticipation: antic,
          capacite,
          marge: margePct / 100,
          remise_pct: remiseMode === "pct" ? remise : undefined,
          remise_eur: remiseMode === "eur" ? remise : undefined,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });

  if (!mounted) return null;

  return createPortal(
    <div className="nt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="nt-modal-card nt-card flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ink)] text-[var(--cream)]"><FileText className="h-4 w-4" /></span>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">Éditeur de devis</h2>
              <p className="text-xs text-[var(--faint)]">{props.numero ?? "N° attribué à l'envoi"} · {props.client.nom}</p>
            </div>
          </div>
          <button onClick={onClose} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-[var(--faint)] hover:bg-[var(--grey)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* ── Colonne contrôles ──────────────────────────────────────────── */}
          <div className="nt-scroll min-h-0 overflow-y-auto border-b border-[var(--line)] p-5 lg:border-b-0 lg:border-r">
            {props.sent && (
              <div className="mb-4 rounded-xl bg-[var(--lime-soft)] px-3 py-2 text-xs font-medium text-[var(--forest)]">
                Ce devis a déjà été envoyé. Enregistrer créera une nouvelle version (le client recevra l'éventuelle mise à jour au prochain envoi).
              </div>
            )}

            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-[var(--faint)]">Paramètres de tarification</p>
            <div className="space-y-3">
              <CoeffSelect label="Saisonnalité" value={saison} onChange={setSaison} options={SAISON_OPTIONS} />
              <CoeffSelect label="Délai demande / départ" value={antic} onChange={setAntic} options={ANTICIPATION_OPTIONS} />
              {horsMatrice ? (
                <ManualCapacite pax={props.nbVoyageurs} value={capacite} onChange={setCapacite} />
              ) : (
                <CoeffSelect label="Capacité" value={capacite} onChange={setCapacite} options={CAPACITE_OPTIONS} />
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">Marge commerciale</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={margePct}
                    min={0}
                    onChange={(e) => setMargePct(Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
                  />
                  <span className="text-sm text-[var(--faint)]">%</span>
                </div>
              </label>

              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">Remise personnalisée</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={remise || ""}
                    min={0}
                    placeholder="0"
                    onChange={(e) => setRemise(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
                  />
                  <div className="flex shrink-0 rounded-xl border border-[var(--line)] bg-white p-0.5">
                    {(["pct", "eur"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRemiseMode(mode)}
                        className={`nt-press rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${remiseMode === mode ? "bg-[var(--ink)] text-[var(--cream)]" : "text-[var(--muted)]"}`}
                      >
                        {mode === "pct" ? "%" : "€"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Décomposition */}
            <p className="mb-2 mt-5 text-[0.7rem] font-bold uppercase tracking-wide text-[var(--faint)]">Décomposition du prix</p>
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              {result.lignes.map((l, i) => {
                const remiseLine = l.montant < 0;
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 ? "bg-[var(--bg-soft)]" : ""}`}>
                    <span className="text-[var(--muted)]">{l.libelle}</span>
                    <span className={`tabular-nums font-medium ${remiseLine ? "text-[var(--terracotta-ink)]" : "text-[var(--ink)]"}`}>
                      {l.montant > 0 && i > 0 ? "+" : ""}{eur(l.montant)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-baseline justify-between rounded-xl bg-[var(--lime-soft)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--forest)]">Total TTC</span>
              <span className="text-2xl font-bold text-[var(--ink)]">{eur(result.prix_ttc)}</span>
            </div>

            {err && <p className="mt-3 rounded-lg bg-[var(--terracotta-soft)] px-3 py-2 text-xs text-[var(--terracotta-ink)]">{err}</p>}

            <button
              onClick={save}
              disabled={pending}
              className="nt-btn-lime nt-press mt-4 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</> : <><Check className="h-4 w-4" /> Enregistrer le devis</>}
            </button>
          </div>

          {/* ── Colonne aperçu (réplique fidèle du PDF envoyé) ─────────────── */}
          <div className="nt-scroll min-h-0 overflow-y-auto bg-[var(--bg-soft)] p-5">
            <DevisPaper {...props} prixTTC={result.prix_ttc} prixHT={result.prix_ht} tva={result.tva} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CoeffSelect({ label, value, onChange, options }: { label: string; value: number; onChange: (v: number) => void; options: CoeffOption[] }) {
  // La valeur courante peut ne pas être dans la liste (coeff personnalisé) → on l'ajoute.
  const known = options.some((o) => o.coeff === value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
      >
        {!known && <option value={value}>{pct(value)} (personnalisé)</option>}
        {options.map((o) => (
          <option key={o.coeff} value={o.coeff}>{o.libelle}</option>
        ))}
      </select>
    </label>
  );
}

/** Capacité hors matrice (> 85 pax) : coefficient saisi manuellement, mis en valeur. */
function ManualCapacite({ pax, value, onChange }: { pax: number; value: number; onChange: (v: number) => void }) {
  const pctValue = Math.round((value - 1) * 100);
  return (
    <div className="rounded-xl border-2 border-[var(--terracotta)] bg-[var(--terracotta-soft)] p-3">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--terracotta-ink)]">
        <TriangleAlert className="h-3.5 w-3.5" /> Capacité — cas hors matrice
      </span>
      <p className="mt-1 text-[0.72rem] leading-snug text-[var(--terracotta-ink)]">
        {pax} passagers (&gt; {CAPACITE_MAX}) : non tarifé automatiquement. Définissez le coefficient capacité (≥ +40 % conseillé, à votre appréciation).
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--terracotta-ink)]">+</span>
        <input
          type="number"
          value={pctValue}
          min={0}
          onChange={(e) => onChange(1 + Math.max(0, Number(e.target.value) || 0) / 100)}
          className="w-24 rounded-lg border border-[var(--terracotta)] bg-white px-3 py-2 text-sm font-semibold outline-none"
        />
        <span className="text-sm text-[var(--terracotta-ink)]">% (multi-véhicules)</span>
      </div>
    </div>
  );
}

/** Réplique HTML du PDF client (header, voyage, bandeau TTC, comprend / à charge). */
function DevisPaper(props: DevisEditorData & { prixTTC: number; prixHT: number; tva: number }) {
  const rows: [string, string][] = [
    ["Trajet", props.trajet],
    ["Type de déplacement", props.typeLabel],
    ["Date de départ", props.dateDepart],
    ...(props.dateRetour ? ([["Date de retour", props.dateRetour]] as [string, string][]) : []),
    ["Nombre de passagers", String(props.nbVoyageurs)],
    ["Véhicule", `1 × ${props.vehiculeLabel}`],
    ["Chauffeur", "1 chauffeur"],
  ];
  return (
    <div className="mx-auto max-w-[560px] rounded-xl bg-white p-7 text-[var(--ink)] shadow-[var(--sh-2)] ring-1 ring-[var(--line)]">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/neotravel-bus.png" alt="" className="h-9 w-auto" />
          <div className="leading-none">
            <div className="text-lg font-extrabold tracking-tight"><span>Neo</span><span style={{ color: "var(--forest)" }}>Travel</span></div>
            <div className="mt-1 text-[0.6rem] text-[var(--faint)]">Transport d&apos;autocars avec chauffeur</div>
          </div>
        </div>
        <div className="text-right text-[0.62rem] text-[var(--muted)]">
          <div>devis@neotravel.fr</div>
          <div>01 84 80 12 34</div>
          <div>Lun–ven · 9h–18h</div>
        </div>
      </div>
      <div className="my-3 h-[2.5px] rounded bg-[var(--lime)]" />

      <h3 className="text-center text-xl font-extrabold tracking-tight">DEVIS N° {props.numero ?? "—"}</h3>
      <p className="mt-1 text-center text-[0.65rem] text-[var(--faint)]">Valable 30 jours · sous réserve de disponibilité à la réservation</p>

      <div className="mt-5 flex justify-between">
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">À l&apos;attention de</p>
          <p className="mt-1 text-sm font-bold">{props.client.nom}</p>
          {props.client.email && <p className="text-xs text-[var(--muted)]">{props.client.email}</p>}
          {props.client.telephone && <p className="text-xs text-[var(--muted)]">{props.client.telephone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Établi le</p>
          <p className="mt-1 text-sm font-bold">{props.dateDevis}</p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-[var(--lime)] py-2 text-center text-xs font-bold uppercase tracking-widest text-[var(--ink)]">Votre voyage</div>
      <div className="mt-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-[0.8rem]">
            <span className="text-[var(--muted)]">{k}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--lime-deep)] bg-[var(--lime)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Tarif total TTC</p>
            <p className="mt-0.5 text-[0.62rem] text-[var(--forest)]">TVA 10 % incluse · transport réalisé en France</p>
          </div>
          <p className="text-3xl font-extrabold tabular-nums text-[var(--ink)]">{eur(props.prixTTC)}</p>
        </div>
        <p className="mt-1 text-right text-[0.6rem] text-[var(--forest)]">HT {eur2(props.prixHT)} · TVA {eur2(props.tva)}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Ce prix comprend</p>
          <ul className="mt-2 space-y-1">
            {INCLUS.map((t) => (
              <li key={t} className="flex items-start gap-1.5 text-[0.72rem] text-[var(--muted)]"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lime-deep)]" />{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Reste à votre charge</p>
          <ul className="mt-2 space-y-1">
            {A_CHARGE.map((t) => (
              <li key={t} className="flex items-start gap-1.5 text-[0.72rem] text-[var(--muted)]"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--terracotta)]" />{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
