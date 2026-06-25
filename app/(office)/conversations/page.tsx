import { MessagesSquare } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConversations } from "@/lib/dashboard/office-data";
import { PageHeader } from "@/components/office/ui";
import { Shell } from "@/components/office/shell";
import { ConversationsViewer } from "@/components/office/conversations-viewer";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const conversations = await getConversations(supabaseAdmin);
  const aRappeler = conversations.filter((c) => c.statut === "a_rappeler").length;
  return (
    <Shell>
      <PageHeader
        icon={MessagesSquare}
        title="Conversations"
        subtitle={`${conversations.length} conversation${conversations.length > 1 ? "s" : ""} IA · ${aRappeler} à rappeler`}
      />
      <ConversationsViewer conversations={conversations} />
    </Shell>
  );
}
