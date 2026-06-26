import { Rail } from "@/components/office/rail";
import { ImproveButton } from "@/components/office/improve-button";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLeadActionCount } from "@/lib/dashboard/office-data";

export const dynamic = "force-dynamic";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  // Compteur léger (1 requête) d'actions commerciales en attente → pastille sidebar.
  const leadActions = await getLeadActionCount(supabaseAdmin).catch(() => 0);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Rail leadActions={leadActions} />
      <main className="nt-scroll relative min-w-0 flex-1 overflow-y-auto">{children}</main>
      <ImproveButton />
    </div>
  );
}
