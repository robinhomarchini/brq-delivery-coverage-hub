import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Insights executivos"
        title="Insights"
        description="Consulte análises executivas e use a central de Baselines para carregar novas planilhas oficiais."
      />
      <Card className="p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-950">Importação centralizada</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          A importação de curvas e baselines foi movida para uma funcionalidade única. Isso evita versões concorrentes da mesma origem e mantém o Comparativo Baseline como tela de leitura/análise.
        </p>
        <Button asChild className="mt-4">
          <Link href="/baselines">Abrir Baselines</Link>
        </Button>
      </Card>
    </>
  );
}
