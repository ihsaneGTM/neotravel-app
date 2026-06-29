/**
 * Seed de DÉMO NeoTravel — ~60 leads répartis sur 30 jours pour faire vivre le
 * dashboard (graphe d'activité, courbe pipeline, deltas, donut, relances, devis).
 *
 * 100% réversible : toutes les données portent le marqueur email @demo.neotravel.test.
 *   Seed   : node --env-file=.env.local scripts/seed-demo.mjs
 *   Purge  : node --env-file=.env.local scripts/purge-demo.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEMO_DOMAIN = "demo.neotravel.test";
const N = 60;

const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[rndi(0, arr.length - 1)];
const round10 = (n) => Math.round(n / 10) * 10;
const isoDate = (d) => d.toISOString().slice(0, 10);

const PRENOMS = ["Camille", "Lucas", "Inès", "Hugo", "Sarah", "Théo", "Léa", "Nathan", "Manon", "Yanis", "Chloé", "Adam", "Jade", "Maël", "Emma", "Noé", "Lina", "Gabriel", "Rania", "Sacha"];
const NOMS = ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Garcia", "Roux", "Vincent", "Fournier", "Girard", "Bonnet", "Lambert", "Faure", "Mercier", "Blanc", "Guerin", "Boyer", "Rousseau"];
const ROUTES = [
  { from: "Bordeaux", to: "Paris", km: 580 },
  { from: "Lyon", to: "Marseille", km: 315 },
  { from: "Lille", to: "Rennes", km: 560 },
  { from: "Paris", to: "Lyon", km: 460 },
  { from: "Toulouse", to: "Bordeaux", km: 245 },
  { from: "Nantes", to: "Paris", km: 385 },
  { from: "Nice", to: "Marseille", km: 200 },
  { from: "Strasbourg", to: "Paris", km: 490 },
  { from: "Bordeaux", to: "Arcachon", km: 60 },
  { from: "Paris", to: "Versailles", km: 25 },
  { from: "Lyon", to: "Chamonix", km: 220 },
  { from: "Rennes", to: "Saint-Malo", km: 70 },
];
const PRESTATIONS = ["transfert", "navette", "scolaire", "seminaire", "tourisme", "mise_a_disposition"];
const CANAUX = ["conversation_ia", "conversation_ia", "conversation_ia", "formulaire", "telephone", "email"];

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLong = (d) => `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const TYPE_TXT = { aller_simple: "un aller simple", aller_retour: "un aller-retour", circuit: "un circuit" };

/** Transcript IA ↔ prospect réaliste, dérivé des faits de la demande (démo Conversations + fiche). */
function buildTranscript({ prenom, from, to, presta, pax, typeDeplacement, depart, retour, rappel }) {
  const t = [];
  const a = (text) => t.push({ role: "assistant", text });
  const u = (text) => t.push({ role: "user", text });
  a("Bonjour 👋 Je suis l'assistant NeoTravel. Pour préparer votre devis de transport en autocar, dites-moi : quel est votre trajet ?");
  u(to ? `Bonjour, on aurait besoin d'un car de ${from} à ${to}.` : `Bonjour, on cherche un car au départ de ${from} pour une mise à disposition.`);
  a(`Très bien, ${to ? `${from} → ${to}` : from}. S'agit-il d'un aller simple, d'un aller-retour ou d'un circuit ?\n::choices:: Type de déplacement ? || Aller simple | Aller-retour | Circuit`);
  u(TYPE_TXT[typeDeplacement] ?? "un aller-retour");
  a("Parfait. Pour quelle date partez-vous, et à quelle heure ?");
  u(`Le ${dateLong(depart)}, vers 9h.`);
  if (retour) {
    a("Et la date de retour ?");
    u(`Retour le ${dateLong(retour)}.`);
  }
  a("Combien de voyageurs serez-vous ?");
  u(`Nous serons ${pax}.`);
  if (rappel) {
    a("Je note tout cela. Souhaitez-vous que je transmette à un conseiller ?");
    u("Oui, je préfère être rappelé par quelqu'un directement.");
    a("Bien sûr, un conseiller vous rappelle dans la journée. Je récupère vos coordonnées :\n::contact::");
  } else {
    a("Merci ! Il me reste vos coordonnées pour que le commercial vous envoie le devis :\n::contact::");
  }
  u(`${prenom} — coordonnées transmises ✅`);
  a(
    `Récapitulatif :\n- **Trajet** : ${to ? `${from} → ${to}` : `${from} (mise à disposition)`}\n- **Type** : ${(TYPE_TXT[typeDeplacement] ?? "aller-retour").replace("un ", "").replace("une ", "")}\n- **Départ** : ${dateLong(depart)} à 9h${retour ? `\n- **Retour** : ${dateLong(retour)}` : ""}\n- **Voyageurs** : ${pax}\n\nC'est bien noté ? Un commercial vous rappelle dans la journée avec votre devis.`
  );
  u("Oui c'est parfait, merci !");
  a("Votre demande est transmise 🚌 Un conseiller NeoTravel revient vers vous très vite. Belle journée !");
  return t;
}

// Funnel pondéré par ancienneté : récent → tôt dans le pipeline, ancien → abouti.
function statutFor(dayOffset) {
  if (dayOffset <= 5) return pick(["new", "new", "new", "qualified", "qualified", "contacted"]);
  if (dayOffset <= 15) return pick(["qualified", "contacted", "contacted", "quote_sent", "quote_sent", "negotiation"]);
  return pick(["quote_sent", "negotiation", "won", "won", "lost", "contacted"]);
}

function panierFor(km, pax) {
  const transport = km > 180 ? km * 2 * 2.5 : 250 + km * 3;
  const capFactor = pax <= 19 ? 0.95 : pax <= 53 ? 1.0 : pax <= 63 ? 1.15 : 1.3;
  return round10(transport * capFactor * 1.15 * 1.1); // marge + tva
}

const { data: comms } = await sb.from("commerciaux").select("id").eq("actif", true);
const commIds = (comms ?? []).map((c) => c.id);

let created = 0;
let devisCount = 0;
let relancesCount = 0;
let convCount = 0;
const now = Date.now();
let devSeq = 41000;

for (let i = 0; i < N; i++) {
  // Ancienneté biaisée vers le récent (delta hebdo positif + barres récentes pleines).
  const dayOffset = Math.floor(29 * Math.pow(Math.random(), 1.4));
  const createdAt = new Date(now - dayOffset * 86_400_000 - rndi(0, 23) * 3_600_000);
  const statut = statutFor(dayOffset);

  const route = pick(ROUTES);
  const presta = pick(PRESTATIONS);
  const isMAD = presta === "mise_a_disposition";
  const pax = rndi(8, 75);
  const typeDeplacement = isMAD ? pick(["aller_retour", "circuit"]) : pick(["aller_simple", "aller_retour", "aller_retour", "circuit"]);
  // ~15 % de demandes à départ imminent (≤ 6 j) → cas « Urgent » (priorité absolue).
  const urgent = Math.random() < 0.15;
  const depart = new Date(createdAt.getTime() + (urgent ? rndi(1, 6) : rndi(10, 90)) * 86_400_000);
  const retour = typeDeplacement === "aller_simple" ? null : new Date(depart.getTime() + rndi(1, 4) * 86_400_000);
  const panier = panierFor(route.km, pax);

  const prenom = pick(PRENOMS);
  const nom = pick(NOMS);
  const email = `${prenom}.${nom}.${i}@${DEMO_DOMAIN}`.toLowerCase();
  const canal = pick(CANAUX);
  const rappel = Math.random() < 0.08; // ~8 % réclament un rappel humain

  // 1) client
  const { data: cli, error: cliErr } = await sb
    .from("clients")
    .insert({ nom: `${prenom} ${nom}`, email, telephone: `06${rndi(10, 99)}${rndi(100000, 999999)}`, consentement_rgpd: true, created_at: createdAt.toISOString() })
    .select("id")
    .single();
  if (cliErr) {
    console.log("client ERR", cliErr.message);
    continue;
  }

  // 2) demande
  const { data: dem, error: demErr } = await sb
    .from("demandes")
    .insert({
      client_id: cli.id,
      commercial_id: statut === "new" ? null : commIds.length ? pick(commIds) : null,
      statut,
      type_deplacement: typeDeplacement,
      ville_depart: route.from,
      ville_arrivee: isMAD ? null : route.to,
      date_depart: isoDate(depart),
      date_retour: retour ? isoDate(retour) : null,
      nb_voyageurs: pax,
      type_prestation: presta,
      canal,
      // ~8 % de demandes où le prospect a réclamé un rappel humain (badge « Rappel demandé »).
      options: rappel ? ["contact_humain"] : [],
      complexite: "simple",
      distance_km: route.km,
      valeur_panier_estimee: panier,
      date_demande: isoDate(createdAt),
      created_at: createdAt.toISOString(),
    })
    .select("id")
    .single();
  if (demErr) {
    console.log("demande ERR", demErr.message);
    continue;
  }
  created++;

  // 2b) historique de statuts ANTIDATÉ — le trigger stampe changed_at=now() à
  // l'INSERT (faux pour la démo) ; on le remplace par une trajectoire réaliste
  // pour que le « temps dans l'étape » (SLA) varie vraiment d'un lead à l'autre.
  {
    const ORDER = ["new", "qualified", "contacted", "quote_sent", "negotiation", "won"];
    const path =
      statut === "lost"
        ? [...ORDER.slice(0, ORDER.indexOf(pick(["qualified", "contacted", "quote_sent"])) + 1), "lost"]
        : ORDER.slice(0, ORDER.indexOf(statut) + 1);
    const span = now - createdAt.getTime();
    // Le lead atteint sa colonne actuelle tôt dans sa vie (biais vers le début) ;
    // le reste = temps d'attente dans l'étape → variété fresh / en retard / dépassé.
    const settleAt = createdAt.getTime() + span * Math.min(0.85, Math.pow(Math.random(), 1.4) * 0.8);
    const rows = path.map((st, idx) => ({
      demande_id: dem.id,
      ancien_statut: idx === 0 ? null : path[idx - 1],
      nouveau_statut: st,
      changed_at: new Date(
        path.length === 1 ? createdAt.getTime() : createdAt.getTime() + (settleAt - createdAt.getTime()) * (idx / (path.length - 1))
      ).toISOString(),
      par: idx === 0 ? "system" : ["qualified", "contacted"].includes(st) ? "ia" : "system",
    }));
    await sb.from("statut_historique").delete().eq("demande_id", dem.id);
    await sb.from("statut_historique").insert(rows);
  }

  // 2c) conversation IA — pour les demandes captées via le chat (visible sur la fiche).
  if (canal === "conversation_ia") {
    const transcript = buildTranscript({
      prenom,
      from: route.from,
      to: isMAD ? null : route.to,
      presta,
      pax,
      typeDeplacement,
      depart,
      retour,
      rappel,
    });
    const convEnd = new Date(createdAt.getTime() + rndi(4, 18) * 60_000); // ~5-18 min d'échange
    const last = transcript[transcript.length - 1].text.split("\n")[0].slice(0, 120);
    const { error: convErr } = await sb.from("conversations").insert({
      id: randomUUID(),
      client_id: cli.id,
      demande_id: dem.id,
      statut: rappel ? "a_rappeler" : "terminee",
      complexite: "simple",
      transcript,
      dernier_message: last,
      nb_messages: transcript.length,
      created_at: createdAt.toISOString(),
      updated_at: convEnd.toISOString(),
    });
    if (convErr) console.log("conversation ERR", convErr.message);
    else convCount++;
  }

  // 3) devis (estimation pour les qualifiés/contactés ; ferme pour quote_sent+)
  const ht = Math.round((panier / 1.1) * 100) / 100;
  const tva = Math.round((panier - ht) * 100) / 100;
  const devisCreatedAt = new Date(createdAt.getTime() + rndi(1, 3) * 86_400_000);
  const mkLignes = () => [
    { libelle: "Transport", montant: round10(ht * 0.82) },
    { libelle: "Marge commerciale (+15%)", montant: round10(ht * 0.13) },
    { libelle: `TVA (10%)`, montant: tva },
  ];

  if (["qualified", "contacted"].includes(statut) && Math.random() < 0.6) {
    await sb.from("devis").insert({ demande_id: dem.id, type: "estimation", prix_ht: ht, tva, prix_ttc: panier, lignes: mkLignes(), masque: true, created_at: devisCreatedAt.toISOString() });
    devisCount++;
  }

  if (["quote_sent", "negotiation", "won"].includes(statut)) {
    const numero = `DEV-2026-${devSeq++}`;
    // quote_sent : 70% envoyés (avec relances), 30% prêts à envoyer (non envoyés)
    const sent = statut !== "quote_sent" || Math.random() < 0.7;
    const envoyeAt = sent ? new Date(devisCreatedAt.getTime() + rndi(0, 2) * 86_400_000) : null;
    const { data: dv } = await sb
      .from("devis")
      .insert({
        demande_id: dem.id,
        commercial_id: commIds.length ? pick(commIds) : null,
        type: "ferme",
        numero,
        prix_ht: ht,
        tva,
        prix_ttc: panier,
        lignes: mkLignes(),
        envoye_at: envoyeAt ? envoyeAt.toISOString() : null,
        destinataire: envoyeAt ? email : null,
        created_at: devisCreatedAt.toISOString(),
      })
      .select("id")
      .single();
    devisCount++;

    // 4) relances pour les devis envoyés (J+1/J+3/J+7), certaines en retard
    if (dv && envoyeAt) {
      for (const [n, type] of [[1, "j1"], [3, "j3"], [7, "j7"]]) {
        if (Math.random() < 0.7) {
          const due = new Date(envoyeAt.getTime() + n * 86_400_000);
          const isPast = due.getTime() < now;
          // garde quelques relances passées en "planifiée" (= en retard) pour le KPI
          const statutRel = isPast ? (Math.random() < 0.5 ? "envoyee" : "planifiee") : "planifiee";
          await sb.from("relances").insert({
            demande_id: dem.id,
            devis_id: dv.id,
            type,
            statut: statutRel,
            planifiee_pour: due.toISOString(),
            envoyee_at: statutRel === "envoyee" ? due.toISOString() : null,
            canal: "email",
            destinataire: email,
            objet: `Relance J+${n} — devis ${numero}`,
          });
          relancesCount++;
        }
      }
    }
  }

  if (i % 10 === 9) console.log(`… ${i + 1}/${N}`);
}

console.log(`\nSeed démo terminé : ${created} demandes, ${devisCount} devis, ${relancesCount} relances, ${convCount} conversations.`);
console.log(`Toutes marquées via email @${DEMO_DOMAIN} — purge : node --env-file=.env.local scripts/purge-demo.mjs`);
