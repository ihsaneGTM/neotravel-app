"use client";

import { useState } from "react";
import { openChat } from "./chat-launcher";

const VILLES = [
  "Paris", "Bordeaux", "Lyon", "Marseille", "Toulouse", "Nantes", "Lille", "Nice",
  "Strasbourg", "Montpellier", "Rennes", "Bayonne", "Biarritz", "La Rochelle",
  "Arcachon", "Pau", "Tours", "Angers", "Clermont-Ferrand", "Dijon", "Grenoble",
  "Bruxelles", "Genève", "Barcelone", "Londres", "Amsterdam", "Disneyland Paris",
];

function composeMessage(o: { depart: string; arrivee: string; stops: string[]; pax: string; date: string }) {
  const parts: string[] = ["Bonjour, je prépare un trajet en autocar pour mon groupe."];
  if (o.depart.trim()) parts.push(`Départ : ${o.depart.trim()}.`);
  if (o.arrivee.trim()) parts.push(`Arrivée : ${o.arrivee.trim()}.`);
  const stops = o.stops.map((s) => s.trim()).filter(Boolean);
  if (stops.length) parts.push(`Étapes intermédiaires : ${stops.join(", ")}.`);
  if (o.pax.trim()) parts.push(`Nombre de voyageurs : ${o.pax.trim()}.`);
  if (o.date.trim()) parts.push(`Date de départ souhaitée : ${o.date.trim()}.`);
  return parts.join(" ");
}

export function RoutePlanner() {
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [pax, setPax] = useState("");
  const [date, setDate] = useState("");

  const canSubmit = depart.trim() && arrivee.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    openChat(composeMessage({ depart, arrivee, stops, pax, date }));
  };

  return (
    <form className="lp-planner" onSubmit={submit}>
      <datalist id="lp-villes">
        {VILLES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="lp-planner-head">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Planifiez votre trajet de groupe
      </div>

      <div className="lp-stops">
        <div className="lp-field">
          <span className="lp-field-dot" aria-hidden />
          <label htmlFor="lp-depart">Départ</label>
          <input
            id="lp-depart"
            list="lp-villes"
            placeholder="ex. Bordeaux"
            value={depart}
            onChange={(e) => setDepart(e.target.value)}
            autoComplete="off"
          />
        </div>

        {stops.map((s, i) => (
          <div key={i}>
            <div className="lp-connector" />
            <div className="lp-field">
              <span className="lp-field-dot is-stop" aria-hidden />
              <label>Étape {i + 1}</label>
              <input
                list="lp-villes"
                placeholder="Ville intermédiaire"
                value={s}
                onChange={(e) => setStops(stops.map((x, j) => (j === i ? e.target.value : x)))}
                autoComplete="off"
              />
              <button
                type="button"
                className="lp-stop-remove"
                onClick={() => setStops(stops.filter((_, j) => j !== i))}
                aria-label="Retirer l'étape"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        <div>
          <div className="lp-connector" />
          <div className="lp-field">
            <span className="lp-field-dot is-end" aria-hidden />
            <label htmlFor="lp-arrivee">Arrivée</label>
            <input
              id="lp-arrivee"
              list="lp-villes"
              placeholder="ex. Paris"
              value={arrivee}
              onChange={(e) => setArrivee(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {stops.length < 4 && (
        <button type="button" className="lp-add-stop" onClick={() => setStops([...stops, ""])}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Ajouter une étape
        </button>
      )}

      <div className="lp-meta">
        <div className="lp-field">
          <span className="lp-field-dot is-stop" style={{ borderColor: "var(--green)", background: "transparent" }} aria-hidden />
          <label htmlFor="lp-pax">Voyageurs</label>
          <input id="lp-pax" type="number" min={1} placeholder="ex. 45" value={pax} onChange={(e) => setPax(e.target.value)} />
        </div>
        <div className="lp-field">
          <span className="lp-field-dot is-stop" style={{ borderColor: "var(--green)", background: "transparent" }} aria-hidden />
          <label htmlFor="lp-date">Date</label>
          <input id="lp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <button type="submit" className="lp-btn lp-btn-amber lp-planner-cta" disabled={!canSubmit}>
        Démarrer ma demande
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      <p className="lp-planner-foot">Gratuit et sans engagement · réponse d&apos;un conseiller sous 2 h</p>
    </form>
  );
}
