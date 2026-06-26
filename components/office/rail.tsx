"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  Bell,
  BarChart3,
  FileText,
  LogOut,
  ChevronLeft,
  MessagesSquare,
  Workflow,
  Wand2,
} from "lucide-react";

// Pages d'usage quotidien (commerciaux)
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Lead Inbox", icon: Inbox },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/follow-ups", label: "Follow-ups", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: FileText },
];

export function Rail({ leadActions = 0 }: { leadActions?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const w = collapsed ? "w-[68px]" : "w-[228px]";

  const item = (href: string, label: string, Icon: typeof Inbox, badge?: number) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    const showBadge = !!badge && badge > 0;
    return (
      <Link
        href={href}
        title={collapsed ? `${label}${showBadge ? ` — ${badge} à faire` : ""}` : undefined}
        className={`nt-press relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-[var(--lime-soft)] text-[var(--forest)]" : "text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
        }`}
      >
        <span className="relative shrink-0">
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
          {/* mode replié : pastille-point lime sur l'icône */}
          {collapsed && showBadge && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--lime-deep)] ring-2 ring-white" />
          )}
        </span>
        {!collapsed && <span>{label}</span>}
        {/* mode déplié : pastille comptée à droite */}
        {!collapsed && showBadge && (
          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--lime-soft)] px-1.5 py-0.5 text-[0.7rem] font-bold text-[var(--forest)] ring-1 ring-[var(--lime-deep)]">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`${w} sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--line)] bg-white transition-[width] duration-300`}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <Link href="/dashboard" className={`group relative flex h-20 items-center ${collapsed ? "justify-center px-2" : "px-3"}`}>
        {/* halo lime qui réchauffe le coin */}
        <span aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-14 w-20 -translate-y-1/2 rounded-full blur-2xl" style={{ background: "radial-gradient(circle, rgba(216,231,98,.55), transparent 70%)" }} />
        {/* bus agrandi + incliné, ombre portée chaude */}
        <img
          src="/neotravel-bus.png"
          alt="NeoTravel"
          className={`relative z-0 -rotate-[9deg] transition-all duration-300 ease-out group-hover:-rotate-[6deg] group-hover:scale-105 ${collapsed ? "w-11" : "w-[92px]"}`}
          style={{ filter: "drop-shadow(0 7px 11px rgba(22,23,14,.24))" }}
        />
        {/* wordmark qui chevauche le bus et passe DEVANT (liseré blanc pour la lisibilité) */}
        {!collapsed && (
          <span
            className="relative z-10 -ml-7 text-[21px] font-extrabold leading-none tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-jakarta)",
              color: "var(--ink)",
              textShadow: "1.5px 0 0 #fff, -1.5px 0 0 #fff, 0 1.5px 0 #fff, 0 -1.5px 0 #fff, 0 3px 10px rgba(255,255,255,.95)",
            }}
          >
            Neo<span style={{ color: "var(--forest)" }}>Travel</span>
          </span>
        )}
      </Link>

      {/* Usage quotidien */}
      <nav className="flex-1 space-y-1 px-3 py-3">{NAV.map((n) => <div key={n.href}>{item(n.href, n.label, n.icon, n.href === "/leads" ? leadActions : undefined)}</div>)}</nav>

      {/* Configuration (growth / ops) — dissociée du quotidien */}
      <div className="mx-3 border-t border-[var(--line-2)]" />
      <div className="space-y-1 px-3 py-3">
        {!collapsed && <p className="mb-1 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--faint)]">Configuration</p>}
        {item("/workflow", "Workflow", Workflow)}
        {item("/studio", "Studio", Wand2)}
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t border-[var(--line)] px-3 py-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--faint)] transition-colors hover:bg-[var(--bg-soft)]">
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--faint)] transition-colors hover:bg-[var(--bg-soft)]"
        >
          <ChevronLeft className={`h-[18px] w-[18px] shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} strokeWidth={2} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
