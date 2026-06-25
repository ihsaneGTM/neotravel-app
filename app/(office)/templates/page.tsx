import { FileText } from "lucide-react";
import { Soon } from "@/components/office/soon";

export default function TemplatesPage() {
  return (
    <Soon
      icon={FileText}
      title="Proposal Templates"
      subtitle="Génération de propositions à partir de modèles"
      note="Le wizard (choix du lead + devis + modèle → proposition générée) arrive dans la prochaine itération."
    />
  );
}
