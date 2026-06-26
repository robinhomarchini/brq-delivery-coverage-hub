import { Tags } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";

export default function SubjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Módulo em avaliação"
        title="Assuntos"
        description="Esta visão está temporariamente pausada enquanto o modelo de cobertura por cliente é revisado."
      />
      <Card className="p-10 text-center shadow-sm">
        <Tags className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="font-semibold text-slate-700">Assuntos desabilitados neste momento</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
          Os dados foram preservados para uso futuro, mas não aparecem nas visualizações executivas até a definição do novo modelo.
        </p>
      </Card>
    </>
  );
}
