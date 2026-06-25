import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLeads } from "@/lib/dashboard/office-data";
import { LeadInbox } from "@/components/office/lead-inbox";
import { Shell } from "@/components/office/shell";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads(supabaseAdmin);
  return (
    <Shell>
      <LeadInbox leads={leads} />
    </Shell>
  );
}
