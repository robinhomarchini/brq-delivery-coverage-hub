import { BaselineImportCenter } from "@/components/baselines/baseline-import-center";
import { PageHeader } from "@/components/shared/page-header";

export default function BaselinesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Origens oficiais"
        title="Baselines"
        description="Centralize a importação das curvas e baselines por área/studio. As fotos salvas alimentam os comparativos sem alterar metas operacionais automaticamente."
      />
      <BaselineImportCenter />
    </>
  );
}
