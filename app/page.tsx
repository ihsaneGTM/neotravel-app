import "@/components/landing/landing.css";
import Image from "next/image";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { RoutePlanner } from "@/components/landing/route-planner";
import { ChatProvider, OpenChatButton } from "@/components/landing/chat-launcher";
import { Reveal, Counter, ScrollNav, ParallaxLayer, Faq } from "@/components/landing/motion";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display-fraunces", display: "swap", style: ["normal", "italic"] });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body-hanken", display: "swap" });

const FLOATS = [
  { src: "/landing/float-paris.svg", tag: "Paris", cls: "lp-float-a", strength: 22 },
  { src: "/landing/float-coach.svg", tag: "Grand tourisme", cls: "lp-float-b", strength: 14 },
  { src: "/landing/float-coast.svg", tag: "Côte Atlantique", cls: "lp-float-c", strength: 18 },
  { src: "/landing/float-chateau.svg", tag: "Val de Loire", cls: "lp-float-d", strength: 26 },
];

const FLEET = [
  { src: "/landing/fleet-minibus.svg", name: "Minibus", cap: "≤ 25", use: "Navettes, petits groupes, transferts aéroport." },
  { src: "/landing/fleet-minicar.svg", name: "Minicar", cap: "25–35", use: "Excursions, sorties loisirs, voyages scolaires." },
  { src: "/landing/fleet-autocar.svg", name: "Autocar", cap: "49–63", use: "Séminaires, événements d'entreprise, longues distances." },
  { src: "/landing/fleet-decker.svg", name: "Double étage", cap: "≤ 93", use: "Grands groupes, voyages scolaires, événements." },
  { src: "/landing/fleet-berline.svg", name: "Berline VTC", cap: "1–7", use: "Transport dirigeants, transferts premium VIP." },
];

const SEGMENTS = [
  "Entreprises", "Comités d'entreprise", "BDE & associations étudiantes", "Séminaires",
  "Sorties scolaires", "Événementiel", "Navettes aéroport", "Tourisme & excursions",
];

const STEPS = [
  { t: "Décrivez votre trajet", d: "Type de déplacement, villes, étapes, dates et nombre de voyageurs — en quelques mots, via notre assistant." },
  { t: "Un conseiller vous rappelle", d: "Il valide vos contraintes, horaires et le véhicule idéal. Réponse sous 2 h en journée." },
  { t: "Recevez votre proposition", d: "Un devis sur mesure, affiné avec nos partenaires transporteurs sélectionnés." },
];

const CASES = [
  { t: "Séminaires & événements", d: "Acheminez vos collaborateurs et invités, du transfert quotidien au congrès multi-jours.", icon: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01" },
  { t: "Sorties scolaires", d: "Voyages encadrés, véhicules conformes et chauffeurs habitués au transport d'élèves.", icon: "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" },
  { t: "Soirées étudiantes & BDE", d: "Navettes de soirée, week-ends d'intégration, déplacements d'associations.", icon: "M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" },
  { t: "Transferts aéroport", d: "Prise en charge ponctuelle de vos groupes, à l'heure, sans stress logistique.", icon: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2 3 8l5 4-3 3-3-1-1 1 4 3 3 4 1-1-1-3 3-3 4 5z" },
  { t: "Tourisme & excursions", d: "Circuits touristiques, journées découverte, road-trips en groupe.", icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  { t: "Circuits multi-villes", d: "Itinéraires complexes avec étapes : on orchestre l'ensemble du parcours.", icon: "M9 18l6-12M6 6h.01M18 18h.01M4 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM16 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" },
];

const QUOTES = [
  { q: "Réactivité impeccable et chauffeurs irréprochables. Cela fait plus de 10 ans que nous leur confions nos déplacements.", who: "Directeur logistique", org: "Groupe industriel" },
  { q: "Devis clair, conseiller à l'écoute, véhicule premium. Exactement ce qu'il fallait pour notre séminaire.", who: "Office manager", org: "Scale-up tech" },
  { q: "Organisation d'un circuit multi-étapes sans aucun accroc. Un vrai gain de temps pour notre association.", who: "Présidente", org: "BDE étudiant" },
];

const FAQ = [
  { q: "Proposez-vous un prix en ligne instantané ?", a: "Non — et c'est volontaire. Chaque trajet de groupe est unique (distance, étapes, dates, type de véhicule). Vous décrivez votre besoin, et un conseiller vous rappelle sous 2 h avec une proposition précise et juste." },
  { q: "Couvrez-vous l'international ?", a: "Oui. Nous organisons des trajets partout en France et dans toute l'Europe, du simple transfert au circuit de plusieurs jours." },
  { q: "Gérez-vous les circuits multi-étapes ?", a: "Absolument. Ajoutez vos étapes intermédiaires dès le départ : nous orchestrons l'itinéraire complet avec nos partenaires transporteurs." },
  { q: "Sous quel délai obtient-on une réponse ?", a: "Notre objectif est un premier retour sous 2 h ouvrées. Pour les demandes urgentes, signalez-le dans la conversation : elles sont priorisées." },
  { q: "Et la sécurité / les assurances ?", a: "Nous travaillons avec des transporteurs professionnels au cadre réglementé, et nos prestations sont couvertes par une assurance jusqu'à 10 M€." },
];

export default function Home() {
  return (
    <div className={`lp-root ${display.variable} ${body.variable}`}>
      <ChatProvider />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <ScrollNav>
        <div className="lp-shell lp-nav-inner">
          <a href="#top" className="lp-logo">
            <span className="lp-logo-mark" aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17h2l1-5h12l1 5h2M6 12l1-5h10l1 5M7 17v2M17 17v2" />
              </svg>
            </span>
            NeoTravel
          </a>
          <div className="lp-navlinks">
            <a href="#how" className="lp-navlink">Comment ça marche</a>
            <a href="#fleet" className="lp-navlink">Nos véhicules</a>
            <a href="#why" className="lp-navlink">Pourquoi nous</a>
            <a href="#faq" className="lp-navlink">FAQ</a>
          </div>
          <OpenChatButton className="lp-btn lp-btn-primary">Demander un devis</OpenChatButton>
        </div>
      </ScrollNav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <header id="top" className="lp-hero">
        <div className="lp-hero-bg" />
        <svg className="lp-hero-topo" viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path
              key={i}
              d={`M0 ${120 + i * 60} C 360 ${60 + i * 60}, 1080 ${200 + i * 60}, 1440 ${100 + i * 60}`}
              fill="none"
              stroke="#143a2f"
              strokeOpacity="0.07"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div className="lp-shell lp-hero-grid">
          <div>
            <p className="lp-eyebrow lp-rise" style={{ animationDelay: "0.05s" }}>
              Transport de groupe avec chauffeur · France & Europe
            </p>
            <h1 className="lp-display lp-h1">
              <span className="lp-rise" style={{ animationDelay: "0.12s", display: "block" }}>Votre groupe.</span>
              <span className="lp-rise" style={{ animationDelay: "0.22s", display: "block" }}>Votre trajet.</span>
              <span className="lp-rise lp-accent" style={{ animationDelay: "0.32s", display: "inline-block" }}>
                <span className="lp-underline">
                  Sans le casse-tête.
                  <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
                    <path d="M4 16 C 70 6, 150 6, 214 12 C 250 15, 280 14, 296 9" />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="lp-sub lp-rise" style={{ animationDelay: "0.46s" }}>
              Autocars, minibus & berlines avec chauffeur. Dites-nous d&apos;où vous partez et où vous allez —
              un conseiller vous rappelle avec une proposition sur mesure.
            </p>
            <div className="lp-trust lp-rise" style={{ animationDelay: "0.58s" }}>
              <span><Stars n={5} /> <b>5/5</b> Trusted Shops</span>
              <span><Dot /> Réponse <b>sous 2 h</b></span>
              <span><Dot /> Assurance <b>10 M€</b></span>
            </div>
          </div>

          <div className="lp-rise" style={{ animationDelay: "0.4s" }}>
            <RoutePlanner />
          </div>
        </div>

        {/* Monuments flottants */}
        <div className="lp-shell" style={{ marginTop: 24 }}>
          <div className="lp-floats" aria-hidden>
            <div className="lp-orb lp-orb-1" />
            {FLOATS.map((f) => (
              <ParallaxLayer key={f.cls} className={`lp-float ${f.cls}`} strength={f.strength}>
                <Image src={f.src} alt="" fill sizes="240px" unoptimized style={{ objectFit: "cover" }} />
                <span className="lp-float-tag">{f.tag}</span>
              </ParallaxLayer>
            ))}
          </div>
        </div>
      </header>

      {/* ── Marquee segments ────────────────────────────────── */}
      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">
          {[...SEGMENTS, ...SEGMENTS].map((s, i) => (
            <span className="lp-marquee-item" key={i}>
              <Compass />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Comment ça marche ───────────────────────────────── */}
      <section id="how" className="lp-section">
        <div className="lp-shell">
          <Reveal className="lp-section-head">
            <span className="lp-kicker">Simple, en 3 étapes</span>
            <h2 className="lp-display lp-h2">La confiance, avant même votre premier appel.</h2>
            <p className="lp-lead">
              Pas de formulaire interminable. Vous expliquez votre besoin à notre assistant, le reste est pris en charge par un humain.
            </p>
          </Reveal>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 120}>
                <div className="lp-step">
                  <div className="lp-step-num">{String(i + 1).padStart(2, "0")}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Flotte ──────────────────────────────────────────── */}
      <section id="fleet" className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal className="lp-section-head">
            <span className="lp-kicker">Des véhicules pour chaque besoin</span>
            <h2 className="lp-display lp-h2">Du minibus VIP à l&apos;autocar 93 places.</h2>
          </Reveal>
          <div className="lp-fleet">
            {FLEET.map((v, i) => (
              <Reveal key={v.name} delay={i * 90}>
                <article className="lp-fleet-card">
                  <div className="lp-fleet-img">
                    <Image src={v.src} alt={v.name} fill sizes="(max-width:760px) 50vw, 20vw" unoptimized style={{ objectFit: "cover" }} />
                    <span className="lp-fleet-cap">{v.cap} pax</span>
                  </div>
                  <div className="lp-fleet-body">
                    <h3>{v.name}</h3>
                    <p>{v.use}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pourquoi nous / stats ───────────────────────────── */}
      <section id="why" className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal>
            <div className="lp-statsband">
              <div style={{ position: "relative", maxWidth: "34rem", marginBottom: 40 }}>
                <span className="lp-eyebrow" style={{ color: "var(--amber-soft)" }}>Pourquoi NeoTravel</span>
                <h2 className="lp-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", marginTop: 14, color: "#fff" }}>
                  Un intermédiaire premium qui prend la logistique à sa charge.
                </h2>
              </div>
              <div className="lp-stats-grid">
                <Stat num={<Counter to={2} suffix=" h" />} label="Réponse moyenne d'un conseiller en journée" />
                <Stat num={<><Counter to={5} />/5</>} label="Note Trusted Shops vérifiée" />
                <Stat num={<Counter to={10} prefix="" suffix=" M€" />} label="Couverture d'assurance des prestations" />
                <Stat num={<Counter to={93} suffix=" pax" />} label="Capacité maximale par véhicule" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Cas d'usage ─────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal className="lp-section-head">
            <span className="lp-kicker">Pour qui</span>
            <h2 className="lp-display lp-h2">Conçu pour vos déplacements de groupe.</h2>
          </Reveal>
          <div className="lp-cases">
            {CASES.map((c, i) => (
              <Reveal key={c.t} delay={(i % 3) * 100}>
                <div className="lp-case">
                  <div className="lp-case-ic">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={c.icon} />
                    </svg>
                  </div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Témoignages ─────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal className="lp-section-head">
            <span className="lp-kicker">Ils nous font confiance</span>
            <h2 className="lp-display lp-h2">Des groupes transportés, sereinement.</h2>
          </Reveal>
          <div className="lp-quotes">
            {QUOTES.map((q, i) => (
              <Reveal key={i} delay={i * 110}>
                <figure className="lp-quote">
                  <div className="lp-stars"><Stars n={5} /></div>
                  <p>« {q.q} »</p>
                  <figcaption className="lp-quote-who">
                    <b>{q.who}</b>
                    {q.org}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal className="lp-section-head">
            <span className="lp-kicker">Questions fréquentes</span>
            <h2 className="lp-display lp-h2">Tout ce qu&apos;il faut savoir.</h2>
          </Reveal>
          <Reveal>
            <Faq items={FAQ} />
          </Reveal>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-shell">
          <Reveal>
            <div className="lp-cta">
              <h2>Prêt à faire voyager votre groupe ?</h2>
              <p>Décrivez votre trajet en 30 secondes. Un conseiller vous rappelle avec une proposition sur mesure.</p>
              <OpenChatButton className="lp-btn lp-btn-amber" style={{ padding: "15px 28px", fontSize: "1.05rem" }}>
                Démarrer ma demande
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </OpenChatButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-shell">
          <div className="lp-footer-grid">
            <div>
              <a href="#top" className="lp-logo" style={{ marginBottom: 14 }}>
                <span className="lp-logo-mark" aria-hidden>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17h2l1-5h12l1 5h2M6 12l1-5h10l1 5M7 17v2M17 17v2" />
                  </svg>
                </span>
                NeoTravel
              </a>
              <p style={{ color: "var(--ink-soft)", maxWidth: "22rem", lineHeight: 1.55, fontSize: "0.92rem" }}>
                Intermédiation en transport de groupe en autocar. On orchestre votre trajet, du devis au départ.
              </p>
            </div>
            <div>
              <h4>Service</h4>
              <a href="#how">Comment ça marche</a>
              <a href="#fleet">Nos véhicules</a>
              <a href="#why">Pourquoi nous</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h4>Prestations</h4>
              <a href="#fleet">Séminaires</a>
              <a href="#fleet">Sorties scolaires</a>
              <a href="#fleet">Transferts aéroport</a>
              <a href="#fleet">Circuits multi-villes</a>
            </div>
            <div>
              <h4>Contact</h4>
              <a href="tel:+33000000000">Être rappelé</a>
              <a href="/simulateur">Simulateur tarifaire</a>
              <a href="/dashboard">Espace commercial</a>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} NeoTravel — Tous droits réservés.</span>
            <span>France & Europe · Transport professionnel régulé</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ num, label }: { num: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="lp-display lp-stat-num">{num}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {Array.from({ length: n }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" />
        </svg>
      ))}
    </span>
  );
}

function Dot() {
  return <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--amber)", display: "inline-block" }} aria-hidden />;
}

function Compass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
