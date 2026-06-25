import { FileText } from "lucide-react";
import { Soon } from "@/components/office/soon";
import { Shell } from "@/components/office/shell";

export default function TemplatesPage() {
  return (
    <Shell>
    <Soon
      icon={FileText}
      title="Proposal Templates"
      subtitle="Génération de propositions à partir de modèles"
      note="Le wizard (choix du lead + devis + modèle → proposition générée) arrive dans la prochaine itération."
    />
    </Shell>
  );
}
