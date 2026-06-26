"use client";

import { useEffect, useRef, useState } from "react";

/* Chargement unique de Leaflet via CDN (pas de dépendance npm). */
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
    script.async = true;
    script.onload = () => resolve((window as unknown as { L: unknown }).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletPromise;
}

interface Geo {
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  coords: [number, number][];
  distance_km: number;
  duration_min: number | null;
}

/** Carte d'itinéraire animée (style landing) — paramétrée par le trajet du lead. */
export function LeadRouteMap({ from, to }: { from: string; to: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // 1) récupère la géométrie de l'itinéraire (API serveur : géocodage + OSRM)
  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Geo) => {
        if (!alive) return;
        setGeo(j);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [from, to]);

  // 2) rend la carte Leaflet une fois la géométrie disponible
  useEffect(() => {
    if (!geo || !ref.current) return;
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;
    const ROUTE = geo.coords;

    loadLeaflet()
      .then((Lib) => {
        if (cancelled || !ref.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = Lib as any;
        map = L.map(ref.current, {
          zoomControl: false,
          attributionControl: true,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          touchZoom: false,
          tap: false,
          fadeAnimation: true,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }).addTo(map);

        // tracé : liseré encre + ligne lime animée
        L.polyline(ROUTE, { color: "#16170e", weight: 8, opacity: 0.45, lineCap: "round", lineJoin: "round" }).addTo(map);
        L.polyline(ROUTE, { color: "#bcd233", weight: 4.5, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: "1 12", className: "ntr-flow" }).addTo(map);

        const pin = (label: string, side: "start" | "end") =>
          L.divIcon({
            className: "",
            html: `<div class="ntr-pin ntr-pin-${side}"><span class="ntr-pin-label">${label}</span></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
        L.marker(ROUTE[0], { icon: pin(from, "start"), interactive: false }).addTo(map);
        L.marker(ROUTE[ROUTE.length - 1], { icon: pin(to, "end"), interactive: false }).addTo(map);

        const veh = L.marker(ROUTE[0], {
          icon: L.divIcon({ className: "", html: '<div class="ntr-veh"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);

        // longueurs cumulées → interpolation à vitesse constante
        const seg: number[] = [];
        let total = 0;
        for (let i = 1; i < ROUTE.length; i++) {
          const d = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]);
          seg.push(d);
          total += d;
        }
        const at = (t: number): [number, number] => {
          let d = t * total;
          for (let i = 0; i < seg.length; i++) {
            if (d <= seg[i]) {
              const r = seg[i] === 0 ? 0 : d / seg[i];
              return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * r, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * r];
            }
            d -= seg[i];
          }
          return ROUTE[ROUTE.length - 1];
        };

        const fit = () => {
          map.invalidateSize();
          map.fitBounds(ROUTE, { padding: [40, 40] });
        };
        fit();
        const onResize = () => fit();
        window.addEventListener("resize", onResize);
        map.__onResize = onResize;

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce) {
          const DUR = 7000;
          let start = 0;
          const tick = (now: number) => {
            if (cancelled) return;
            if (!start) start = now;
            const t = ((now - start) % DUR) / DUR;
            veh.setLatLng(at(t));
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      })
      .catch(() => {
        /* CDN Leaflet indisponible : on garde le panneau sans carte */
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (map) {
        if (map.__onResize) window.removeEventListener("resize", map.__onResize);
        map.remove();
      }
    };
  }, [geo, from, to]);

  if (state === "error") {
    return <p className="py-6 text-center text-sm text-[var(--faint)]">Itinéraire indisponible pour ce trajet.</p>;
  }

  return (
    <div className="ntr-frame">
      <div ref={ref} className="ntr-map" aria-label={`Itinéraire ${from} – ${to}`} role="img" />
      {state === "loading" && (
        <div className="absolute inset-0 z-[500] grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--muted)] shadow-sm">
            <span className="ntr-badge-dot" /> Calcul de l'itinéraire…
          </span>
        </div>
      )}
      {state === "ready" && (
        <>
          <div className="ntr-badge" aria-hidden>
            <span className="ntr-badge-dot" /> Itinéraire en direct
          </div>
          <div className="ntr-route-label" aria-hidden>
            {from} <span>→</span> {to}
            {geo && ` · ≈ ${geo.distance_km} km`}
            {geo?.duration_min ? ` · ${Math.floor(geo.duration_min / 60)}h${String(geo.duration_min % 60).padStart(2, "0")}` : ""}
          </div>
        </>
      )}
    </div>
  );
}
