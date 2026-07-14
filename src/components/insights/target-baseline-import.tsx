"use client";

import { AlertTriangle, FileSpreadsheet, Info, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Customer } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { useDeliveryStore } from "@/store/delivery-store";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import {
  buildTargetBaselineComparisons,
  parseTargetBaselineRows,
  type TargetBaselineComparison,
  type TargetBaselineRow,
} from "@/lib/target-baseline-import";
import { buildStudioCurveBaselineSnapshotInput, parseCurveStudioBaselineRows } from "@/lib/studio-curve-baseline-snapshot";
import { readXlsxSheetRows } from "@/lib/xlsx-reader";
import { cn, formatCurrency } from "@/lib/utils";

const currentYear = defaultTargetYear;
const maxFileSizeInBytes = 5 * 1024 * 1024;
type ImportProgress = {
  step: number;
  totalSteps: number;
  label: string;
  detail: string;
};

const importProgressTotalSteps = 6;

export function TargetBaselineImport() {
  const {
    areas,
    customers,
    customerTargets,
    people,
    studioTargetAllocations,
    targetAllocations,
    saveCustomers,
    saveStudioBaselineSnapshot,
  } = useDeliveryStore();
  const [year, setYear] = useState(currentYear);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<TargetBaselineRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importElapsedSeconds, setImportElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, currentYear), [customerTargets]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const comparisons = useMemo(
    () => buildTargetBaselineComparisons(rows, yearCustomers, people, targetAllocations, studioTargetAllocations, year),
    [people, rows, studioTargetAllocations, targetAllocations, year, yearCustomers],
  );
  const selectableComparisons = comparisons.filter(canApplyComparison);
  const selectedComparisons = comparisons.filter((comparison) => selectedKeys.has(comparison.key) && canApplyComparison(comparison));
  const divergentCount = comparisons.filter((comparison) => comparison.valueStatus === "different").length;
  const hunterWarnings = comparisons.filter((comparison) => comparison.hunterStatus === "warning").length;
  const missingCustomers = comparisons.filter((comparison) => comparison.valueStatus === "missing_customer").length;
  const invalidTotals = comparisons.filter((comparison) => comparison.valueStatus === "invalid_total").length;

  useEffect(() => {
    if (!loading) return undefined;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setImportElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setImportProgress(null);
    setImportElapsedSeconds(0);
    setError("");
    setSuccess("");
    setSelectedKeys(new Set());

    try {
      if (file.size > maxFileSizeInBytes) {
        throw new Error("Arquivo maior que 5 MB. Use uma planilha menor para homologação.");
      }
      await updateImportProgress(setImportProgress, 1, "Lendo baseline de clientes", "Abrindo a aba Resumo RL 2026 da Curva principal.");
      const fileBuffer = await file.arrayBuffer();
      const spreadsheetRows = readTargetBaselineSheet(fileBuffer);
      await updateImportProgress(setImportProgress, 2, "Interpretando clientes", "Normalizando clientes, Hunter, Farmer e Total RL 2026.");
      const parsedRows = parseTargetBaselineRows(spreadsheetRows);
      await updateImportProgress(setImportProgress, 3, "Lendo abertura de Studios", "Abrindo a aba Sheet1 para extrair BU Financial por Studio/Habilitador.");
      const curveStudioRows = readCurveStudioRows(fileBuffer);
      await updateImportProgress(setImportProgress, 4, "Comparando com cadastro", "Calculando diferenças contra clientes, metas e alocações atuais.");
      const parsedComparisons = buildTargetBaselineComparisons(
        parsedRows,
        yearCustomers,
        people,
        targetAllocations,
        studioTargetAllocations,
        year,
      );
      await updateImportProgress(setImportProgress, 5, "Gerando baseline de Studios", "Montando a foto geral de Studios a partir da Curva principal.");
      const studioSnapshot = buildStudioCurveBaselineSnapshotInput({
        curveStudioRows,
        comparisons: parsedComparisons,
        customers: yearCustomers,
        areas,
        studioTargetAllocations,
        year,
        fileName: file.name,
      });
      if (studioSnapshot) {
        await updateImportProgress(setImportProgress, 6, "Salvando foto de Studios", "Persistindo a última foto para o Comparativo Baseline.");
        await saveStudioBaselineSnapshot(studioSnapshot);
      } else {
        await updateImportProgress(setImportProgress, 6, "Finalizando importação", "Nenhuma linha BU Financial de Studio foi encontrada para salvar.");
      }
      setRows(parsedRows);
      setFileName(file.name);
      setSuccess(studioSnapshot
        ? `${parsedRows.length} cliente(s) lido(s). A foto geral de Studios foi atualizada pelo Sheet1 da Curva principal.`
        : `${parsedRows.length} cliente(s) lido(s) da planilha. Não havia linhas BU Financial em Sheet1 para criar a foto geral de Studios.`);
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (error) {
      setRows([]);
      setFileName("");
      setError(getImportErrorMessage(error));
    } finally {
      setLoading(false);
      setImportElapsedSeconds(0);
      window.setTimeout(() => setImportProgress(null), 1200);
      event.target.value = "";
    }
  }

  function selectAllDivergences() {
    setSelectedKeys(new Set(selectableComparisons.map((comparison) => comparison.key)));
  }

  function toggleSelection(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applySelectedUpdates() {
    if (!selectedComparisons.length) return;
    setApplying(true);
    setError("");
    setSuccess("");

    try {
      const updates = selectedComparisons
        .map((comparison) => comparison.updateCandidate)
        .filter((customer): customer is Customer => Boolean(customer));
      await saveCustomers(updates, year);
      setSelectedKeys(new Set());
      setSuccess(`${updates.length} cliente(s) atualizado(s) com base na planilha para ${year}.`);
      window.setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      setError(getImportErrorMessage(error));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      {success && <SuccessNotice message={success} floating />}
      {error && <ErrorNotice message={error} floating onClose={() => setError("")} />}

      <Card className="p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-brq-purple">
              <FileSpreadsheet className="h-4 w-4" />
              Baseline de metas por planilha
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
              Faça upload da planilha com Cliente, Target RL Hunter, Target RL Farmer e Total RL 2026.
              Apenas linhas com BU Financial entram no baseline de clientes.
              A coluna resp é opcional.
              A coluna de Áreas / Studios é opcional; se não existir, o saldo entre total, Hunter e Renovação será usado.
              A tela compara contra o Supabase e só atualiza os clientes marcados por você.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="h-10 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-700"
              disabled={loading || applying}
            >
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-[#6823a7]">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {loading ? "Lendo planilha..." : "Importar planilha"}
              <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} disabled={loading || applying} />
            </label>
          </div>
        </div>
        {fileName && (
          <div className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Arquivo carregado: <span className="font-semibold text-slate-900">{fileName}</span>
          </div>
        )}
        {importProgress && <ImportProgressPanel progress={importProgress} elapsedSeconds={importElapsedSeconds} />}
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiSummaryCard label="Ano de referência" value={year} />
        <KpiSummaryCard label="Clientes divergentes" value={divergentCount} tone={divergentCount ? "warning" : "neutral"} />
        <KpiSummaryCard label="Alertas de Hunter" value={hunterWarnings} tone={hunterWarnings ? "warning" : "neutral"} />
        <KpiSummaryCard label="Clientes não encontrados" value={missingCustomers} tone={missingCustomers ? "danger" : "neutral"} />
        <KpiSummaryCard label="Selecionados" value={selectedComparisons.length} tone="purple" />
      </section>

      {rows.length > 0 && (
        <Card className="overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Comparação com a base</h2>
              <p className="mt-1 text-sm text-slate-500">
                Marque os clientes que devem receber os valores da planilha. Linhas com total inválido ou cliente ausente ficam bloqueadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={selectAllDivergences} disabled={!selectableComparisons.length || applying}>
                Selecionar divergentes
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedKeys(new Set())} disabled={!selectedKeys.size || applying}>
                Limpar seleção
              </Button>
              <Button type="button" onClick={applySelectedUpdates} disabled={!selectedComparisons.length || applying}>
                {applying ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Atualizar selecionados
              </Button>
            </div>
          </div>

          {(invalidTotals > 0 || missingCustomers > 0) && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Há {invalidTotals} linha(s) com total da planilha diferente da soma Hunter + Renovação + Áreas / Studios e {missingCustomers} cliente(s) não encontrado(s).
                  Revise esses itens antes de aplicar qualquer atualização.
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Usar</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hunter atual</TableHead>
                  <TableHead>Hunter planilha</TableHead>
                  <TableHead>Renov. atual</TableHead>
                  <TableHead>Renov. planilha</TableHead>
                  <TableHead>Áreas/Studios atual</TableHead>
                  <TableHead>Áreas/Studios planilha</TableHead>
                  <TableHead>Total atual</TableHead>
                  <TableHead>Total planilha</TableHead>
                  <TableHead>Hunter cadastrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((comparison) => {
                  const canApply = canApplyComparison(comparison);
                  const checked = selectedKeys.has(comparison.key) && canApply;
                  return (
                    <TableRow key={comparison.key} className={cn(checked && "bg-purple-50/70 hover:bg-purple-50")}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brq-purple focus:ring-brq-purple"
                          checked={checked}
                          disabled={!canApply || applying}
                          onChange={() => toggleSelection(comparison.key)}
                          aria-label={`Atualizar ${comparison.row.customerName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-950">{comparison.row.customerName}</p>
                        <p className="text-xs text-slate-500">
                          {comparison.matchedCustomerName ? `Base: ${comparison.matchedCustomerName}` : `Linha ${comparison.row.rowNumber}`}
                        </p>
                      </TableCell>
                      <TableCell><StatusBadge comparison={comparison} /></TableCell>
                      <MoneyCell value={comparison.customer?.hunterTarget ?? 0} />
                      <MoneyCell value={comparison.effectiveHunterTarget} highlight={hasDifference(comparison, "hunterTarget")} />
                      <MoneyCell value={comparison.customer?.farmerRenewalTarget ?? 0} />
                      <MoneyCell value={comparison.effectiveFarmerRenewalTarget} highlight={hasDifference(comparison, "farmerRenewalTarget")} />
                      <MoneyCell value={comparison.customer?.studioTarget ?? 0} />
                      <MoneyCell value={comparison.effectiveStudioTarget} highlight={hasDifference(comparison, "studioTarget")} />
                      <MoneyCell value={comparison.customer ? getCustomerTarget(comparison.customer) : 0} />
                      <TableCell>
                        <p className={cn("font-semibold", hasDifference(comparison, "revenue") && "text-brq-purple")}>{formatCurrency(comparison.effectiveRevenue)}</p>
                        {hasVisibleCurrencyDifference(comparison.sheetTotalDifference) && (
                          <p className="mt-1 text-xs text-red-600">
                            Soma difere {formatCurrency(comparison.sheetTotalDifference)}
                          </p>
                        )}
                      </TableCell>
                      <HunterDetailsCell comparison={comparison} />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ImportProgressPanel({ progress, elapsedSeconds }: { progress: ImportProgress; elapsedSeconds: number }) {
  const percentage = Math.round((progress.step / progress.totalSteps) * 100);
  const waitingMessage = elapsedSeconds >= 15 ? "Ainda processando. Planilhas grandes podem levar alguns minutos nesta etapa." : "";
  return (
    <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/70 px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">{progress.label}</p>
          <p className="text-xs leading-5 text-slate-500">{progress.detail}</p>
          {waitingMessage && <p className="mt-1 text-xs font-semibold text-brq-purple">{waitingMessage}</p>}
        </div>
        <p className="text-xs font-bold text-brq-purple">{progress.step}/{progress.totalSteps} · {percentage}% · {formatElapsedSeconds(elapsedSeconds)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brq-purple transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function formatElapsedSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

async function updateImportProgress(
  setImportProgress: React.Dispatch<React.SetStateAction<ImportProgress | null>>,
  step: number,
  label: string,
  detail: string,
) {
  setImportProgress({ step, totalSteps: importProgressTotalSteps, label, detail });
  await waitForNextPaint();
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });
}

function MoneyCell({ value, highlight = false }: { value: number; highlight?: boolean }) {
  return (
    <TableCell>
      <p className={cn("font-semibold", highlight ? "text-brq-purple" : "text-slate-900")}>{formatCurrency(value)}</p>
    </TableCell>
  );
}

function HunterDetailsCell({ comparison }: { comparison: TargetBaselineComparison }) {
  const summary = getHunterMessageSummary(comparison);
  const warning = comparison.hunterStatus === "warning";
  return (
    <TableCell className="w-56 align-middle">
      <div className="flex items-center gap-2">
        <Badge variant={warning ? "warning" : "secondary"}>{summary}</Badge>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 shrink-0 p-0"
              aria-label={`Ver detalhe Hunter de ${comparison.row.customerName}`}
              title="Ver detalhe"
            >
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Detalhe Hunter</DialogTitle>
              <DialogDescription>{comparison.row.customerName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <MetricLine label="Hunter planilha" value={comparison.effectiveHunterTarget} />
                <MetricLine label="Hunter sistema" value={comparison.customer?.hunterTarget ?? 0} />
                <MetricLine label="Total planilha" value={comparison.effectiveRevenue} />
                <MetricLine label="Total sistema" value={comparison.customer ? getCustomerTarget(comparison.customer) : 0} />
              </div>
              <p className={cn("whitespace-pre-wrap text-sm leading-6", warning ? "font-semibold text-amber-700" : "text-slate-700")}>
                {comparison.hunterMessage}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TableCell>
  );
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-950">{formatCurrency(value)}</p>
    </div>
  );
}

function getHunterMessageSummary(comparison: TargetBaselineComparison) {
  if (comparison.valueStatus === "missing_customer") return "Cliente ausente";
  if (comparison.hunterStatus === "warning") return "Ver divergência";
  if (comparison.hunterStatus === "not_applicable") return "Sem Hunter";
  return "Consistente";
}

function StatusBadge({ comparison }: { comparison: TargetBaselineComparison }) {
  if (comparison.valueStatus === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  if (comparison.valueStatus === "invalid_total") return <Badge variant="destructive">Total inválido</Badge>;
  if (comparison.valueStatus === "different") return <Badge variant="warning">Divergente</Badge>;
  if (comparison.hunterStatus === "warning") return <Badge variant="warning">Hunter atenção</Badge>;
  return <Badge variant="success">OK</Badge>;
}

function canApplyComparison(comparison: TargetBaselineComparison) {
  return Boolean(comparison.customer && comparison.updateCandidate && comparison.differences.length && comparison.valueStatus !== "invalid_total");
}

function hasDifference(comparison: TargetBaselineComparison, field: "hunterTarget" | "farmerRenewalTarget" | "studioTarget" | "revenue") {
  return comparison.differences.some((difference) => difference.field === field);
}

function hasVisibleCurrencyDifference(value: number) {
  return Math.round(Math.abs(value)) > 0;
}

function getCustomerTarget(customer: Customer) {
  return customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget;
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar a planilha. Verifique o formato do arquivo.";
}

function readCurveStudioRows(buffer: ArrayBuffer) {
  try {
    const sheetRows = readXlsxSheetRows(buffer, "Sheet1");
    return parseCurveStudioBaselineRows(sheetRows);
  } catch {
    return [];
  }
}

function readTargetBaselineSheet(buffer: ArrayBuffer) {
  return readXlsxSheetRows(buffer, "Resumo RL 2026");
}
