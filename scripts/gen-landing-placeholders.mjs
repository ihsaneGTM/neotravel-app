// Génère des placeholders SVG soignés pour la landing (à remplacer par de vraies images).
import { mkdir, writeFile } from "node:fs/promises";

const dir = new URL("../public/landing/", import.meta.url);
await mkdir(dir, { recursive: true });

const PALETTE = {
  cream: "#f4eee2",
  cream2: "#faf6ee",
  green: "#143a2f",
  green2: "#1d5042",
  amber: "#d9912e",
  amberSoft: "#f3d9a6",
  mint: "#c5dcd5",
  clay: "#c5613f",
};

function svg({ w, h, from, to, glow, label, sub, icon }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="s" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#s)"/>
  <rect width="${w}" height="${h}" filter="url(#n)" opacity="0.06"/>
  <g transform="translate(${w / 2},${h / 2 - 10})" fill="none" stroke="${PALETTE.cream2}" stroke-opacity="0.92" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    ${icon}
  </g>
  <text x="${w / 2}" y="${h - 26}" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="${PALETTE.cream2}" font-style="italic">${label}</text>
  ${sub ? `<text x="${w / 2}" y="${h - 9}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" letter-spacing="1.5" fill="${PALETTE.cream2}" opacity="0.7">${sub.toUpperCase()}</text>` : ""}
</svg>`;
}

const ICONS = {
  eiffel: `<path d="M0,-44 L-16,44 M0,-44 L16,44 M-11,12 L11,12 M-7,-12 L7,-12 M-13,30 L13,30"/>`,
  coach: `<rect x="-44" y="-22" width="88" height="40" rx="8"/><line x1="-30" y1="-22" x2="-30" y2="18"/><rect x="-22" y="-14" width="40" height="16" rx="3"/><circle cx="-22" cy="22" r="7"/><circle cx="22" cy="22" r="7"/>`,
  coast: `<path d="M-46,20 Q-23,-2 0,12 Q23,26 46,8"/><path d="M-46,30 Q-23,12 0,26 Q23,40 46,22"/><circle cx="26" cy="-22" r="11"/>`,
  chateau: `<path d="M-40,28 L-40,-8 L-28,-8 L-28,-20 L-20,-20 L-20,-8 L20,-8 L20,-20 L28,-20 L28,-8 L40,-8 L40,28 Z"/><path d="M-10,28 L-10,6 L10,6 L10,28"/>`,
  minibus: `<rect x="-40" y="-20" width="80" height="36" rx="9"/><rect x="-30" y="-12" width="26" height="14" rx="3"/><rect x="2" y="-12" width="26" height="14" rx="3"/><circle cx="-20" cy="20" r="6"/><circle cx="20" cy="20" r="6"/>`,
  berline: `<path d="M-44,12 L-30,12 L-22,-10 L18,-10 L30,12 L44,12"/><path d="M-30,12 L30,12"/><circle cx="-22" cy="16" r="7"/><circle cx="24" cy="16" r="7"/>`,
  decker: `<rect x="-44" y="-30" width="88" height="52" rx="8"/><line x1="-44" y1="-4" x2="44" y2="-4"/><circle cx="-24" cy="26" r="7"/><circle cx="24" cy="26" r="7"/>`,
};

const FILES = [
  // Monuments / scènes flottantes (hero)
  { name: "float-paris.svg", w: 376, h: 500, from: PALETTE.green, to: PALETTE.green2, glow: PALETTE.amber, label: "Paris", sub: "Tour Eiffel", icon: ICONS.eiffel },
  { name: "float-coach.svg", w: 420, h: 316, from: "#1f5244", to: "#0f2e26", glow: PALETTE.mint, label: "Autocar grand tourisme", sub: "Avec chauffeur", icon: ICONS.coach },
  { name: "float-coast.svg", w: 464, h: 336, from: "#2a6a5a", to: "#16463a", glow: PALETTE.amberSoft, label: "Côte Atlantique", sub: "Biarritz · Arcachon", icon: ICONS.coast },
  { name: "float-chateau.svg", w: 336, h: 420, from: PALETTE.clay, to: "#8f3f26", glow: PALETTE.amberSoft, label: "Châteaux", sub: "Val de Loire", icon: ICONS.chateau },
  // Flotte
  { name: "fleet-minibus.svg", w: 400, h: 300, from: "#2a6a5a", to: "#16463a", glow: PALETTE.mint, label: "Minibus", sub: "jusqu'à 25", icon: ICONS.minibus },
  { name: "fleet-minicar.svg", w: 400, h: 300, from: "#1f5244", to: "#0f2e26", glow: PALETTE.amberSoft, label: "Minicar", sub: "25 – 35", icon: ICONS.minibus },
  { name: "fleet-autocar.svg", w: 400, h: 300, from: PALETTE.green2, to: PALETTE.green, glow: PALETTE.amber, label: "Autocar", sub: "49 – 63", icon: ICONS.coach },
  { name: "fleet-decker.svg", w: 400, h: 300, from: "#1a4a3c", to: "#0c2820", glow: PALETTE.mint, label: "Double étage", sub: "jusqu'à 93", icon: ICONS.decker },
  { name: "fleet-berline.svg", w: 400, h: 300, from: PALETTE.clay, to: "#7a3520", glow: PALETTE.amberSoft, label: "Berline VTC", sub: "1 – 7 VIP", icon: ICONS.berline },
];

for (const f of FILES) {
  await writeFile(new URL(f.name, dir), svg(f));
}
console.log(`✓ ${FILES.length} placeholders générés dans public/landing/`);
