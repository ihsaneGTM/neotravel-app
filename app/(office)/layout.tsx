import { Rail } from "@/components/office/rail";
import { ImproveButton } from "@/components/office/improve-button";

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Rail />
      <main className="nt-scroll relative min-w-0 flex-1 overflow-y-auto">{children}</main>
      <ImproveButton />
    </div>
  );
}
