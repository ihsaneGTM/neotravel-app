import { Waypoints } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPipelineMap } from "@/lib/dashboard/office-data";
import { MODELS } from "@/lib/ai/models";
import { PageHeader } from "@/components/office/ui";
import { PipelineMap } from "@/components/office/pipeline-map";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const data = await getPipelineMap(supabaseAdmin, MODELS.agent);
  return (
    <>
      <PageHeader
        icon={Waypoints}
        title="Pipeline Map"
        subtitle="Le fonctionnement réel de l'app, de bout en bout — chaque étape est pilotable"
      />
      <PipelineMap data={data} />
    </>
  );
}
