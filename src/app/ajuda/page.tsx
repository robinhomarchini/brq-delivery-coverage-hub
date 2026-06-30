import Link from "next/link";
import { Download, FileSpreadsheet, HelpCircle, Target, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const guideHref = "/help/guia-rapido-brq-delivery-coverage-hub.pdf";

export default function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Suporte"
        title="Ajuda"
        description="Guia rápido para usar o BRQ Delivery Coverage Hub durante a homologação."
        actions={<Button asChild><Link href={guideHref} target="_blank"><Download className="h-4 w-4" /> Baixar PDF</Link></Button>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HelpCard
          icon={<UsersRound className="h-5 w-5" />}
          title="1. Cadastre e revise pessoas"
          description="Use Pessoas para manter perfis, clientes associados e papéis de Delivery, Hunter ou Farmer atualizados. E-mail é opcional."
        />
        <HelpCard
          icon={<Target className="h-5 w-5" />}
          title="2. Associe metas"
          description="Use Clientes para definir a meta anual do cliente e Metas por Pessoa para distribuir Hunter e Renovação + Ampliação por pessoa e ano."
        />
        <HelpCard
          icon={<HelpCircle className="h-5 w-5" />}
          title="3. Confira pendências"
          description="Use Metas e o Assistente de Metas para encontrar clientes sem owner, sem hunter ou com soma divergente."
        />
        <HelpCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="4. Valide baseline"
          description="Use Insights para importar a planilha Financial BU, comparar valores Hunter/Farmer por cliente e aplicar somente divergências marcadas."
        />
      </section>

      <Card className="mt-5 p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Material de apoio</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          O PDF resume o fluxo recomendado para homologação: revisar clientes e pessoas,
          associar metas por pessoa, usar o assistente e consultar relatórios.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Fonte de verdade</p>
            <p className="mt-1">
              A meta do cliente é anual e fica quebrada em Hunter e Renovação + Ampliação. A soma por pessoa deve reconciliar com essa meta.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Cadastro de cliente</p>
            <p className="mt-1">
              No cliente, informe diretor, managers de Delivery, Hunter responsável e metas anuais. Valores por pessoa continuam em Metas por Pessoa.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Insights / planilha</p>
            <p className="mt-1">
              A importação respeita as colunas da planilha: Target RL Hunter e Target RL Farmer. Divergências indicam diferença entre baseline e sistema.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Ano de referência</p>
            <p className="mt-1">
              Use o filtro de ano nas telas financeiras. O ano atual de homologação é 2026.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild><Link href={guideHref} target="_blank"><Download className="h-4 w-4" /> Abrir guia rápido em PDF</Link></Button>
          <Button asChild variant="outline"><Link href="/insights">Ir para Insights</Link></Button>
          <Button asChild variant="outline"><Link href="/relatorio-metas">Ir para relatório de metas</Link></Button>
        </div>
      </Card>
    </>
  );
}

function HelpCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-brq-purple">{icon}</div>
      <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Card>
  );
}
