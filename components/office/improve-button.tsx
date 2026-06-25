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
      className="nt-press fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition hover:scale-[1.03]"
    >
      <Sparkles className="h-4 w-4" /> Améliorer
    </Link>
  );
}
