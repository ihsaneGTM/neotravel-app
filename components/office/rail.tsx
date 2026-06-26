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
  Sparkles,
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

export function Rail() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const w = collapsed ? "w-[68px]" : "w-[228px]";

  const item = (href: string, label: string, Icon: typeof Inbox) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`nt-press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-[var(--lime-soft)] text-[var(--forest)]" : "text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`${w} sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--line)] bg-white transition-[width] duration-300`}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm" style={{ background: "var(--ink)" }}>
          <Sparkles className="h-5 w-5" strokeWidth={2.2} style={{ color: "var(--lime)" }} />
        </span>
        {!collapsed && <span className="text-[15px] font-bold tracking-tight" style={{ fontFamily: "var(--font-jakarta)", color: "var(--ink)" }}>NeoTravel</span>}
      </Link>

      {/* Usage quotidien */}
      <nav className="flex-1 space-y-1 px-3 py-3">{NAV.map((n) => <div key={n.href}>{item(n.href, n.label, n.icon)}</div>)}</nav>

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
