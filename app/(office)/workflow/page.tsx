import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPipelineMap } from "@/lib/dashboard/office-data";
import { MODELS } from "@/lib/ai/models";
import { PipelineMap } from "@/components/office/pipeline-map";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const data = await getPipelineMap(supabaseAdmin, MODELS.agent);
  return (
    <div className="h-full w-full">
      <PipelineMap data={data} />
    </div>
  );
}
