import { Bell } from "lucide-react";
import { Soon } from "@/components/office/soon";
import { Shell } from "@/components/office/shell";

export default function FollowUpsPage() {
  return (
    <Shell>
    <Soon
      icon={Bell}
      title="Smart Follow-up Center"
      subtitle="Relances planifiées et suivi des échéances"
      note="Le centre de relances (Vercel Cron + Resend, complétion 1-clic) arrive dans la prochaine itération."
    />
    </Shell>
  );
}
