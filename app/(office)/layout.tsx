import { Rail } from "@/components/office/rail";

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Rail />
      <main className="nt-scroll min-w-0 flex-1 overflow-x-hidden px-6 py-7 lg:px-9">
        <div className="mx-auto max-w-[1180px] nt-in">{children}</div>
      </main>
    </div>
  );
}
