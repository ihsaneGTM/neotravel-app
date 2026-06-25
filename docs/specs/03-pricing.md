> **⚠️ MISE À JOUR (décision produit) :** le résultat de `calculer_devis()` n'est **jamais montré au prospect** dans le chat. Le mode *estimation* sert uniquement, en interne, de **score de panier pour l'attribution** ; le devis est établi et communiqué par le commercial. La logique de calcul ci-dessous reste valable telle quelle — seul change le fait qu'aucun montant n'est exposé côté lead.

Livrable terminé. Les 2 fichiers compilent et **les 20 tests vitest passent** (vérifié dans un projet jetable avec vitest+typescript).

## (1) Moteur — `/Users/ihsane/Documents/Agents/Neotravel/neotravel-app/lib/pricing/calculer-devis.ts`

- **Zéro appel LLM.** Fonction pure `calculerDevis(input, matrices = MATRICES_DEFAUT)`.
- **Interfaces TS** : `DevisInput`, `DevisResult` (`prix_ht`, `tva`, `prix_ttc`, `lignes[]`, `coefficients[]`, `devise:"EUR"`, + bloc `meta` audit : `type_vehicule`, `nb_jours`, `nuitees`, `distance_facturee_km`), `OptionDevis`, `PricingMatrices`.
- **Erreur structurée** : classe `DevisError` avec `code` typé : `PASSAGERS_INVALIDES | DATES_INVALIDES | DATES_INCOHERENTES | DATE_PASSEE | DISTANCE_INVALIDE | CAPACITE_DEPASSEE | HORS_ZONE` + `details`.
- **ORDRE respecté** : base distance (×2 AR, somme des étapes circuit, plancher `prix_minimum`) → ×saison → ×anticipation → ×capacité (multiplicatifs) → +options (guide ×nb_jours, nuit chauffeur ×nuitées, péages) → sous-total HT → +marge 15 % → **arrondi HT à l'euro** → TVA 10 % → TTC. Chaque étape pousse une ligne dans `lignes[]` et chaque coeff dans `coefficients[]`.
- **Déductions** : `nb_jours`/`nuitees` déduits des dates si absents ; mois → saison ; écart `date_demande`→`date_depart` → palier anticipation (bornes `[min, max[`, premier match) ; `nb_passagers` → palier capacité + `type_vehicule`.

## (2) Tests — `/Users/ihsane/Documents/Agents/Neotravel/neotravel-app/lib/pricing/calculer-devis.test.ts`

20 cas, calcul fait à la main en commentaire. Notamment :
- **CAS 0 — référence : 1480 HT / 148 TVA / 1628 TTC** (21 pax, AR 260 km, saison haute, >90j).
- Cas chiffrés : simple, minibus+plancher, plancher distance court, circuit 3 étapes + guide + nuit chauffeur (1684,10), nuit chauffeur séjour 2j, capacité 68-85 (+40 %), urgence <48h chiffrée (coeff prioritaire tracé), borne anticipation 2j, matrices injectées.
- Garde-fous (`expect throw` + assertion du `code`) : 0 pax, pax non entier, >85 pax, retour<départ, date passée, distance manquante, hors zone, date non parsable, circuit étape ≤0.

## (3) Note sur la représentation des matrices

`MATRICES_DEFAUT` est la **forme canonique** ; en production ces valeurs viennent de la table Supabase `matrices` et sont injectées via le 2ᵉ argument (lookup déterministe, testé au CAS 9).

- **Saison** : `Record<mois 1..12, {coeff, libelle}>` — lookup O(1) direct par mois, pas d'intervalle ambigu.
- **Anticipation & capacité** : tableaux de paliers ordonnés `{min, max(null=∞), coeff, libelle}`, résolus par *premier match* avec bornes **`[min, max[`** (basse incluse / haute exclue) → pas de chevauchement ni de trou aux frontières (ex. écart 2j = urgent, pas prioritaire).
- **Calibration** : `prix_par_km = 2,50 €`, `prix_minimum = 350 €`, `marge = 0,15`, `tva = 0,10`, `rayon_max_km = 1500`, options `guide 80 €/j` / `nuit 120 €` — calage exact sur le devis de référence 1628 €.
- **Mapping Supabase suggéré** : une ligne `matrices` par couple `(categorie, cle)` — ex. `('saison','3') → {coeff:1.10}`, `('anticipation','DD_URGENT') → {min:2,max:7,coeff:1.05}` — chargées en mémoire et reconstruites dans la forme `PricingMatrices` au démarrage de la requête. Les `peages` se prêtent à une table dédiée `(trajet → forfait)` plutôt qu'un forfait unique (actuellement `peages_forfait_defaut`, neutre par défaut).

**Note pour l'intégration agent** : le moteur *chiffre toujours* l'urgence <48h (coeff +10 % tracé) ; la règle métier « <48h ⇒ pas de devis auto / estimation masquée + escalade » se gère en amont dans l'orchestration (l'agent lit `meta`/`coefficients` et décide d'afficher ou masquer), conformément à la matrice des cas.