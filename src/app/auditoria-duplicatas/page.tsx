"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { findTargetAllocationDuplicates } from "@/lib/target-allocation-duplicates";
import { cn, formatCurrency } from "@/lib/utils";

const targetTypeLabels = {
  hunter: "Hunter",
  farmer_renewal: "Renovação + Ampliação",
  studio: "Studio",
};

export default function DuplicateTargetAuditPage() {
  const { areas, targetAllocations, studioTargetAllocations, customers, people } = useDeliveryStore();
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
  const containedStudioGroups = duplicateGroups.filter((group) => group.issueType === "contained_studio_review");
  const missingPersonTargetGroups = duplicateGroups.filter((group) => group.issueType === "studio_without_person_total");
  const duplicateRows = duplicateKeyGroups.reduce((total, group) => total + Math.max(group.items.length - 1, 0), 0)
    + containedStudioGroups.length
    + missingPersonTargetGroups.length;
  const duplicateAmount = duplicateGroups.reduce((total, group) => total + group.duplicateAmount, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Auditoria temporária"
        title="Duplicatas de Metas"
        description="Revise metas repetidas e suspeitas de Studio contido inflando Meta Squads/Times. Esta tela apenas recomenda o que revisar; nenhuma exclusão é feita automaticamente."
      />

      <section className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 text-sm text-slate-700">
        <h2 className="text-base font-bold text-slate-950">Regra usada nesta auditoria</h2>
        <p className="mt-2">
          Em Metas por Pessoa, o valor cadastrado é a meta total atual da pessoa no cliente. Studio Hunter e Studio Manutenção
          são heranças contidas nesse total. Portanto, para relatório e saneamento, a Meta Squads/Times calculada é:
          <strong> meta total cadastrada - Studio herdado</strong>.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <AuditCard label="Chaves duplicadas" value={duplicateKeyGroups.length.toString()} tone={duplicateKeyGroups.length ? "danger" : "ok"} />
        <AuditCard label="Registros a revisar" value={duplicateRows.toString()} tone={duplicateRows ? "danger" : "ok"} />
        <AuditCard label="Valor a revisar" value={formatCurrency(duplicateAmount)} tone={duplicateAmount > 0.01 ? "danger" : "ok"} />
      </section>

      <section className="mt-6 rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Sugestão de saneamento</h2>
            <p className="mt-1 text-sm text-slate-500">
              Duplicata literal mantém a maior linha da chave. Studio contido mostra quando a Meta Squads/Times pode já conter o Studio separado.
              Studio sem meta total mostra valores de Studio que não têm linha correspondente em Metas por Pessoa.
            </p>
          </div>
          <Badge variant={duplicateGroups.length ? "warning" : "success"}>
            {duplicateGroups.length ? "Aguardando confirmação" : "Sem duplicatas"}
          </Badge>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="flex items-start gap-3 p-6 text-sm text-emerald-700">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Nenhuma duplicata ou suspeita de Studio contido encontrada nos dados carregados pelo app.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
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
            a exclusão dos registros suspeitos será feita em uma etapa separada e auditável.
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

function getIssueTypeLabel(issueType: "duplicate_key" | "contained_studio_review" | "studio_without_person_total") {
  if (issueType === "duplicate_key") return "Chave repetida";
  if (issueType === "studio_without_person_total") return "Studio sem meta total";
  return "Studio contido";
}

function getRecommendedActionLabel(action: "keep" | "review_remove" | "review_create") {
  if (action === "keep") return "Manter";
  if (action === "review_create") return "Revisar criação";
  return "Revisar remoção";
}
