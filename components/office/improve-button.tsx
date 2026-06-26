"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

export function ImproveButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/studio")) return null;
  return (
    <Link
      href="/studio"
      className="nt-press fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-[0_10px_28px_rgba(22,23,14,0.28)] transition hover:scale-[1.03]"
      style={{ background: "var(--ink)", color: "var(--cream)" }}
    >
      <Sparkles className="h-4 w-4" style={{ color: "var(--lime)" }} /> Améliorer
    </Link>
  );
}
