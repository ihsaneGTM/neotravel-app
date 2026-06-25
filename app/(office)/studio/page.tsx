import { Wand2 } from "lucide-react";
import { studioConfigured, PROD_URL } from "@/lib/studio/config";
import { PageHeader } from "@/components/office/ui";
import { Shell } from "@/components/office/shell";
import { StudioConsole } from "@/components/office/studio-console";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const cfg = studioConfigured();
  return (
    <Shell>
      <PageHeader
        icon={Wand2}
        title="Studio"
        subtitle="Demandez une amélioration en langage naturel — l'IA code, vous comparez avant/après, vous validez, ça se déploie."
      />
      <StudioConsole configured={cfg.ok} missing={cfg.missing} prodUrl={PROD_URL} />
    </Shell>
  );
}
