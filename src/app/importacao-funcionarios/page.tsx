"use client";

import { CheckCircle2, FileCheck2, FileSpreadsheet, LoaderCircle, ShieldAlert, Upload, UsersRound, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  EmployeeImportApplyAllResult,
  EmployeeImportHeadcountResult,
  EmployeeImportPreview,
  EmployeeImportSalaryActionResult,
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
  const [applyingAll, setApplyingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingPersonId, setUpdatingPersonId] = useState("");
  const [unmatchedSearch, setUnmatchedSearch] = useState("");
  const [history, setHistory] = useState<Array<{ id: string; sourceFileName: string; sourceRowCount: number; status: string; createdAt: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
  const filteredUnmatchedPeople = useMemo(() => {
    const query = unmatchedSearch.trim().toLowerCase();
    if (!query) return preview?.unmatchedPeople ?? [];
    return (preview?.unmatchedPeople ?? []).filter((person) =>
      person.sourceName.toLowerCase().includes(query)
      || translateUnmatchedReason(person.reason).toLowerCase().includes(query),
    );
  }, [preview?.unmatchedPeople, unmatchedSearch]);

  useEffect(() => {
    if (!allowed) return;
    let mounted = true;
    sendJson<{ batches: Array<{ id: string; sourceFileName: string; sourceRowCount: number; status: string; createdAt: string }> }>("/api/admin/employee-import/history", { method: "GET" })
      .then((historyData) => {
        if (!mounted) return;
        setHistory(historyData.batches ?? []);
      })
      .catch((historyError) => {
        if (mounted) setError(getErrorMessage(historyError, "Não foi possível carregar o histórico de importação."));
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false);
      });

    sendJson<EmployeeImportPreview | null>("/api/admin/employee-import/preview", { method: "GET" })
      .then((saved) => {
        if (!mounted || !saved) return;
        setPreview(saved);
        setManagerMappings(Object.fromEntries(
          saved.managers
            .filter((manager) => manager.resolvedManagerId)
            .map((manager) => [manager.sourceKey, manager.resolvedManagerId as string]),
        ));
      })
      .catch((loadError) => {
        if (mounted) setError(getErrorMessage(loadError, "Não foi possível recuperar o último lote."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [allowed]);

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

  async function handleConfirmHeadcount() {
    if (!preview?.batchId) return;
    if (unresolvedManagerCount > 0) {
      setError("Resolva todos os gestores sem correspondência antes de confirmar.");
      return;
    }
    const confirmed = window.confirm(
      `Confirmar o HC direto de ${managerTotals.length} pessoa(s) e salvar ${resolvedManagers.length} de-para(s)?`,
    );
    if (!confirmed) return;

    setApplying(true);
    setError("");
    setNotice("");
    try {
      const nextResult = await sendJson<EmployeeImportHeadcountResult>(
        "/api/admin/employee-import/headcount",
        {
          method: "POST",
          body: {
            batchId: preview.batchId,
            mappings: resolvedManagers.map((manager) => ({
              sourceKey: manager.sourceKey,
              sourceName: manager.sourceName,
              personId: manager.resolvedManagerId as string,
              employeeCount: manager.employeeCount,
            })),
          },
        },
      );
      setNotice(
        `HC direto atualizado para ${nextResult.headcountsUpdated} pessoa(s).`,
      );
      setPreview((current) => current ? { ...current, batchStatus: "hc_confirmed" } : current);
    } catch (applyError) {
      setError(getErrorMessage(applyError, "Não foi possível aplicar a importação."));
    } finally {
      setApplying(false);
    }
  }

  async function handleApplySalary(personId: string) {
    if (!preview?.batchId) return;
    if (!window.confirm("Atualizar o salário desta pessoa com o valor da planilha?")) return;
    setUpdatingPersonId(personId);
    setError("");
    try {
      const action = await sendJson<EmployeeImportSalaryActionResult>(
        "/api/admin/employee-import/apply",
        { method: "POST", body: { batchId: preview.batchId, personId } },
      );
      setPreview((current) => current ? {
        ...current,
        matchedPeople: current.matchedPeople.map((person) =>
          person.personId === action.personId ? { ...person, status: "updated" } : person
        ),
      } : current);
      setNotice("Salário atualizado e marcado como concluído.");
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Não foi possível atualizar o salário."));
    } finally {
      setUpdatingPersonId("");
    }
  }

  async function handleApplyAll() {
    if (!preview?.batchId) return;
    const salaryChanges = preview.matchedPeople.filter((person) => person.status === "change").length;
    const confirmed = window.confirm(
      `Efetivar ${salaryChanges} atualização(ões) de salário e ${resolvedManagers.length} de-para(s) de gestor?`,
    );
    if (!confirmed) return;
    setApplyingAll(true);
    setApplying(true);
    setError("");
    setNotice("");
    try {
      const nextResult = await sendJson<EmployeeImportApplyAllResult>("/api/admin/employee-import/apply-all", {
        method: "POST",
        body: {
          batchId: preview.batchId,
          mappings: resolvedManagers.map((manager) => ({
            sourceKey: manager.sourceKey,
            sourceName: manager.sourceName,
            personId: manager.resolvedManagerId as string,
            employeeCount: manager.employeeCount,
          })),
          managerMappings: managerMappings,
        },
      });
      setNotice(
        `Efetivado: ${nextResult.salaryResults.length} salário(s) e ${nextResult.headcountResult.headcountsUpdated} HC(s).`,
      );
      setPreview((current) => {
        if (!current) return current;
        const updatedPeople = current.matchedPeople.map((person) => {
          const changed = nextResult.salaryResults.find((item) => item.personId === person.personId);
          return changed ? { ...person, status: "updated" as const } : person;
        });
        return {
          ...current,
          matchedPeople: updatedPeople,
          batchStatus: nextResult.headcountResult.status,
        };
      });
    } catch (applyError) {
      setError(getErrorMessage(applyError, "Não foi possível efetivar as alterações."));
    } finally {
      setApplyingAll(false);
      setApplying(false);
    }
  }

  async function retakeBatch(batchId: string) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const nextPreview = await sendJson<EmployeeImportPreview>("/api/admin/employee-import/batch", {
        method: "GET",
        body: undefined,
      }, { batchId });
      setPreview(nextPreview);
      setManagerMappings(Object.fromEntries(
        nextPreview.managers
          .filter((manager) => manager.resolvedManagerId)
          .map((manager) => [manager.sourceKey, manager.resolvedManagerId as string]),
      ));
      setNotice(`Lote retomado: ${nextPreview.sourceFileName}`);
    } catch (retakeError) {
      setError(getErrorMessage(retakeError, "Não foi possível retomar o lote selecionado."));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setManagerMappings({});
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
            <CardTitle>Histórico de importação</CardTitle>
            <CardDescription>Retome um lote recente sem reenviar o arquivo.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando histórico...
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum lote recente encontrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium text-slate-900">{batch.sourceFileName}</TableCell>
                        <TableCell className="text-right tabular-nums">{batch.sourceRowCount.toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant={batch.status === "hc_confirmed" ? "success" : "warning"}>
                            {batch.status === "hc_confirmed" ? "HC confirmado" : "Em conciliação"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {batch.createdAt ? new Date(batch.createdAt).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="secondary" onClick={() => retakeBatch(batch.id)}>
                            Retomar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-brq-purple">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Selecionar planilha</CardTitle>
                <CardDescription className="mt-1">
                  Formato `.xlsx`, até 10 MB. A análise salva o lote para você continuar depois sem reenviar o arquivo.
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
                {file ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                ) : null}
              </div>
              <Button type="button" onClick={handlePreview} disabled={!file || loading || applying}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                {loading ? "Analisando..." : "Analisar planilha"}
              </Button>
            </div>
            {loading ? (
              <p className="mt-2 text-xs text-slate-500">
                Planilhas grandes podem levar alguns segundos. O lote é salvo automaticamente e você pode continuar depois.
              </p>
            ) : null}
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
            <p className="text-sm text-slate-500">
              Lote salvo: <strong>{preview.sourceFileName}</strong>
              {preview.batchStatus === "hc_confirmed" ? " · HC confirmado" : " · Em conciliação"}
            </p>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>De-para de gestores</CardTitle>
                <CardDescription>
                  A contagem vem da coluna Gestor. O combo contém todas as pessoas cadastradas; isso não altera a hierarquia individual.
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
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      {preview.matchedPeople.some((person) => person.currentSalary === null)
                        ? "Há pessoas sem salário atual cadastrado. Nesses casos, a atualização será uma inclusão."
                        : "Todos os registros below já possuem salário atual."}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleApplyAll}
                      disabled={applyingAll || applying || loading || unresolvedManagerCount > 0 || preview.batchStatus === "hc_confirmed"}
                    >
                      {applyingAll ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                      Atualizar tudo
                    </Button>
                  </div>
                  <div className="max-h-[480px] overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pessoa</TableHead>
                          <TableHead className="text-right">Atual</TableHead>
                          <TableHead className="text-right">Planilha</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
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
                            <TableCell>
                              <Badge variant={person.status === "change" ? "warning" : "success"}>
                                {person.status === "change" ? "Pendente" : person.status === "updated" ? "Atualizado" : "Já igual"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {person.status === "change" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void handleApplySalary(person.personId)}
                                  disabled={Boolean(updatingPersonId)}
                                >
                                  {updatingPersonId === person.personId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Atualizar salário"}
                                </Button>
                              ) : person.status === "updated" ? (
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" /> Atualizado
                                </span>
                              ) : null}
                            </TableCell>
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
                  <div className="mb-3">
                    <Input
                      placeholder="Buscar por nome ou motivo..."
                      value={unmatchedSearch}
                      onChange={(event) => setUnmatchedSearch(event.target.value)}
                    />
                  </div>
                  <div className="max-h-[480px] overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome na planilha</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead className="text-right">Correspondências no sistema</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUnmatchedPeople.slice(0, visibleUnmatchedLimit).map((person, index) => (
                          <TableRow key={`${person.sourceName}-${index}`}>
                            <TableCell className="font-medium text-slate-900">{person.sourceName}</TableCell>
                            <TableCell>{translateUnmatchedReason(person.reason)}</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-500">
                              {person.matchesCount == null ? "—" : `${person.matchesCount} registro(s)`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {(preview.unmatchedPeople.length > visibleUnmatchedLimit || filteredUnmatchedPeople.length === 0) && (
                    <p className="mt-3 text-sm text-slate-500">
                      {filteredUnmatchedPeople.length === 0
                        ? "Nenhum resultado para o filtro atual."
                        : `Exibindo as primeiras ${visibleUnmatchedLimit} de ${preview.unmatchedPeople.length} pessoas não atualizadas.`}
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
                    <p className="font-semibold text-slate-900">Confirmar HC direto conciliado</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Esta ação salva os de-paras e atualiza o campo HC direto das pessoas selecionadas. Salários são atualizados separadamente, linha a linha, ou todos de uma vez pelo botão abaixo.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={handleConfirmHeadcount} disabled={applying || loading || unresolvedManagerCount > 0 || preview.batchStatus === "hc_confirmed"}>
                    {applying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                    {preview.batchStatus === "hc_confirmed" ? "HC confirmado" : "Confirmar HC"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleApplyAll}
                    disabled={applyingAll || applying || loading || unresolvedManagerCount > 0 || preview.batchStatus === "hc_confirmed"}
                  >
                    {applyingAll ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                    Efetivar tudo
                  </Button>
                </div>
              </CardContent>
            </Card>

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

async function sendWorkbook<T>(endpoint: string, file: File) {
  const authService = createAuthServiceSelection().service;
  if (!authService) throw new Error("O provedor de autenticação não está configurado.");
  const token = await authService.getAccessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

  const formData = new FormData();
  formData.set("file", file);
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

async function sendJson<T>(
  endpoint: string,
  options: { method: "GET" | "POST"; body?: unknown },
  searchParams?: Record<string, string>,
) {
  const authService = createAuthServiceSelection().service;
  if (!authService) throw new Error("O provedor de autenticação não está configurado.");
  const token = await authService.getAccessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  const url = new URL(endpoint, window.location.origin);
  if (options.method === "GET" && searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url.toString(), {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "error" in payload
      ? String(payload.error ?? "Não foi possível concluir a ação.")
      : "Não foi possível concluir a ação.");
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
