import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWorkflow } from "@/lib/workflow/bricks";
import { PERIODS, type Period } from "@/lib/dashboard/office-data";
import { PipelineMap } from "@/components/office/pipeline-map";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "today") as Period;
  const bricks = await getWorkflow(supabaseAdmin, period);
  return (
    <div className="h-full w-full">
      <PipelineMap bricks={bricks} period={period} />
    </div>
  );
}
