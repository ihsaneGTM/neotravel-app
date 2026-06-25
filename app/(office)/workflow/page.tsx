import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWorkflow } from "@/lib/workflow/bricks";
import { PipelineMap } from "@/components/office/pipeline-map";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const bricks = await getWorkflow(supabaseAdmin);
  return (
    <div className="h-full w-full">
      <PipelineMap bricks={bricks} />
    </div>
  );
}
