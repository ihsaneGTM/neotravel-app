"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Waypoints,
  Inbox,
  Bell,
  BarChart3,
  FileText,
  Sparkles,
  LogOut,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Pipeline Map", icon: Waypoints },
  { href: "/leads", label: "Lead Inbox", icon: Inbox },
  { href: "/follow-ups", label: "Follow-ups", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: FileText },
];

export function Rail() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const w = collapsed ? "w-[68px]" : "w-[228px]";

  return (
    <aside
      className={`${w} sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--line)] bg-white transition-[width] duration-300`}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        {!collapsed && <span className="text-[15px] font-bold tracking-tight text-slate-900">NeoTravel</span>}
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`nt-press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bas */}
      <div className="space-y-1 border-t border-[var(--line)] px-3 py-3">
        <Link
          href="/"
          title="Chat public"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <MessageSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {!collapsed && <span>Chat public</span>}
        </Link>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-50">
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-50"
        >
          <ChevronLeft className={`h-[18px] w-[18px] shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} strokeWidth={2} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
