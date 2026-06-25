import { Bell } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFollowups } from "@/lib/dashboard/office-data";
import { PageHeader } from "@/components/office/ui";
import { Shell } from "@/components/office/shell";
import { FollowupCenter } from "@/components/office/followup-center";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const data = await getFollowups(supabaseAdmin);
  return (
    <Shell>
      <PageHeader
        icon={Bell}
        title="Smart Follow-up Center"
        subtitle={`${data.pending} en attente · ${data.overdue} en retard`}
      />
      <FollowupCenter data={data} />
    </Shell>
  );
}
