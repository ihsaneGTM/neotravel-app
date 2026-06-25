"use client";

import { useEffect, useRef } from "react";

/* Chargement unique de Leaflet via CDN (évite d'ajouter une dépendance npm). */
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
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

/* Itinéraire Bordeaux → Paris (waypoints approximatifs le long de l'A10). */
const ROUTE: [number, number][] = [
  [44.8378, -0.5792], // Bordeaux
  [45.65, 0.16], // Angoulême
  [46.58, 0.34], // Poitiers
  [47.39, 0.69], // Tours
  [47.9, 1.9], // Orléans
  [48.8566, 2.3522], // Paris
];

export function RouteMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;

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
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }).addTo(map);

        // tracé : liseré sombre + ligne lime animée (lisible sur fond clair)
        L.polyline(ROUTE, { color: "#16170e", weight: 8, opacity: 0.45, lineCap: "round", lineJoin: "round" }).addTo(map);
        L.polyline(ROUTE, {
          color: "#bcd233",
          weight: 4.5,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          dashArray: "1 12",
          className: "rm-flow",
        }).addTo(map);

        const endIcon = (label: string, side: "start" | "end") =>
          L.divIcon({
            className: "",
            html: `<div class="rm-pin rm-pin-${side}"><span class="rm-pin-label">${label}</span></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
        L.marker(ROUTE[0], { icon: endIcon("Bordeaux", "start"), interactive: false }).addTo(map);
        L.marker(ROUTE[ROUTE.length - 1], { icon: endIcon("Paris", "end"), interactive: false }).addTo(map);

        // véhicule animé le long de l'itinéraire
        const veh = L.marker(ROUTE[0], {
          icon: L.divIcon({ className: "", html: '<div class="rm-veh"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);

        // longueurs cumulées pour interpoler à vitesse constante
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
          map.fitBounds(ROUTE, { padding: [44, 44] });
        };
        fit();
        const onResize = () => fit();
        window.addEventListener("resize", onResize);

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

        // nettoyage du listener resize au démontage
        map.__onResize = onResize;
      })
      .catch(() => {
        /* CDN indisponible → la carte reste vide, le reste de la page marche */
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (map) {
        if (map.__onResize) window.removeEventListener("resize", map.__onResize);
        map.remove();
      }
    };
  }, []);

  return (
    <div className="ap-map-frame">
      <div ref={ref} className="ap-map" aria-label="Carte de l'itinéraire Bordeaux–Paris" role="img" />
      <div className="rm-badge" aria-hidden>
        <span className="rm-badge-dot" /> Itinéraire en direct
      </div>
      <div className="rm-route-label" aria-hidden>
        Bordeaux <span>→</span> Paris · ≈ 582 km
      </div>
    </div>
  );
}
