import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./ui";

export function Soon({ icon, title, subtitle, note }: { icon: LucideIcon; title: string; subtitle: string; note: string }) {
  return (
    <>
      <PageHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="nt-card grid place-items-center py-20 text-center">
        <div className="max-w-sm">
          <p className="text-base font-semibold text-slate-700">Section en cours de construction</p>
          <p className="mt-1.5 text-sm text-slate-500">{note}</p>
        </div>
      </div>
    </>
  );
}
