import { TargetBaselineImport } from "@/components/insights/target-baseline-import";
import { PageHeader } from "@/components/shared/page-header";

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Insights executivos"
        title="Insights"
        description="Importe uma planilha de baseline, compare Hunter, Renovação + Ampliação e Áreas / Studios por cliente e valide consistências antes de atualizar a base."
      />
      <TargetBaselineImport />
    </>
  );
}
