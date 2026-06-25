import { BarChart3 } from "lucide-react";
import { Soon } from "@/components/office/soon";
import { Shell } from "@/components/office/shell";

export default function AnalyticsPage() {
  return (
    <Shell>
    <Soon
      icon={BarChart3}
      title="Sales Analytics"
      subtitle="Vue de performance commerciale"
      note="Conversion funnel, sources, distribution des scores et performance par commercial arrivent très vite."
    />
    </Shell>
  );
}
