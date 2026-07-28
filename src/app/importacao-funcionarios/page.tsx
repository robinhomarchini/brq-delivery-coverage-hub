"use client";

import { FileCheck2, FileSpreadsheet, LoaderCircle, ShieldAlert, Upload, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  EmployeeImportApplyResult,
  EmployeeImportPreview,
} from "@/lib/employee-import/types";
import { useAccess } from "@/lib/access-context";
import { canManageCompensation } from "@/lib/compensation-access";
import { createAuthServiceSelection } from "@/lib/auth/auth-service";
import { useDeliveryStore } from "@/store/delivery-store";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const visibleUnmatchedLimit = 100;

export default function EmployeeImportPage() {
  const { accessUser, loadingAccess } = useAccess();
  const { people, loading: loadingData } = useDeliveryStore();
  const allowed = canManageCompensation(accessUser, people);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [managerMappings, setManagerMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<EmployeeImportApplyResult | null>(null);

  const resolvedManagers = useMemo(() => {
    if (!preview) return [];
    const optionById = new Map(preview.availableManagers.map((manager) => [manager.id, manager]));
    return preview.managers.map((manager) => {
      const mappedId = managerMappings[manager.sourceKey] ?? manager.resolvedManagerId ?? "";
      const mapped = optionById.get(mappedId);
      return {
        ...manager,
        resolvedManagerId: mapped?.id ?? null,
        resolvedManagerName: mapped?.name ?? null,
      };
    });
  }, [managerMappings, preview]);

  const unresolvedManagerCount = resolvedManagers.filter((manager) => !manager.resolvedManagerId).length;
  const managerTotals = useMemo(() => {
    const totals = new Map<string, {
      managerId: string;
      managerName: string;
      employeeCount: number;
      sources: string[];
    }>();
    for (const manager of resolvedManagers) {
      if (!manager.resolvedManagerId || !manager.resolvedManagerName) continue;
      const current = totals.get(manager.resolvedManagerId);
      totals.set(manager.resolvedManagerId, {
        managerId: manager.resolvedManagerId,
        managerName: manager.resolvedManagerName,
        employeeCount: (current?.employeeCount ?? 0) + manager.employeeCount,
        sources: [...(current?.sources ?? []), manager.sourceName],
      });
    }
    return [...totals.values()].sort((first, second) =>
      second.employeeCount - first.employeeCount
      || first.managerName.localeCompare(second.managerName, "pt-BR")
    );
  }, [resolvedManagers]);

  if (loadingAccess || loadingData) {
    return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-brq-purple" /></div>;
  }

  if (!allowed) {
    return (
      <>
        <PageHeader
          eyebrow="Administração"
          title="Importação de funcionários"
          description="Atualização protegida de salários e conciliação de gestores."
        />
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Acesso restrito</p>
              <p className="mt-1 leading-6">Somente administradores autorizados a consultar remuneração podem executar esta importação.</p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  async function handlePreview() {
    if (!file) {
      setError("Selecione uma planilha .xlsx.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const nextPreview = await sendWorkbook<EmployeeImportPreview>(
        "/api/admin/employee-import/preview",
        file,
      );
      setPreview(nextPreview);
      setManagerMappings(Object.fromEntries(
        nextPreview.managers
          .filter((manager) => manager.resolvedManagerId)
          .map((manager) => [manager.sourceKey, manager.resolvedManagerId as string]),
      ));
    } catch (previewError) {
      setError(getErrorMessage(previewError, "Não foi possível analisar a planilha."));
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!file || !preview) return;
    if (unresolvedManagerCount > 0) {
      setError("Resolva todos os gestores sem correspondência antes de confirmar.");
      return;
    }
    const confirmed = window.confirm(
      `Confirmar a atualização de ${preview.summary.salaryChanges} salário(s) e salvar ${resolvedManagers.length} de-para(s) de gestor?`,
    );
    if (!confirmed) return;

    setApplying(true);
    setError("");
    setNotice("");
    try {
      const nextResult = await sendWorkbook<EmployeeImportApplyResult>(
        "/api/admin/employee-import/apply",
        file,
        Object.fromEntries(
          resolvedManagers.map((manager) => [manager.sourceKey, manager.resolvedManagerId as string]),
        ),
      );
      setResult(nextResult);
      setNotice(
        `${nextResult.salariesChanged} salário(s) atualizado(s), ${nextResult.salariesUnchanged} mantido(s) e ${nextResult.managerMappingsSaved} de-para(s) salvo(s).`,
      );
      const refreshed = await sendWorkbook<EmployeeImportPreview>(
        "/api/admin/employee-import/preview",
        file,
      );
      setPreview(refreshed);
      setManagerMappings(Object.fromEntries(
        refreshed.managers
          .filter((manager) => manager.resolvedManagerId)
          .map((manager) => [manager.sourceKey, manager.resolvedManagerId as string]),
      ));
    } catch (applyError) {
      setError(getErrorMessage(applyError, "Não foi possível aplicar a importação."));
    } finally {
      setApplying(false);
    }
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setManagerMappings({});
    setResult(null);
    setNotice("");
    setError("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Importação de funcionários"
        description="Compare a planilha antes de atualizar salários e concilie gestores externos com a estrutura atual."
      />
      {notice && <SuccessNotice message={notice} floating />}
      {error && <ErrorNotice message={error} floating onClose={() => setError("")} />}

      <div className="space-y-5">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-brq-purple">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Selecionar planilha</CardTitle>
                <CardDescription className="mt-1">
                  Formato `.xlsx`, até 10 MB, com as colunas Nome, Salário e Gestor. Nenhum dado é alterado durante a prévia.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="employee-import-file" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Arquivo
                </label>
                <Input
                  id="employee-import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="button" onClick={handlePreview} disabled={!file || loading || applying}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Analisar planilha
              </Button>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da importação">
              <SummaryCard label="Linhas na planilha" value={preview.sourceRowCount} tone="default" />
              <SummaryCard label="Salários a atualizar" value={preview.summary.salaryChanges} tone="purple" />
              <SummaryCard label="Salários já iguais" value={preview.summary.salariesUnchanged} tone="success" />
              <SummaryCard label="Pessoas não atualizadas" value={preview.unmatchedPeople.length} tone="warning" />
              <SummaryCard label="Gestores sem de-para" value={unresolvedManagerCount} tone={unresolvedManagerCount ? "danger" : "success"} />
            </section>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>De-para de gestores</CardTitle>
                <CardDescription>
                  A contagem vem da coluna Gestor. Selecione um gestor atual para cada nome não reconhecido; isso não altera a hierarquia das pessoas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gestor na planilha</TableHead>
                        <TableHead className="text-right">Colaboradores</TableHead>
                        <TableHead>Gestor atual do sistema</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedManagers.map((manager) => (
                        <TableRow key={manager.sourceKey}>
                          <TableCell className="font-medium text-slate-900">{manager.sourceName}</TableCell>
                          <TableCell className="text-right font-semibold">{manager.employeeCount}</TableCell>
                          <TableCell className="min-w-[280px]">
                            <Select
                              aria-label={`De-para para ${manager.sourceName}`}
                              value={manager.resolvedManagerId ?? ""}
                              onChange={(event) => setManagerMappings((current) => ({
                                ...current,
                                [manager.sourceKey]: event.target.value,
                              }))}
                            >
                              <option value="">Selecione um gestor</option>
                              {preview.availableManagers.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={manager.resolvedManagerId ? "success" : "destructive"}>
                              {manager.resolvedManagerId ? translateResolution(manager.resolution) : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.rowsWithoutManager > 0 && (
                  <p className="text-sm text-amber-700">{preview.rowsWithoutManager} linha(s) estão sem gestor informado e não entram no de-para.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <UsersRound className="h-5 w-5 text-brq-purple" />
                  <div>
                    <CardTitle>Colaboradores por gestor conciliado</CardTitle>
                    <CardDescription>Totais recalculados conforme as escolhas acima.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gestor atual</TableHead>
                        <TableHead className="text-right">Colaboradores</TableHead>
                        <TableHead>Nomes consolidados da planilha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managerTotals.map((manager) => (
                        <TableRow key={manager.managerId}>
                          <TableCell className="font-semibold text-slate-900">{manager.managerName}</TableCell>
                          <TableCell className="text-right text-lg font-bold">{manager.employeeCount}</TableCell>
                          <TableCell className="max-w-xl text-sm text-slate-500">{manager.sources.join(", ")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Salários encontrados</CardTitle>
                  <CardDescription>Somente estas pessoas podem receber atualização.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[480px] overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pessoa</TableHead>
                          <TableHead className="text-right">Atual</TableHead>
                          <TableHead className="text-right">Planilha</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.matchedPeople.map((person) => (
                          <TableRow key={person.personId}>
                            <TableCell>
                              <p className="font-medium text-slate-900">{person.personName}</p>
                              {person.sourceName !== person.personName && <p className="text-xs text-slate-400">Origem: {person.sourceName}</p>}
                            </TableCell>
                            <TableCell className="text-right">{person.currentSalary === null ? "Não informado" : formatCurrency(person.currentSalary)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(person.proposedSalary)}</TableCell>
                            <TableCell><Badge variant={person.status === "change" ? "warning" : "success"}>{person.status === "change" ? "Atualizar" : "Mantido"}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Pessoas não atualizadas</CardTitle>
                  <CardDescription>Ausentes, ambíguas ou sem salário válido permanecem como estão no sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[480px] overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome na planilha</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.unmatchedPeople.slice(0, visibleUnmatchedLimit).map((person, index) => (
                          <TableRow key={`${person.sourceName}-${index}`}>
                            <TableCell className="font-medium text-slate-900">{person.sourceName}</TableCell>
                            <TableCell>{translateUnmatchedReason(person.reason)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.unmatchedPeople.length > visibleUnmatchedLimit && (
                    <p className="mt-3 text-sm text-slate-500">
                      Exibindo as primeiras {visibleUnmatchedLimit} de {preview.unmatchedPeople.length} pessoas não atualizadas.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-purple-200 bg-purple-50/50 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-brq-purple" />
                  <div>
                    <p className="font-semibold text-slate-900">Confirmar importação revisada</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Serão alterados apenas os salários encontrados. Pessoas ausentes e valores inválidos continuarão intactos.
                    </p>
                  </div>
                </div>
                <Button type="button" onClick={handleApply} disabled={applying || loading || unresolvedManagerCount > 0}>
                  {applying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                  Confirmar atualização
                </Button>
              </CardContent>
            </Card>

            {result && <p className="sr-only">Importação concluída com sucesso.</p>}
          </>
        )}
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "purple" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "border-slate-200 bg-white text-slate-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <Card className={colors[tone]}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-65">{label}</p>
        <p className="mt-2 text-3xl font-black">{value.toLocaleString("pt-BR")}</p>
      </CardContent>
    </Card>
  );
}

async function sendWorkbook<T>(endpoint: string, file: File, managerMappings?: Record<string, string>) {
  const authService = createAuthServiceSelection().service;
  if (!authService) throw new Error("O provedor de autenticação não está configurado.");
  const token = await authService.getAccessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

  const formData = new FormData();
  formData.set("file", file);
  if (managerMappings) formData.set("managerMappings", JSON.stringify(managerMappings));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const payload = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "error" in payload
      ? String(payload.error ?? "Não foi possível processar a planilha.")
      : "Não foi possível processar a planilha.");
  }
  return payload as T;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function translateResolution(resolution: string) {
  if (resolution === "saved") return "De-para salvo";
  if (resolution === "exact") return "Correspondência exata";
  if (resolution === "manual") return "Selecionado";
  return "Resolvido";
}

function translateUnmatchedReason(reason: string) {
  if (reason === "invalid_salary") return "Salário vazio ou inválido";
  if (reason === "ambiguous") return "Nome duplicado ou ambíguo";
  return "Pessoa não encontrada";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
