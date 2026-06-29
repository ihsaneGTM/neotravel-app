"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, PenLine, MessageCircleQuestion, Loader2, ShieldCheck } from "lucide-react";
import { eur } from "@/lib/ui/format";
import { signerDevis, demanderModification } from "@/app/devis/actions";

export interface DevisSignProps {
  devisId: string;
  numero: string | null;
  clientNom: string;
  clientEmail: string | null;
  clientTel: string | null;
  trajet: string;
  typeLabel: string;
  dateDepart: string;
  dateRetour: string | null;
  nbVoyageurs: number;
  vehiculeLabel: string;
  prixTTC: number;
  dateDevis: string;
  signed: boolean;
  enNegociation: boolean;
}

const INCLUS = ["Frais de chauffeur", "Assurance responsabilité civile professionnelle", "Mise à disposition du véhicule"];
const A_CHARGE = ["Péages autoroutiers", "Parkings éventuels"];

export function DevisSign(props: DevisSignProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"none" | "sign">("none");
  const [nom, setNom] = useState(props.clientNom === "Cher client" ? "" : props.clientNom);
  const [accept, setAccept] = useState(false);
  const [done, setDone] = useState<null | "signed" | "modif">(null);

  const etat = done ?? (props.signed ? "signed" : props.enNegociation ? "modif" : null);

  const sign = () =>
    startTransition(async () => {
      await signerDevis(props.devisId, nom);
      setDone("signed");
      router.refresh();
    });
  const modif = () =>
    startTransition(async () => {
      await demanderModification(props.devisId);
      setDone("modif");
      router.refresh();
    });

  const rows: [string, string][] = [
    ["Trajet", props.trajet],
    ["Type de déplacement", props.typeLabel],
    ["Date de départ", props.dateDepart],
    ...(props.dateRetour ? ([["Date de retour", props.dateRetour]] as [string, string][]) : []),
    ["Nombre de passagers", String(props.nbVoyageurs)],
    ["Véhicule", `1 × ${props.vehiculeLabel}`],
  ];

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-[640px]">
        {/* Document */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--sh-2)] ring-1 ring-[var(--line)]">
          <div className="flex items-start justify-between bg-[var(--ink)] px-7 py-5">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/neotravel-bus.png" alt="" className="h-9 w-auto" />
              <div className="leading-none">
                <div className="text-lg font-extrabold tracking-tight text-white">Neo<span style={{ color: "var(--lime)" }}>Travel</span></div>
                <div className="mt-1 text-[0.6rem] text-white/60">Transport d&apos;autocars avec chauffeur</div>
              </div>
            </div>
            <div className="text-right text-[0.62rem] text-white/70">
              <div>devis@neotravel.fr</div>
              <div>01 84 80 12 34</div>
            </div>
          </div>

          <div className="p-7 text-[var(--ink)]">
            <h1 className="text-center text-2xl font-extrabold tracking-tight">DEVIS N° {props.numero ?? "—"}</h1>
            <p className="mt-1 text-center text-xs text-[var(--faint)]">Valable 30 jours · sous réserve de disponibilité à la réservation</p>

            <div className="mt-5 flex justify-between">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">À l&apos;attention de</p>
                <p className="mt-1 text-sm font-bold">{props.clientNom}</p>
                {props.clientEmail && <p className="text-xs text-[var(--muted)]">{props.clientEmail}</p>}
                {props.clientTel && <p className="text-xs text-[var(--muted)]">{props.clientTel}</p>}
              </div>
              <div className="text-right">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Établi le</p>
                <p className="mt-1 text-sm font-bold">{props.dateDevis}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-[var(--lime)] py-2 text-center text-xs font-bold uppercase tracking-widest">Votre voyage</div>
            <div className="mt-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-[var(--line)] py-2 text-sm">
                  <span className="text-[var(--muted)]">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[var(--lime-deep)] bg-[var(--lime)] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Tarif total TTC</p>
                  <p className="mt-0.5 text-[0.62rem] text-[var(--forest)]">TVA 10 % incluse · transport réalisé en France</p>
                </div>
                <p className="text-3xl font-extrabold tabular-nums">{eur(props.prixTTC)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-5">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Ce prix comprend</p>
                <ul className="mt-2 space-y-1">
                  {INCLUS.map((t) => <li key={t} className="flex items-start gap-1.5 text-[0.72rem] text-[var(--muted)]"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lime-deep)]" />{t}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--forest)]">Reste à votre charge</p>
                <ul className="mt-2 space-y-1">
                  {A_CHARGE.map((t) => <li key={t} className="flex items-start gap-1.5 text-[0.72rem] text-[var(--muted)]"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--terracotta)]" />{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau de signature / actions */}
        <div className="mt-5 rounded-2xl bg-white p-6 shadow-[var(--sh-2)] ring-1 ring-[var(--line)]">
          {etat === "signed" ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--lime-soft)]"><CircleCheck className="h-7 w-7 text-[var(--forest)]" /></span>
              <h2 className="mt-3 text-xl font-bold text-[var(--ink)]">Devis accepté — merci !</h2>
              <p className="mt-1 max-w-md text-sm text-[var(--muted)]">Votre acceptation est bien enregistrée. Votre conseiller NeoTravel vous contacte sous peu pour finaliser la réservation.</p>
            </div>
          ) : etat === "modif" ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--grey)]"><MessageCircleQuestion className="h-7 w-7 text-[var(--olive)]" /></span>
              <h2 className="mt-3 text-xl font-bold text-[var(--ink)]">Demande transmise</h2>
              <p className="mt-1 max-w-md text-sm text-[var(--muted)]">Votre conseiller NeoTravel a été prévenu et vous rappelle très vite pour ajuster votre devis.</p>
            </div>
          ) : mode === "sign" ? (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]"><PenLine className="h-5 w-5" /> Signer le devis</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Saisissez votre nom pour valoir signature et acceptation de ce devis.</p>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom et prénom"
                className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
              />
              <label className="mt-3 flex items-start gap-2 text-sm text-[var(--muted)]">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--lime-deep)]" />
                <span>J&apos;accepte ce devis ({eur(props.prixTTC)} TTC) et ses conditions.</span>
              </label>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setMode("none")} className="nt-press rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--muted)]">Retour</button>
                <button
                  onClick={sign}
                  disabled={!nom.trim() || !accept || pending}
                  className="nt-press inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#20231a] disabled:opacity-50"
                >
                  {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signature…</> : <><ShieldCheck className="h-4 w-4" /> Je signe le devis</>}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-center text-sm text-[var(--muted)]">Ce devis vous convient ? Acceptez-le en ligne, ou demandez un ajustement.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setMode("sign")}
                  className="nt-press inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--lime-deep)]"
                >
                  <PenLine className="h-4 w-4" /> Signer le devis
                </button>
                <button
                  onClick={modif}
                  disabled={pending}
                  className="nt-press inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />} Demander une modification
                </button>
              </div>
            </div>
          )}
          <p className="mt-4 text-center text-[0.66rem] text-[var(--faint)]">NeoTravel · devis@neotravel.fr · 01 84 80 12 34</p>
        </div>
      </div>
    </main>
  );
}
