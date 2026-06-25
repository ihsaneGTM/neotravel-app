import "@/components/landing/autopilot.css";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import { RoutePlanner } from "@/components/landing/route-planner";
import { ChatProvider, OpenChatButton } from "@/components/landing/chat-launcher";
import { Reveal, RotatingWord, Faq } from "@/components/landing/motion";
import { RouteMap } from "@/components/landing/route-map";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const ArrowUR = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

const Clouds = () => <div className="ap-clouds" aria-hidden />;

const FEATURES = [
  { bg: "bg-purple", reverse: false, h: "Le bon véhicule, à chaque fois", p: "Du minibus VIP à l'autocar 93 places : on sélectionne le véhicule adapté à votre groupe, votre trajet et votre budget.", photo: "/landing/photos/feat-exterior.jpg" },
  { bg: "bg-green", reverse: true, h: "Un interlocuteur, pas un formulaire", p: "Un conseiller dédié valide votre trajet, vos horaires et vos contraintes — par téléphone, simplement.", photo: "/landing/photos/feat-advisor.jpg" },
  { bg: "bg-orange", reverse: false, h: "Une réponse sous 2 heures", p: "Fini les devis qui traînent. Votre demande est prise en charge et rappelée dans la foulée." },
  { bg: "bg-sky", reverse: true, h: "Un devis clair, sans surprise", p: "Prix ferme annoncé par votre conseiller, sans estimation hasardeuse ni frais cachés." },
];

const FAQ = [
  { q: "Proposez-vous un prix en ligne instantané ?", a: "Non, et c'est volontaire. Chaque trajet de groupe est unique : distance, étapes, dates, type de véhicule. Vous décrivez votre besoin et un conseiller vous rappelle sous 2 h avec une proposition précise et juste." },
  { q: "Couvrez-vous l'international ?", a: "Oui. Nous organisons des trajets partout en France et dans toute l'Europe, du simple transfert au circuit de plusieurs jours." },
  { q: "Gérez-vous les circuits multi-étapes ?", a: "Absolument. Ajoutez vos étapes intermédiaires dès le départ : nous orchestrons l'itinéraire complet avec nos partenaires transporteurs." },
  { q: "Sous quel délai obtient-on une réponse ?", a: "Notre objectif est un premier retour sous 2 h ouvrées. Pour une demande urgente, signalez-le dans la conversation : elle est priorisée." },
  { q: "Et la sécurité, les assurances ?", a: "Nous travaillons avec des transporteurs professionnels au cadre réglementé, et nos prestations sont couvertes par une assurance jusqu'à 10 M€." },
];

export default function Home() {
  return (
    <div className={`ap-root ${jakarta.variable}`}>
      <ChatProvider />

      {/* ── HERO ──────────────────────────────────────────── */}
      <div className="ap-hero-wrap">
        <header className="ap-hero" id="top">
          <div className="ap-hero-photo">
            <Image src="/landing/photos/hero.jpg" alt="" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
          </div>
          <div className="ap-hero-tint" aria-hidden />
          <Clouds />
          <div className="ap-hero-inner">
            <nav className="ap-nav">
              <a href="#top" className="ap-logo" aria-label="Autocar-Location — accueil">
                <span className="ap-logo-badge">
                  <Image src="/landing/logo-autocarloc.png" alt="Autocar-Location" width={124} height={29} priority />
                </span>
              </a>
              <div className="ap-navlinks">
                <a href="#vehicules" className="ap-navlink">Véhicules</a>
                <a href="#how" className="ap-navlink">Comment ça marche</a>
                <a href="#prestations" className="ap-navlink">Prestations</a>
                <a href="#faq" className="ap-navlink">FAQ</a>
              </div>
              <OpenChatButton className="ap-btn ap-btn-white">
                Demander un devis <ArrowUR />
              </OpenChatButton>
            </nav>

            <div className="ap-hero-head">
              <h1 className="ap-display ap-h1">
                Le transport de groupe,
                <br />
                enfin <RotatingWord words={["simple", "serein", "sur-mesure", "limpide"]} />.
              </h1>
              <p className="ap-hero-sub">
                Autocars, minibus et berlines avec chauffeur, partout en France et en Europe. Dites-nous votre trajet —
                un conseiller vous rappelle sous 2 h avec une proposition sur mesure.
              </p>
              <div className="ap-hero-trust">
                <span><Stars /> <b>4,9/5</b> avis clients</span>
                <span>· Réponse <b>sous 2 h</b></span>
                <span>· Assurance <b>10 M€</b></span>
              </div>
            </div>

            <RoutePlanner />
          </div>
        </header>
      </div>

      {/* ── LE SAVIEZ-VOUS ────────────────────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingBottom: "clamp(40px,6vw,80px)" }}>
        <Reveal>
          <p className="ap-kicker">Le saviez-vous ?</p>
          <p className="ap-statement" style={{ marginTop: 18 }}>
            Aujourd&apos;hui, <span className="hl">1 demande de groupe sur 2</span>{" "}attend plus de 48 h avant
            d&apos;obtenir une réponse. Avec Autocar-Location, vous êtes rappelé en{" "}
            <span className="hl-2">moins de 2 heures</span>.
          </p>
        </Reveal>
      </section>

      {/* ── ITINÉRAIRE EN DIRECT (carte Leaflet) ──────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }}>
        <div className="ap-mapsec">
          <Reveal>
            <p className="ap-kicker">Itinéraire en direct</p>
            <h2 className="ap-display ap-h2" style={{ marginTop: 12 }}>
              Votre trajet, tracé
              <br />
              de bout en bout.
            </h2>
            <p className="ap-lead">
              De votre point de départ à l&apos;arrivée — étapes comprises — chaque kilomètre est cartographié.
              Vous savez exactement par où passe votre groupe.
            </p>
            <div className="ap-map-stats">
              <span className="ap-map-stat">
                <b>≈ 582 km</b>
              </span>
              <span className="ap-map-stat">
                <b>≈ 5 h</b> de route
              </span>
              <span className="ap-map-stat">
                Autocar <b>55 places</b>
              </span>
            </div>
            <OpenChatButton className="ap-btn ap-btn-dark" style={{ marginTop: 22 }}>
              Planifier mon trajet <ArrowUR />
            </OpenChatButton>
          </Reveal>
          <Reveal delay={120}>
            <RouteMap />
          </Reveal>
        </div>
      </section>

      {/* ── POURQUOI (features décalées) ──────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }} id="vehicules">
        <Reveal className="ap-feat-head">
          <div>
            <p className="ap-kicker">Pourquoi Autocar-Location</p>
            <h2 className="ap-display ap-h2" style={{ marginTop: 12 }}>
              La confiance, avant même
              <br />
              votre premier appel.
            </h2>
          </div>
          <OpenChatButton className="ap-btn ap-btn-dark">
            Demander un devis <ArrowUR />
          </OpenChatButton>
        </Reveal>

        <div className="ap-features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.h} delay={(i % 2) * 120}>
              <div className={`ap-feature ${f.reverse ? "reverse" : ""}`}>
                <div className="ap-feature-text">
                  <h3>{f.h}</h3>
                  <p>{f.p}</p>
                </div>
                <div className={`ap-feature-art ${f.bg}`}>
                  {f.photo ? (
                    <Image src={f.photo} alt="" fill sizes="(max-width:860px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                  ) : (
                    <Clouds />
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ─────────────────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }} id="how">
        <Reveal className="ap-feat-head">
          <div>
            <p className="ap-kicker">En 3 étapes</p>
            <h2 className="ap-display ap-h2" style={{ marginTop: 12 }}>Comment ça marche</h2>
          </div>
          <OpenChatButton className="ap-btn ap-btn-dark">
            Démarrer ma demande <ArrowUR />
          </OpenChatButton>
        </Reveal>

        <div className="ap-steps3">
          <Reveal>
            <div className="ap-step3">
              <div className="ap-card-art bg-blue">
                <Clouds />
                <div className="ap-mock">
                  <div className="ap-mock-pill" style={{ marginBottom: 12 }}>
                    <span className="ap-mock-dot" /> Bordeaux
                    <span style={{ opacity: 0.7 }}>→</span>
                    <span className="ap-mock-dot" style={{ background: "#d8e762" }} /> Paris
                  </div>
                  <div className="ap-mock-bar" style={{ width: "100%", marginBottom: 8 }} />
                  <div className="ap-mock-bar" style={{ width: "62%" }} />
                </div>
              </div>
              <h3>Vous décrivez le trajet</h3>
              <p>Villes, étapes, dates, nombre de voyageurs — en quelques mots, via notre assistant.</p>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <div className="ap-step3">
              <div className="ap-card-art bg-orange">
                <Clouds />
                <div className="ap-mock">
                  <div className="ap-mock-bar" style={{ width: "70%", marginBottom: 9 }} />
                  <div className="ap-mock-bar" style={{ width: "90%", marginBottom: 9 }} />
                  <div className="ap-mock-pill">📞 Rappel sous 2 h</div>
                </div>
              </div>
              <h3>Un conseiller vous rappelle</h3>
              <p>Il valide vos contraintes, vos horaires et le véhicule idéal. Sous 2 h en journée.</p>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className="ap-step3">
              <div className="ap-card-art bg-green">
                <Clouds />
                <div className="ap-mock">
                  <div className="ap-mock-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                    <span>Devis Autocar-Loc</span>
                    <span className="ap-mock-chip">PDF</span>
                  </div>
                  <div className="ap-mock-bar" style={{ width: "100%", marginBottom: 8 }} />
                  <div className="ap-mock-bar" style={{ width: "80%", marginBottom: 8 }} />
                  <div className="ap-mock-bar" style={{ width: "45%" }} />
                </div>
              </div>
              <h3>Vous recevez votre devis</h3>
              <p>Une proposition sur mesure, affinée avec nos partenaires transporteurs sélectionnés.</p>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="ap-highlight">
            <div className="ap-highlight-photo">
              <Image src="/landing/photos/feat-interior.jpg" alt="" fill sizes="100vw" style={{ objectFit: "cover" }} />
            </div>
            <div className="ap-highlight-tint" aria-hidden />
            <span className="ap-badge" style={{ zIndex: 2 }}>Sur-mesure</span>
            <h3 style={{ zIndex: 2 }}>Circuits multi-étapes</h3>
            <p style={{ zIndex: 2 }}>Plusieurs villes, plusieurs jours&nbsp;? On orchestre l&apos;itinéraire complet, étape par étape, avec un seul interlocuteur.</p>
          </div>
        </Reveal>
      </section>

      {/* ── DEUX FAÇONS DE VOYAGER (grand panneau) ────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }} id="prestations">
        <Reveal>
          <div className="ap-bigpanel">
            <Clouds />
            <div style={{ textAlign: "center", maxWidth: "44rem", margin: "0 auto" }}>
              <span className="ap-pill-tag">Prestations</span>
              <h2 className="ap-display" style={{ fontSize: "clamp(2rem,5vw,3.4rem)" }}>
                Deux façons de voyager
              </h2>
              <p style={{ marginTop: 14, fontSize: "1.1rem", color: "rgba(255,255,255,0.85)" }}>
                Du simple transfert au circuit de plusieurs jours, on s&apos;adapte à votre groupe.
              </p>
            </div>

            <div className="ap-ways">
              <div className="ap-way">
                <span className="ap-way-cap">Aller simple · aller-retour</span>
                <h3>Trajet ponctuel</h3>
                <div className="ap-way-list">
                  {["Transferts aéroport & gare", "Navettes d'événement", "Sorties à la journée", "Mise à disposition"].map((x) => (
                    <span key={x}><Check /> {x}</span>
                  ))}
                </div>
                <OpenChatButton className="ap-btn ap-btn-white">Démarrer ma demande <ArrowUR /></OpenChatButton>
              </div>

              <div className="ap-way-or">ou</div>

              <div className="ap-way">
                <span className="ap-way-cap">Sur-mesure · multi-jours</span>
                <h3>Circuit &amp; événement</h3>
                <div className="ap-way-list">
                  {["Séminaires d'entreprise", "Voyages scolaires", "Circuits touristiques", "Itinéraires multi-étapes"].map((x) => (
                    <span key={x}><Check /> {x}</span>
                  ))}
                </div>
                <OpenChatButton className="ap-btn ap-btn-white">Démarrer ma demande <ArrowUR /></OpenChatButton>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── POUR QUI (services) ───────────────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }}>
        <div className="ap-services">
          <div className="ap-services-left">
            <Reveal>
              <p className="ap-kicker">Pour qui</p>
              <h2 className="ap-display ap-h2" style={{ marginTop: 12 }}>Pensé pour chaque groupe.</h2>
              <p className="ap-lead">Entreprises, écoles, associations, collectivités : on transporte tous les groupes, du petit comité aux grandes délégations.</p>
              <OpenChatButton className="ap-btn ap-btn-dark" style={{ marginTop: 22 }}>
                Demander un devis <ArrowUR />
              </OpenChatButton>
            </Reveal>
          </div>

          <div>
            {[
              { photo: "/landing/photos/svc-corporate.jpg", h: "Entreprises & séminaires", p: "Acheminez collaborateurs et invités, du transfert quotidien au congrès de plusieurs jours." },
              { photo: "/landing/photos/svc-school.jpg", h: "Sorties scolaires", p: "Voyages encadrés, véhicules conformes et chauffeurs habitués au transport d'élèves." },
              { photo: "/landing/photos/svc-students.jpg", h: "Étudiants & associations", p: "Soirées, week-ends d'intégration, déplacements de BDE : on gère vos groupes, simplement." },
            ].map((s, i) => (
              <Reveal key={s.h} delay={i * 110}>
                <div className="ap-service">
                  <div className="ap-service-art">
                    <Image src={s.photo} alt={s.h} fill sizes="(max-width:900px) 100vw, 55vw" style={{ objectFit: "cover" }} />
                  </div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ (grand panneau) ───────────────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }} id="faq">
        <Reveal>
          <div className="ap-bigpanel">
            <Clouds />
            <h2 className="ap-display" style={{ fontSize: "clamp(2rem,5vw,3.2rem)" }}>
              Questions
              <br />
              fréquentes
            </h2>
            <Faq items={FAQ} />
          </div>
        </Reveal>
      </section>

      {/* ── POURQUOI NEOTRAVEL (story) ────────────────────── */}
      <section className="ap-section ap-shell" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="ap-story">
            <h2 className="ap-display">Pourquoi Autocar-Location&nbsp;?</h2>
            <p>
              Réserver un car pour un groupe, ça devrait être simple. Trop souvent, c&apos;est une chaîne de mails,
              des devis qui tardent et des prix opaques.
            </p>
            <p>
              On a construit Autocar-Location pour inverser ça&nbsp;: vous décrivez votre trajet en une minute, un conseiller
              vous rappelle dans l&apos;heure, et vous repartez avec une proposition claire — sans jargon, sans pression.
            </p>
            <p className="sign">— L&apos;équipe Autocar-Location</p>
          </div>
        </Reveal>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────── */}
      <div className="ap-hero-wrap">
        <Reveal>
          <div className="ap-bigpanel ap-cta" style={{ borderRadius: 30, minHeight: 320 }}>
            <Clouds />
            <h2 className="ap-display">
              Mettez vos trajets
              <br />
              de groupe sur Autocar-Location.
            </h2>
            <OpenChatButton className="ap-btn ap-btn-white">
              Demander un devis <ArrowUR />
            </OpenChatButton>
          </div>
        </Reveal>
      </div>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="ap-footer ap-shell">
        <div className="ap-footer-inner">
          <a href="#top" className="ap-footer-logo" aria-label="Autocar-Location — haut de page">
            <Image src="/landing/logo-autocarloc.png" alt="Autocar-Location" width={150} height={35} />
          </a>
          <nav>
            <a href="#how">Comment ça marche</a>
            <a href="#prestations">Prestations</a>
            <a href="#faq">FAQ</a>
            <a href="/simulateur">Simulateur</a>
            <a href="/dashboard">Espace commercial</a>
          </nav>
        </div>
        <div className="ap-footer-copy" style={{ marginTop: 24 }}>
          © {new Date().getFullYear()}{" "}Autocar-Location — Transport de groupe avec chauffeur · France &amp; Europe.
        </div>
      </footer>
    </div>
  );
}

function Stars() {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "#d8e762" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" />
        </svg>
      ))}
    </span>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.9 }} aria-hidden focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
