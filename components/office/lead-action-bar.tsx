"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X, ChevronRight, Sparkles, Clock } from "lucide-react";
import type { Statut } from "@/lib/ui/statuts";
import { STATUT_LABEL } from "@/lib/ui/statuts";
import { leadAction } from "@/lib/pipeline/lead-action";
import { envoyerDevis, avancerStatut, modifierDemande } from "@/app/commercial/actions";

export interface LeadFields {
  ville_depart: string;
  ville_arrivee: string;
  etapes: string;
  distance_km: string;
  date_depart: string;
  date_retour: string;
  nb_voyageurs: number;
  type_deplacement: string;
  type_prestation: string;
  commentaire: string;
}

const TYPES_DEP: [string, string][] = [
  ["aller_simple", "Aller simple"],
  ["aller_retour", "Aller-retour"],
  ["circuit", "Circuit"],
];

export function LeadActionBar({
  id,
  statut,
  devisPret,
  relancesTotal = 0,
  relancesDues = 0,
  hasEmail,
  emailConfigure,
  email,
  fields,
}: {
  id: string;
  statut: Statut;
  devisPret: boolean;
  relancesTotal?: number;
  relancesDues?: number;
  hasEmail: boolean;
  emailConfigure: boolean;
  email: string | null;
  fields: LeadFields;
}) {
  const [edit, setEdit] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Portal vers <body> : indispensable car un ancêtre transformé (.nt-in) casserait position:fixed.
  useEffect(() => setMounted(true), []);
  const action = leadAction(statut, { devisPret, relancesTotal, relancesDues });

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Barre flottante : toujours visible, centrée en bas */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
        <div className="nt-card pointer-events-auto flex max-w-[680px] items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--sh-2)]">
          {/* Bloc gauche : qui doit agir + détail */}
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={
              action.owner === "commercial"
                ? { background: "var(--lime)", color: "var(--ink)" }
                : action.owner === "prospect"
                  ? { background: "var(--grey)", color: "var(--faint)" }
                  : { background: "var(--grey)", color: "var(--olive)" }
            }
          >
            {action.owner === "ia" ? <Sparkles className="h-4 w-4" /> : action.owner === "prospect" ? <Clock className="h-4 w-4" /> : <ChevronRight className="h-5 w-5" strokeWidth={2.4} />}
          </span>
          <div className="min-w-0 hidden sm:block">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--faint)]">
              {action.owner === "commercial" ? "Votre prochaine action" : action.owner === "prospect" ? "En attente du client" : "L'IA travaille"}
            </p>
            <p className="truncate text-sm font-medium text-[var(--ink)]">{action.label}</p>
          </div>

          <div className="mx-1 hidden h-8 w-px bg-[var(--line)] sm:block" />

          {/* CTA principal selon le propriétaire d'action */}
          <div className="flex items-center gap-2">
            {action.owner === "commercial" && action.ctaKind === "generer" && (
              <button onClick={() => window.dispatchEvent(new Event("neotravel:open-devis"))} className="nt-btn-lime nt-press px-4 py-2 text-sm">
                {action.cta}
              </button>
            )}

            {action.owner === "commercial" && action.ctaKind === "envoyer" && (
              hasEmail && emailConfigure ? (
                <form action={envoyerDevis}>
                  <input type="hidden" name="id" value={id} />
                  <button className="nt-press inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#20231a]">
                    {action.cta}
                  </button>
                </form>
              ) : (
                <span className="rounded-full bg-[var(--grey)] px-3 py-2 text-xs text-[var(--faint)]">
                  {!hasEmail ? "Aucun email client" : "Envoi non configuré"}
                </span>
              )
            )}

            {action.owner === "commercial" && action.ctaKind === "prendre" && (
              <StatutButton id={id} cible="qualified" label={action.cta ?? "Prendre en charge"} primary />
            )}

            {action.owner === "commercial" && action.ctaKind === "avancer" && (
              <div className="flex items-center gap-1.5">
                <StatutButton id={id} cible="won" label="Marquer gagné" primary />
                <StatutButton id={id} cible="lost" label="Perdu" />
              </div>
            )}

            {action.owner === "prospect" && (
              <div className="flex items-center gap-1.5">
                <span className="hidden text-sm text-[var(--muted)] sm:inline">Relances automatiques en cours</span>
                <StatutButton id={id} cible="won" label="Gagné" primary />
                <StatutButton id={id} cible="lost" label="Perdu" />
              </div>
            )}

            {action.owner === "ia" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime-soft)] px-3 py-2 text-sm font-semibold text-[var(--forest)]">
                <Sparkles className="h-4 w-4" /> Automatique
              </span>
            )}

            {action.owner === "done" && (
              <span className="rounded-full bg-[var(--grey)] px-3 py-2 text-sm font-semibold text-[var(--muted)]">{STATUT_LABEL[statut]}</span>
            )}

            {/* Modifier — toujours disponible */}
            <button
              onClick={() => setEdit(true)}
              className="nt-press inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              <Pencil className="h-4 w-4" /> Modifier
            </button>
          </div>
        </div>
      </div>

      {/* Panneau d'édition du lead */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(22,23,14,.4)] p-0 sm:items-center sm:p-6" onClick={() => setEdit(false)}>
          <div
            className="nt-card max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--ink)]">Modifier la demande</h2>
              <button onClick={() => setEdit(false)} className="nt-press grid h-8 w-8 place-items-center rounded-lg text-[var(--faint)] hover:bg-[var(--grey)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--faint)]">Corrigez les informations extraites par l'IA, ajustez le trajet et ajoutez une note.</p>

            <form action={modifierDemande} onSubmit={() => setEdit(false)} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville de départ" name="ville_depart" defaultValue={fields.ville_depart} required />
                <Field label="Ville d'arrivée" name="ville_arrivee" defaultValue={fields.ville_arrivee} />
                <div className="col-span-2">
                  <Field label="Étapes intermédiaires (séparées par des virgules)" name="etapes" defaultValue={fields.etapes} placeholder="ex. Lyon, Genève" />
                </div>
                <Field label="Distance (km)" name="distance_km" type="number" defaultValue={fields.distance_km} min={1} placeholder="auto si vide" />
                <Field label="Voyageurs" name="nb_voyageurs" type="number" defaultValue={String(fields.nb_voyageurs)} required min={1} />
                <Field label="Date de départ" name="date_depart" type="date" defaultValue={fields.date_depart} />
                <Field label="Date de retour" name="date_retour" type="date" defaultValue={fields.date_retour} />
                <Select label="Type de déplacement" name="type_deplacement" defaultValue={fields.type_deplacement} options={TYPES_DEP} />
                <Field label="Prestation" name="type_prestation" defaultValue={fields.type_prestation} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">Note / commentaire</label>
                <textarea
                  name="commentaire"
                  defaultValue={fields.commentaire}
                  rows={3}
                  placeholder="Précisions de l'appel, contraintes particulières, suivi…"
                  className="w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEdit(false)} className="nt-press rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)]">
                  Annuler
                </button>
                <button type="submit" className="nt-btn-lime nt-press px-5 py-2 text-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

function StatutButton({ id, cible, label, primary }: { id: string; cible: Statut; label: string; primary?: boolean }) {
  return (
    <form action={avancerStatut}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="statut" value={cible} />
      <button
        className={`nt-press rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
          primary ? "bg-[var(--lime)] text-[var(--ink)] hover:bg-[var(--lime-deep)]" : "border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--terracotta-ink)]"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function Field({ label, name, defaultValue, type = "text", required, min, placeholder }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean; min?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
      />
    </label>
  );
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--faint)]">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lime-deep)]"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
