import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  HelpCircle,
  Target,
  UsersRound,
} from "lucide-react";
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
        description="Guia prático para cadastrar dados, ajustar metas e validar divergências no BRQ Delivery Coverage Hub."
        actions={
          <Button asChild>
            <Link href={guideHref} target="_blank">
              <Download className="h-4 w-4" /> Baixar PDF
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HelpCard
          icon={<UsersRound className="h-5 w-5" />}
          title="1. Organize as pessoas"
          description="Cadastre ou revise perfis em Pessoas para manter papéis, clientes associados e responsabilidades atualizados antes de ajustar metas."
        />
        <HelpCard
          icon={<Target className="h-5 w-5" />}
          title="2. Defina metas por cliente"
          description="Em Clientes, informe a meta anual quebrada em Hunter, Renovação + Ampliação e Áreas / Studios; em Metas por Pessoa, distribua os valores por pessoa e ano."
        />
        <HelpCard
          icon={<HelpCircle className="h-5 w-5" />}
          title="3. Revise pendências"
          description="Use a tela de Metas e o Assistente de metas para localizar clientes sem owner, sem hunter ou com diferença entre o total e a meta."
        />
        <HelpCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="4. Valide a baseline"
          description="Use Insights para importar a planilha Financial BU, comparar valores por cliente e aplicar somente as divergências marcadas."
        />
      </section>

      <Card className="mt-5 p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Como começar</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          O fluxo mais eficiente é seguir em ordem: organizar pessoas, associar
          metas, revisar inconsistências e validar a baseline com Insights.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Fonte de verdade</p>
            <p className="mt-1">
              A meta do cliente é anual e fica quebrada em Hunter, Renovação +
              Ampliação e Áreas / Studios. A soma por pessoa deve reconciliar
              com essa meta.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Cadastro de cliente</p>
            <p className="mt-1">
              No cliente, informe diretor, managers de Delivery, Hunter
              responsável e as metas anuais por componente. Valores por pessoa
              continuam em Metas por Pessoa.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Insights / planilha</p>
            <p className="mt-1">
              A importação respeita as colunas da planilha: Target RL Hunter,
              Target RL Farmer e, quando existir, Áreas / Studios. Se a terceira
              coluna não existir, o sistema calcula a diferença do total.
            </p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Ano de referência</p>
            <p className="mt-1">
              Use o filtro de ano nas telas financeiras. O ano atual de
              homologação é 2026.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Checklist rápido</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Confirme pessoas, papéis e responsáveis antes de começar.</li>
              <li>Cadastre a meta anual do cliente em Clientes.</li>
              <li>
                Distribua Hunter, Renovação + Ampliação e Áreas / Studios em
                Metas por Pessoa.
              </li>
              <li>Use o Assistente de metas para revisar inconsistências.</li>
              <li>
                Valide divergências e aplique somente as marcadas em Insights.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="font-bold text-slate-900">Perguntas frequentes</p>
            <div className="mt-2 space-y-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">
                  O e-mail é obrigatório para cadastrar uma pessoa?
                </p>
                <p className="mt-1">
                  Não. O cadastro funciona sem e-mail, desde que o nome e o
                  papel estejam definidos.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  O que fazer quando a soma por pessoa não fecha com a meta do
                  cliente?
                </p>
                <p className="mt-1">
                  Revise a distribuição em Metas por Pessoa e use o Assistente
                  de metas para localizar a divergência.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  Quando vale a pena abrir o PDF de apoio?
                </p>
                <p className="mt-1">
                  Sempre que houver dúvida sobre o fluxo recomendado ou quando
                  for necessário revisar o roteiro de homologação.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={guideHref} target="_blank">
              <Download className="h-4 w-4" /> Abrir guia rápido em PDF
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/insights">Abrir Insights</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/relatorio-metas">Abrir relatório de metas</Link>
          </Button>
        </div>
      </Card>
    </>
  );
}

function HelpCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-brq-purple">
        {icon}
      </div>
      <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Card>
  );
}
