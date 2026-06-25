"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Révèle ses enfants quand ils entrent dans le viewport (une fois). */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`lp-reveal ${className}`}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Comp>
  );
}

/** Compteur animé qui démarre à l'apparition. */
export function Counter({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1400,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true;
      io.disconnect();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setVal(to);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(to * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      <span className="lp-unit">{suffix}</span>
    </span>
  );
}

/** Teinte la nav au scroll. */
export function ScrollNav({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      ref.current?.setAttribute("data-scrolled", String(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav ref={ref} className="lp-nav" data-scrolled="false">
      {children}
    </nav>
  );
}

/** Léger parallaxe à la souris pour les monuments flottants. */
export function ParallaxLayer({ children, className = "", strength = 18 }: { children: ReactNode; className?: string; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = ((e.clientX - cx) / cx) * strength;
        const dy = ((e.clientY - cy) / cy) * strength;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return (
    <div ref={ref} className={className} style={{ transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)" }}>
      {children}
    </div>
  );
}

/** Accordéon FAQ. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="lp-faq">
      {items.map((it, i) => (
        <div className="lp-faq-item" key={i} data-open={open === i}>
          <button className="lp-faq-q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            {it.q}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="lp-faq-a">
            <div>
              <p>{it.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
