import { Bot, Database, Palette, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settings = [
  { icon: Database, title: "Fonte de dados", description: "Supabase com persistência protegida por autenticação e RLS.", status: "Ativo" },
  { icon: Bot, title: "Insights de IA", description: "Funções placeholder disponíveis para capacidade, cobertura e portfólio.", status: "Demonstração" },
  { icon: ShieldCheck, title: "Acesso e governança", description: "Login corporativo, papéis de acesso, RLS e trilha de auditoria.", status: "Ativo" },
  { icon: Palette, title: "Identidade visual", description: "Tema executivo inspirado na identidade BRQ e otimizado para apresentações.", status: "Ativo" },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Visão da arquitetura atual e dos recursos preparados para evolução." />
      <div className="grid gap-5 md:grid-cols-2">
        {settings.map(({ icon: Icon, title, description, status }) => (
          <Card key={title} className="shadow-sm">
            <CardHeader className="flex-row items-start gap-4 space-y-0">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-50 text-brq-purple"><Icon className="h-6 w-6" /></div>
              <div className="flex-1"><CardTitle>{title}</CardTitle><CardDescription className="mt-2 leading-6">{description}</CardDescription></div>
              <Badge variant={status === "Ativo" ? "success" : "secondary"}>{status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                Configuração protegida neste MVP. A camada está documentada para a próxima evolução.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
