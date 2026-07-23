"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { findTargetAllocationDuplicates } from "@/lib/target-allocation-duplicates";
import { useAccess } from "@/lib/access-context";
import { cn, formatCurrency } from "@/lib/utils";

const targetTypeLabels = {
  hunter: "Hunter",
  farmer_renewal: "Renovação + Ampliação",
  studio: "Studio",
};

export default function DuplicateTargetAuditPage() {
  const { areas, targetAllocations, studioTargetAllocations, customers, people, deleteTargetAllocation } = useDeliveryStore();
  const { isAdmin } = useAccess();
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const duplicateGroups = useMemo(
    () => findTargetAllocationDuplicates({
      allocations: targetAllocations,
      customers,
      people,
      studioAllocations: studioTargetAllocations,
      areas,
    }),
    [areas, customers, people, studioTargetAllocations, targetAllocations],
  );
  const duplicateKeyGroups = duplicateGroups.filter((group) => group.issueType === "duplicate_key");
  const missingPersonTargetGroups = duplicateGroups.filter((group) => group.issueType === "studio_without_person_total");
  const duplicateRows = duplicateKeyGroups.reduce((total, group) => total + Math.max(group.items.length - 1, 0), 0);
  const duplicateAmount = duplicateGroups.reduce((total, group) => total + group.duplicateAmount, 0);

  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Acesso restrito"
          title="Auditoria de Metas"
          description="Esta auditoria pode excluir registros físicos e fica disponível somente para administradores."
        />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Você não tem permissão para acessar esta rotina.
        </section>
      </main>
    );
  }

  async function handleDeleteTargetAllocation({
    id,
    customerName,
    personName,
    amount,
  }: {
    id: string;
    customerName: string;
    personName: string;
    amount: number;
  }) {
    const confirmed = window.confirm([
      "Excluir este registro físico de meta?",
      "",
      `Cliente: ${customerName}`,
      `Pessoa: ${personName}`,
      `Valor: ${formatCurrency(amount)}`,
      `ID: ${id}`,
      "",
      "A ação remove apenas esta linha física. Studios contidos e outros registros da mesma chave serão preservados.",
    ].join("\n"));
    if (!confirmed) return;
    setDeletingId(id);
    setNotice(null);
    try {
      await deleteTargetAllocation(id);
      setNotice({ tone: "success", text: "Registro físico excluído. A auditoria foi recalculada com os dados atuais." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Não foi possível excluir o registro físico." });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Auditoria temporária"
        title="Auditoria de Metas"
        description="Revise registros físicos repetidos no grão Cliente + Pessoa + Tipo + Ano e Studios com valor sem meta total correspondente. Nada é removido automaticamente."
      />

      <section className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 text-sm text-slate-700">
        <h2 className="text-base font-bold text-slate-950">Regra usada nesta auditoria</h2>
        <p className="mt-2">
          Em Metas por Pessoa, o valor cadastrado é a meta total atual da pessoa no cliente. Studio Hunter e Studio Manutenção
          são heranças contidas nesse total. Portanto, para relatório e saneamento, a Meta Squads/Times calculada é:
          <strong> meta total cadastrada - Studio herdado</strong>. Essa decomposição normal não é duplicata e não aparece como item a remover.
        </p>
      </section>

      {notice && (
        <section className={cn(
          "mb-6 rounded-2xl border p-4 text-sm font-semibold",
          notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
        )}>
          {notice.text}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <AuditCard label="Chaves duplicadas" value={duplicateKeyGroups.length.toString()} tone={duplicateKeyGroups.length ? "danger" : "ok"} />
        <AuditCard label="Registros físicos repetidos" value={duplicateRows.toString()} tone={duplicateRows ? "danger" : "ok"} />
        <AuditCard label="Studios sem meta total" value={missingPersonTargetGroups.length.toString()} tone={missingPersonTargetGroups.length ? "danger" : "ok"} />
        <AuditCard label="Valor a revisar" value={formatCurrency(duplicateAmount)} tone={duplicateAmount > 0.01 ? "danger" : "ok"} />
      </section>

      <section className="mt-6 rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Sugestão de saneamento</h2>
            <p className="mt-1 text-sm text-slate-500">
              Duplicata literal mantém a maior linha da chave como sugestão inicial, mas você pode escolher qual registro físico excluir.
              Studio sem meta total é tratado como pendência de cadastro, não como duplicata.
            </p>
          </div>
          <Badge variant={duplicateGroups.length ? "warning" : "success"}>
            {duplicateGroups.length ? "Aguardando confirmação" : "Sem duplicatas"}
          </Badge>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="flex items-start gap-3 p-6 text-sm text-emerald-700">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Nenhuma duplicata física ou Studio sem meta total encontrada nos dados carregados pelo app.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead className="text-right">Meta total cadastrada</TableHead>
                  <TableHead className="text-right">Studio herdado / excesso</TableHead>
                  <TableHead className="text-right">Squads/Times calculado</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead className="text-right">Atuar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicateGroups.map((group) => (
                  <TableRow key={group.key} className="align-top">
                    <TableCell>
                      <p className="font-bold text-slate-950">{group.customerName}</p>
                      <p className="mt-1 text-xs text-slate-400">{group.customerId}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{group.personName}</p>
                      <p className="mt-1 text-xs text-slate-400">{group.personId}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.issueType === "duplicate_key" ? "warning" : "destructive"}>
                        {getIssueTypeLabel(group.issueType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{targetTypeLabels[group.targetType]}</TableCell>
                    <TableCell>{group.year}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(group.totalAmount)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-red-700">{formatCurrency(group.duplicateAmount)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-700">{formatCurrency(group.suggestedAmount)}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div key={item.id} className={cn(
                            "rounded-xl border p-3",
                            item.recommendedAction === "keep" ? "border-emerald-100 bg-emerald-50/70" : "border-amber-100 bg-amber-50/70",
                          )}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="break-all font-mono text-xs text-slate-600">{item.id}</span>
                              <Badge variant={item.recommendedAction === "keep" ? "success" : "warning"}>
                                {getRecommendedActionLabel(item.recommendedAction)}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span>Atual: <strong>{formatCurrency(item.amount)}</strong></span>
                              <span>Squads/Times: <strong>{formatCurrency(item.ownAmount ?? item.amount)}</strong></span>
                              {group.containedStudioAmount !== undefined && <span>Studio contido: <strong>{formatCurrency(group.containedStudioAmount)}</strong></span>}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">{item.reason}</p>
                            {item.notes && <p className="mt-1 text-xs text-slate-400">{item.notes}</p>}
                          </div>
                        ))}
                        {group.containedStudioItems?.map((item) => (
                          <div key={`${group.key}:${item.id ?? item.areaId}`} className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800">{item.areaName}</span>
                              <Badge variant="secondary">Registro de Studio</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span>ID: <strong className="font-mono">{item.id ?? item.areaId}</strong></span>
                              <span>Valor herdado: <strong>{formatCurrency(item.amount)}</strong></span>
                              <span>Hunter: <strong>{formatCurrency(item.hunterAmount)}</strong></span>
                              <span>Manutenção: <strong>{formatCurrency(item.maintenanceAmount)}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/metas-pessoas?personId=${encodeURIComponent(group.personId)}&customerId=${encodeURIComponent(group.customerId)}&year=${group.year}`}>
                            <ExternalLink className="h-4 w-4" />
                            Abrir metas
                          </Link>
                        </Button>
                        {group.issueType === "studio_without_person_total" && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/metas-studios?customerId=${encodeURIComponent(group.customerId)}&year=${group.year}`}>
                              <ExternalLink className="h-4 w-4" />
                              Abrir studios
                            </Link>
                          </Button>
                        )}
                        {group.issueType === "duplicate_key" && group.items.map((item) => (
                          <Button
                            key={`delete:${item.id}`}
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === item.id}
                            onClick={() => void handleDeleteTargetAllocation({
                              id: item.id,
                              customerName: group.customerName,
                              personName: group.personName,
                              amount: item.amount,
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingId === item.id ? "Excluindo..." : "Excluir registro"}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {duplicateGroups.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Confirme visualmente estes grupos antes da limpeza. A proteção contra novas duplicatas deve ficar no banco;
            use os botões apenas quando tiver certeza de qual registro físico deve sair.
          </p>
        </div>
      )}
    </main>
  );
}

function AuditCard({ label, value, tone }: { label: string; value: string; tone: "ok" | "danger" }) {
  return (
    <div className={cn(
      "rounded-2xl border bg-white p-5 shadow-sm",
      tone === "danger" ? "border-red-100 bg-red-50/40" : "border-emerald-100 bg-emerald-50/30",
    )}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 break-words text-3xl font-black tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function getIssueTypeLabel(issueType: "duplicate_key" | "studio_without_person_total") {
  if (issueType === "duplicate_key") return "Chave repetida";
  return "Studio sem meta total";
}

function getRecommendedActionLabel(action: "keep" | "review_remove" | "review_create") {
  if (action === "keep") return "Manter";
  if (action === "review_create") return "Revisar criação";
  return "Revisar remoção";
}
