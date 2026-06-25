# Images de la landing — à générer (Nano Banana 2 / `gemini-3.1-flash-image-preview`)

Les fichiers `*.svg` de ce dossier sont des **placeholders soignés**. Remplace-les par tes images
en gardant **exactement le même nom de fichier** (ou passe en `.jpg`/`.webp` et mets à jour le `src` dans `app/page.tsx`).

Palette de marque à respecter dans les prompts : crème chaud `#f4eee2`, vert pin `#143a2f`, ambre `#d9912e`, ciel-menthe `#c5dcd5`.
Style cible : éditorial-voyage premium, lumière dorée, légère profondeur de champ, look magazine.

## Hero — monuments / scènes flottantes (PNG fond transparent idéalement, sinon cadrage carré/portrait)

- **float-paris.svg** (portrait 3:4) — « Tour Eiffel au coucher de soleil, ciel pêche et menthe, style éditorial premium, lumière dorée chaude, rendu photo-réaliste épuré, ambiance voyage haut de gamme »
- **float-coach.svg** (paysage 4:3) — « Autocar grand tourisme moderne haut de gamme vu de 3/4 avant, carrosserie sombre élégante, sur une route au lever du soleil, reflets dorés, photo publicitaire premium »
- **float-coast.svg** (paysage 4:3) — « Côte basque / Atlantique, plage et falaises, lumière dorée de fin de journée, ton chaud crème et vert menthe, photo de voyage éditoriale »
- **float-chateau.svg** (portrait 4:5) — « Château de la Loire au soleil couchant, pierre claire, ciel chaud, ambiance voyage culturel premium »

## Flotte (paysage 4:3, fond cohérent vert/crème)

- **fleet-minibus.svg** — « Minibus VIP 20 places moderne, 3/4 avant, finition premium, fond studio crème chaud »
- **fleet-minicar.svg** — « Minicar 33 places, 3/4 avant, design contemporain, fond crème »
- **fleet-autocar.svg** — « Autocar grand tourisme 55 places, 3/4 avant, carrosserie élégante, fond crème chaud »
- **fleet-decker.svg** — « Autocar double étage 90 places, 3/4 avant, imposant et moderne, fond crème »
- **fleet-berline.svg** — « Berline VTC noire haut de gamme type Mercedes Classe V / S, 3/4 avant, ambiance executive, fond sombre chaud »

> Pattern d'appel + clé API : voir `/Users/ihsane/Documents/Agents/AGENTS.md` (section Génération d'images).
> Régénérer les placeholders : `node scripts/gen-landing-placeholders.mjs`
