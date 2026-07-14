"use client";

import { useMemo, useState } from "react";
import { FileSearch, RefreshCw, UploadCloud } from "lucide-react";
import { TargetBaselineImport } from "@/components/insights/target-baseline-import";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { StackedComparisonCell } from "@/components/shared/stacked-comparison-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import {
  buildStudioBaselineComparisons,
  getStudioBaselineSource,
  isFinancialBusinessUnit,
  readStudioBaselineWorkbook,
  studioBaselineSources,
  type StudioBaselineComparisonRow,
  type StudioBaselineSourceCode,
} from "@/lib/studio-baseline-import";
import {
  buildStudioBaselineReportRows,
  getStudioStatusLabel,
  restoreStudioBaselineComparisonRows,
  type StudioBaselineReportRow,
} from "@/lib/studio-baseline-report";
import { cn, formatCurrency, normalizeBusinessName, roundCurrency } from "@/lib/utils";

const maxFileSizeInBytes = 5 * 1024 * 1024;
type BaselineImportMode = "main_curve" | "studio_sources";
type StudioBaselineImportStats = {
  acceptedRows: number;
  ignoredRows: number;
  totalRows: number;
};
type StudioBaselineSortKey = "customer" | "studio" | "hunter" | "maintenance" | "total" | "hunterDelta" | "maintenanceDelta" | "divergence" | "status";
const manualStudioBaselineSources = studioBaselineSources.filter((item) => item.code !== "studio_general");
const baselineImportModeStorageKey = "delivery-baseline-import-mode";

export function BaselineImportCenter() {
  const { areas, customers, customerTargets, studioTargetAllocations, studioBaselineSnapshots, saveStudioBaselineSnapshot } = useDeliveryStore();
  const [mode, setMode] = useState<BaselineImportMode>(() => getStoredBaselineImportMode());
  const [year, setYear] = useState(defaultTargetYear);
  const [sourceCode, setSourceCode] = useState<StudioBaselineSourceCode>("studio_px");
  const [fileName, setFileName] = useState("");
  const [importedRows, setImportedRows] = useState<StudioBaselineComparisonRow[]>([]);
  const [financialKeys, setFinancialKeys] = useState<Set<string>>(new Set());
  const [importStats, setImportStats] = useState<StudioBaselineImportStats | null>(null);
  const [dismissedSnapshotId, setDismissedSnapshotId] = useState("");
  const [sortState, setSortState] = useState<SortState<StudioBaselineSortKey>>({ key: "customer", direction: "asc" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, defaultTargetYear), [customerTargets]);
  const source = useMemo(() => getStudioBaselineSource(sourceCode), [sourceCode]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const latestSnapshot = useMemo(
    () => studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === sourceCode),
    [sourceCode, studioBaselineSnapshots, year],
  );
  const latestCurveSnapshotRows = useMemo(() => {
    if (sourceCode === "studio_general") return [];
    const curveSnapshot = studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === "studio_general");
    return curveSnapshot ? restoreStudioBaselineComparisonRows(curveSnapshot.rows) : [];
  }, [sourceCode, studioBaselineSnapshots, year]);
  const latestSnapshotRows = useMemo(
    () => latestSnapshot && latestSnapshot.id !== dismissedSnapshotId
      ? restoreStudioBaselineComparisonRows(latestSnapshot.rows)
      : [],
    [dismissedSnapshotId, latestSnapshot],
  );
  const loadedFromSnapshot = importedRows.length === 0 && latestSnapshotRows.length > 0;
  const displayRows = useMemo(
    () => sortStudioBaselineRows(dedupeStudioBaselineRows(applyCurveBaselineToRows(importedRows.length ? importedRows : latestSnapshotRows, latestCurveSnapshotRows)), sortState),
    [importedRows, latestCurveSnapshotRows, latestSnapshotRows, sortState],
  );
  const selectedImportedRows = useMemo(
    () => sortStudioBaselineRows(dedupeStudioBaselineRows(applyCurveBaselineToRows(importedRows.filter((row) => financialKeys.has(row.key)), latestCurveSnapshotRows)), sortState),
    [financialKeys, importedRows, latestCurveSnapshotRows, sortState],
  );
  const rows = importedRows.length ? selectedImportedRows : displayRows;
  const activeFileName = importedRows.length ? fileName : loadedFromSnapshot ? latestSnapshot?.fileName ?? "" : fileName;
  const totals = useMemo(() => getStudioTotals(rows), [rows]);
  const importedSnapshotRows = useMemo(() => selectedImportedRows.flatMap((row) => buildStudioBaselineReportRows(row, year)), [selectedImportedRows, year]);
  const exportRows = useMemo(() => rows.flatMap((row) => buildStudioBaselineReportRows(row, year)), [rows, year]);
  const exportColumns = useMemo<ReportColumn<StudioBaselineReportRow>[]>(() => [
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "studioName", label: "Studio/Origem", value: (row) => row.studioName },
    { key: "view", label: "Visão", value: (row) => row.view },
    { key: "hunterAmount", label: "Hunter", value: (row) => row.hunterAmount, format: "currency", align: "right" },
    { key: "maintenanceAmount", label: "Manutenção", value: (row) => row.maintenanceAmount, format: "currency", align: "right" },
    { key: "totalAmount", label: "Total", value: (row) => row.totalAmount, format: "currency", align: "right" },
    { key: "hunterDelta", label: "Dif. Hunter", value: (row) => row.hunterDelta, format: "currency", align: "right" },
    { key: "maintenanceDelta", label: "Dif. Manutenção", value: (row) => row.maintenanceDelta, format: "currency", align: "right" },
    { key: "difference", label: "Dif. Total", value: (row) => row.difference, format: "currency", align: "right" },
    { key: "customerHunterTarget", label: "Cliente Hunter", value: (row) => row.customerHunterTarget, format: "currency", align: "right" },
    { key: "customerMaintenanceTarget", label: "Cliente Manutenção", value: (row) => row.customerMaintenanceTarget, format: "currency", align: "right" },
    { key: "customerStudioTarget", label: "Cliente Studio Curva", value: (row) => row.customerStudioTarget, format: "currency", align: "right" },
    { key: "customerTotalTarget", label: "Cliente Total", value: (row) => row.customerTotalTarget, format: "currency", align: "right" },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);

  function updateMode(nextMode: BaselineImportMode) {
    setMode(nextMode);
    window.localStorage.setItem(baselineImportModeStorageKey, nextMode);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (file.size > maxFileSizeInBytes) {
        throw new Error("Arquivo maior que 5 MB. Use uma planilha menor para homologação.");
      }
      const baselineRows = await readStudioBaselineWorkbook(file, source);
      const comparisonRows = dedupeStudioBaselineRows(buildStudioBaselineComparisons(baselineRows, yearCustomers, areas, studioTargetAllocations, year));
      const defaultFinancialKeys = new Set(
        comparisonRows
          .filter((row) => isFinancialBusinessUnit(row.sourceBusinessUnit))
          .map((row) => row.key),
      );
      setImportedRows(comparisonRows);
      setFinancialKeys(defaultFinancialKeys);
      setImportStats({ acceptedRows: defaultFinancialKeys.size, ignoredRows: comparisonRows.length - defaultFinancialKeys.size, totalRows: comparisonRows.length });
      setDismissedSnapshotId("");
      setFileName(file.name);
      setSuccess(`${comparisonRows.length} linha(s) lida(s) para ${source.name}. Marque Financial somente nas linhas que devem entrar no snapshot.`);
      window.setTimeout(() => setSuccess(""), 4500);
    } catch (importError) {
      setImportedRows([]);
      setFinancialKeys(new Set());
      setImportStats(null);
      setFileName("");
      setError(getImportErrorMessage(importError));
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function saveSnapshot() {
    if (!importedRows.length) {
      setError("Importe uma baseline de Studio/Área antes de salvar.");
      return;
    }
    if (!importedSnapshotRows.length) {
      setError("Marque ao menos uma linha como Financial antes de salvar a foto da baseline.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const saved = await saveStudioBaselineSnapshot({
        year,
        sourceCode: source.code,
        sourceName: source.name,
        fileName: fileName || `${source.code}-${year}.xlsx`,
        rows: importedSnapshotRows,
        totals,
      });
      setSuccess(`Baseline ${saved.sourceName} salva como foto do resultado.`);
      window.setTimeout(() => setSuccess(""), 4500);
    } catch (saveError) {
      setError(getImportErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function toggleFinancialRow(key: string) {
    setFinancialKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      updateImportStats(next);
      return next;
    });
  }

  function updateAllFinancialRows(selected: boolean) {
    const next = selected ? new Set(importedRows.map((row) => row.key)) : new Set<string>();
    setFinancialKeys(next);
    updateImportStats(next);
  }

  function updateImportStats(nextFinancialKeys: Set<string>) {
    setImportStats((current) => current
      ? {
        ...current,
        acceptedRows: nextFinancialKeys.size,
        ignoredRows: Math.max(current.totalRows - nextFinancialKeys.size, 0),
      }
      : current);
  }

  return (
    <div className="space-y-6">
      {success && <SuccessNotice message={success} floating />}
      {error && <ErrorNotice message={error} floating onClose={() => setError("")} />}

      <Card className="p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-50 text-brq-purple">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Origem canônica de importação</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Use esta central para carregar planilhas de baseline. As telas de comparação passam a consumir fotos salvas aqui; grupo da planilha é ignorado, valem Cliente, tipo de receita e valor.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <ModeButton
                active={mode === "main_curve"}
                title="Curva principal"
                description="Cliente, Hunter, Farmer e Total."
                onClick={() => updateMode("main_curve")}
              />
              <ModeButton
                active={mode === "studio_sources"}
                title="Áreas / Studios"
                description="PX, Alianças, Mobile, Analytics e GENAI."
                onClick={() => updateMode("studio_sources")}
              />
            </div>
          </div>
        </div>
      </Card>

      {mode === "main_curve" ? (
        <TargetBaselineImport />
      ) : (
      <section className="space-y-5">
        <Card className="p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-brq-purple">Baselines por área/studio</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">PX, Alianças, Mobile, Analytics e GENAI</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                A planilha pode estar no layout detalhado de Studios ou no layout com Cliente, Renovação/Manut e Novos Projetos/Hunter.
                Linhas de agrupamento e registros com BU diferente de Financial são descartados automaticamente quando a coluna BU/CC CROSS existir.
              </p>
              <div className="mt-4 grid max-w-4xl gap-3 md:grid-cols-[minmax(220px,280px)_1fr]">
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-brq-purple">BU considerada</p>
                  <p className="mt-1 text-base font-black text-slate-950">BU Financial</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  A importação usa somente linhas marcadas como <span className="font-semibold text-slate-950">BU Financial</span> nas colunas <span className="font-semibold text-slate-950">BU</span> ou <span className="font-semibold text-slate-950">CC CROSS</span>.
                  Se a planilha não trouxer essa coluna, marque manualmente as linhas Financial na prévia antes de salvar.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))} disabled={loading || saving}>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={sourceCode} onChange={(event) => setSourceCode(event.target.value as StudioBaselineSourceCode)} disabled={loading || saving}>
                {manualStudioBaselineSources.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </Select>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-[#6823a7]">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {loading ? "Lendo..." : "Importar baseline"}
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} disabled={loading || saving} />
              </label>
            </div>
          </div>
          {activeFileName && (
            <p className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {loadedFromSnapshot ? "Última foto salva carregada" : "Arquivo carregado"}: <span className="font-semibold text-slate-900">{activeFileName}</span>
              {loadedFromSnapshot && latestSnapshot?.createdAt && (
                <span> · salva em {formatDateTime(latestSnapshot.createdAt)}</span>
              )}
            </p>
          )}
          {importStats && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{importStats.acceptedRows} linha(s) marcada(s) como Financial</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{importStats.ignoredRows} linha(s) fora do snapshot</span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{importStats.totalRows} linha(s) lida(s)</span>
            </div>
          )}
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiSummaryCard label="Baseline importado" currencyValue={totals.baselineTotal} tone="purple" />
          <KpiSummaryCard label="Cadastrado no sistema" currencyValue={totals.allocatedTotal} tone="sky" />
          <KpiSummaryCard label="Studio na curva" currencyValue={totals.curveStudioTotal} tone="purple" />
          <KpiSummaryCard label="Diferença total" currencyValue={totals.allocationDelta} tone={getDeltaTone(totals.allocationDelta)} />
          <KpiSummaryCard label="Hunter / Novo" currencyValue={totals.hunterTotal} tone="sky" />
          <KpiSummaryCard label="Manutenção" currencyValue={totals.maintenanceTotal} />
        </section>

        <Card className="overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Prévia e match da baseline</h2>
              <p className="mt-1 text-sm text-slate-500">Salvar cria uma foto imutável apenas com as linhas marcadas como Financial; não altera metas de clientes, pessoas ou studios.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {importedRows.length > 0 && (
                <>
                  <Button type="button" variant="outline" onClick={() => updateAllFinancialRows(true)} disabled={loading || saving}>
                    Marcar todos Financial
                  </Button>
                  <Button type="button" variant="outline" onClick={() => updateAllFinancialRows(false)} disabled={loading || saving || !financialKeys.size}>
                    Limpar Financial
                  </Button>
                </>
              )}
              <ReportExportActions
                title={`Baseline ${source.name} · ${year}`}
                filename={`baseline-${source.code}-${year}`}
                rows={exportRows}
                columns={exportColumns}
              />
              <Button type="button" variant="outline" onClick={() => {
                setImportedRows([]);
                setFinancialKeys(new Set());
                setImportStats(null);
                setFileName("");
                if (loadedFromSnapshot && latestSnapshot) setDismissedSnapshotId(latestSnapshot.id);
              }} disabled={!displayRows.length || loading || saving}>
                Limpar
              </Button>
              <Button type="button" onClick={saveSnapshot} disabled={!importedRows.length || !selectedImportedRows.length || loading || saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Salvar foto da baseline
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  {importedRows.length > 0 && <TableHead className="w-28">Financial</TableHead>}
                  <SortableTableHead label="Cliente" sortKey="customer" sortState={sortState} onSort={setSortState} />
                  <SortableTableHead label="Studio/Origem" sortKey="studio" sortState={sortState} onSort={setSortState} />
                  <TableHead className="w-44">Visão</TableHead>
                  <SortableTableHead label="Hunter" sortKey="hunter" sortState={sortState} onSort={setSortState} className="text-right" />
                  <SortableTableHead label="Manutenção" sortKey="maintenance" sortState={sortState} onSort={setSortState} className="text-right" />
                  <SortableTableHead label="Total" sortKey="total" sortState={sortState} onSort={setSortState} className="text-right" />
                  <SortableTableHead label="Dif. Hunter" sortKey="hunterDelta" sortState={sortState} onSort={setSortState} className="text-right" />
                  <SortableTableHead label="Dif. Manut." sortKey="maintenanceDelta" sortState={sortState} onSort={setSortState} className="text-right" />
                  <SortableTableHead label="Onde diverge" sortKey="divergence" sortState={sortState} onSort={setSortState} />
                  <TableHead>Cadastro do cliente</TableHead>
                  <SortableTableHead label="Status" sortKey="status" sortState={sortState} onSort={setSortState} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row) => {
                  const selectedAsFinancial = !importedRows.length || financialKeys.has(row.key);
                  return (
                  <TableRow key={row.key} className={cn(importedRows.length && !selectedAsFinancial && "bg-slate-50/70 text-slate-500")}>
                    {importedRows.length > 0 && (
                      <TableCell>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 accent-[#8733d1]"
                            checked={selectedAsFinancial}
                            onChange={() => toggleFinancialRow(row.key)}
                            disabled={loading || saving}
                            aria-label={`Marcar ${row.customerName} ${row.studioName} como Financial`}
                          />
                          Sim
                        </label>
                        <p className="mt-1 text-[11px] text-slate-400">{row.sourceBusinessUnit || "sem BU"}</p>
                      </TableCell>
                    )}
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.customerName}</p>
                      <p className="text-xs text-slate-500">{row.registeredCustomerName || "Cliente não encontrado"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{row.studioName}</p>
                      <p className="text-xs text-slate-500">{row.registeredStudioName || "Studio não encontrado"}</p>
                    </TableCell>
                    <StackedComparisonCell
                      className="w-44"
                      lines={[
                        { value: "Baseline Studio" },
                        { value: "Cadastrado", tone: "default" },
                        { value: "Baseline Curva", tone: "purple" },
                      ]}
                    />
                    <StackedComparisonCell
                      align="right"
                      lines={[
                        { value: row.baselineHunter, currency: true },
                        { value: row.allocatedHunter, currency: true, tone: "default" },
                        { value: getCurveSplitAmount(row.registeredCustomerStudioTarget, row.registeredCustomerStudioHunterTarget), currency: true, tone: "purple" },
                      ]}
                    />
                    <StackedComparisonCell
                      align="right"
                      lines={[
                        { value: row.baselineMaintenance, currency: true },
                        { value: row.allocatedMaintenance, currency: true, tone: "default" },
                        { value: getCurveSplitAmount(row.registeredCustomerStudioTarget, row.registeredCustomerStudioMaintenanceTarget), currency: true, tone: "purple" },
                      ]}
                    />
                    <StackedComparisonCell
                      align="right"
                      lines={[
                        { value: row.baselineTotal, currency: true, bold: true },
                        { value: row.allocatedTotal, currency: true, tone: "default", bold: true },
                        { value: row.registeredCustomerStudioTarget, currency: true, tone: "purple", bold: true },
                      ]}
                    />
                    <StackedComparisonCell
                      align="right"
                      lines={[
                        { value: undefined, currency: true },
                        { value: row.hunterDelta, currency: true, tone: "delta" },
                        { value: undefined, currency: true, tone: "purple" },
                      ]}
                    />
                    <StackedComparisonCell
                      align="right"
                      lines={[
                        { value: undefined, currency: true },
                        { value: row.maintenanceDelta, currency: true, tone: "delta" },
                        { value: undefined, currency: true, tone: "purple" },
                      ]}
                    />
                    <TableCell>
                      <p className={cn("text-sm font-semibold", getDivergenceClassName(row))}>{getDivergenceLabel(row)}</p>
                      {Math.abs(row.allocationDelta) > 0.01 && (
                        <p className="mt-1 text-xs text-slate-500">Dif. total: {formatCurrency(row.allocationDelta)}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <CustomerTargetStack row={row} />
                    </TableCell>
                    <TableCell><StudioStatusBadge status={row.status} /></TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </div>
          {!displayRows.length && (
            <div className="p-5 text-sm text-slate-500">Importe uma planilha ou selecione uma origem/ano com foto salva para visualizar os clientes e calibrar o match.</div>
          )}
        </Card>
      </section>
      )}
    </div>
  );
}

function getStoredBaselineImportMode(): BaselineImportMode {
  if (typeof window === "undefined") return "main_curve";
  const storedMode = window.localStorage.getItem(baselineImportModeStorageKey);
  return storedMode === "studio_sources" || storedMode === "main_curve" ? storedMode : "main_curve";
}

function ModeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="block text-sm font-bold">{title}</span>
      <span className={cn("mt-1 block text-xs", active ? "text-purple-100" : "text-slate-500")}>{description}</span>
    </button>
  );
}

function CustomerTargetStack({ row }: { row: StudioBaselineComparisonRow }) {
  return (
    <div className="space-y-1 text-xs text-slate-500">
      <p>Hunter: <span className="font-semibold text-slate-900">{formatCurrency(row.registeredCustomerHunterTarget)}</span></p>
      <p>Manut.: <span className="font-semibold text-slate-900">{formatCurrency(row.registeredCustomerMaintenanceTarget)}</span></p>
      <p>Studio curva: <span className="font-semibold text-brq-purple">{formatCurrency(row.registeredCustomerStudioTarget)}</span></p>
      <p>Total: <span className="font-black text-slate-950">{formatCurrency(row.registeredCustomerTotalTarget)}</span></p>
    </div>
  );
}

function StudioStatusBadge({ status }: { status: StudioBaselineComparisonRow["status"] }) {
  if (status === "ok") return <Badge variant="success">OK</Badge>;
  if (status === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  if (status === "missing_studio") return <Badge variant="destructive">Studio ausente</Badge>;
  return <Badge variant="warning">Alocação divergente</Badge>;
}

function dedupeStudioBaselineRows(rows: StudioBaselineComparisonRow[]) {
  const rowsByCustomerStudio = new Map<string, StudioBaselineComparisonRow>();
  rows.forEach((row) => {
    const key = getCustomerStudioKey(row.customerName, row.studioName);
    const current = rowsByCustomerStudio.get(key);
    rowsByCustomerStudio.set(key, current ? mergeStudioBaselineRows(current, row) : { ...row, key });
  });
  return Array.from(rowsByCustomerStudio.values());
}

function mergeStudioBaselineRows(first: StudioBaselineComparisonRow, second: StudioBaselineComparisonRow): StudioBaselineComparisonRow {
  const baselineHunter = roundCurrency(first.baselineHunter + second.baselineHunter);
  const baselineMaintenance = roundCurrency(first.baselineMaintenance + second.baselineMaintenance);
  const baselineTotal = roundCurrency(first.baselineTotal + second.baselineTotal);
  const allocatedHunter = Math.max(first.allocatedHunter, second.allocatedHunter);
  const allocatedMaintenance = Math.max(first.allocatedMaintenance, second.allocatedMaintenance);
  const allocatedTotal = Math.max(first.allocatedTotal, second.allocatedTotal);
  const registeredCustomerStudioHunterTarget = Math.max(first.registeredCustomerStudioHunterTarget, second.registeredCustomerStudioHunterTarget);
  const registeredCustomerStudioMaintenanceTarget = Math.max(first.registeredCustomerStudioMaintenanceTarget, second.registeredCustomerStudioMaintenanceTarget);
  const registeredCustomerStudioTarget = Math.max(first.registeredCustomerStudioTarget, second.registeredCustomerStudioTarget);

  return {
    ...first,
    sourceBusinessUnit: first.sourceBusinessUnit || second.sourceBusinessUnit,
    registeredCustomerName: first.registeredCustomerName || second.registeredCustomerName,
    registeredStudioName: first.registeredStudioName || second.registeredStudioName,
    registeredCustomerHunterTarget: Math.max(first.registeredCustomerHunterTarget, second.registeredCustomerHunterTarget),
    registeredCustomerMaintenanceTarget: Math.max(first.registeredCustomerMaintenanceTarget, second.registeredCustomerMaintenanceTarget),
    registeredCustomerStudioHunterTarget,
    registeredCustomerStudioMaintenanceTarget,
    registeredCustomerStudioTarget,
    registeredCustomerTotalTarget: Math.max(first.registeredCustomerTotalTarget, second.registeredCustomerTotalTarget),
    baselineHunter,
    baselineMaintenance,
    baselineTotal,
    allocatedHunter,
    allocatedMaintenance,
    allocatedTotal,
    hunterDelta: roundCurrency(allocatedHunter - baselineHunter),
    maintenanceDelta: roundCurrency(allocatedMaintenance - baselineMaintenance),
    allocationDelta: roundCurrency(allocatedTotal - baselineTotal),
    status: mergeStudioStatus(first.status, second.status),
  };
}

function mergeStudioStatus(first: StudioBaselineComparisonRow["status"], second: StudioBaselineComparisonRow["status"]) {
  if (first === "missing_customer" || second === "missing_customer") return "missing_customer";
  if (first === "missing_studio" || second === "missing_studio") return "missing_studio";
  if (first === "allocation_gap" || second === "allocation_gap") return "allocation_gap";
  return "ok";
}

function sortStudioBaselineRows(rows: StudioBaselineComparisonRow[], sortState: SortState<StudioBaselineSortKey>) {
  if (!sortState) return defaultSortStudioBaselineRows(rows);
  return sortRows(defaultSortStudioBaselineRows(rows), sortState.direction, (first, second) => {
    if (sortState.key === "customer") return compareBusinessLabel(first.customerName, second.customerName);
    if (sortState.key === "studio") return compareBusinessLabel(first.studioName, second.studioName);
    if (sortState.key === "hunter") return compareNumber(first.baselineHunter, second.baselineHunter);
    if (sortState.key === "maintenance") return compareNumber(first.baselineMaintenance, second.baselineMaintenance);
    if (sortState.key === "total") return compareNumber(first.baselineTotal, second.baselineTotal);
    if (sortState.key === "hunterDelta") return compareNumber(first.hunterDelta, second.hunterDelta);
    if (sortState.key === "maintenanceDelta") return compareNumber(first.maintenanceDelta, second.maintenanceDelta);
    if (sortState.key === "divergence") return compareBusinessLabel(getDivergenceLabel(first), getDivergenceLabel(second));
    return compareBusinessLabel(getStudioStatusLabel(first.status), getStudioStatusLabel(second.status));
  });
}

function defaultSortStudioBaselineRows(rows: StudioBaselineComparisonRow[]) {
  return rows.slice().sort((first, second) =>
    compareBusinessLabel(first.customerName, second.customerName)
    || compareBusinessLabel(first.studioName, second.studioName)
    || compareBusinessLabel(first.registeredStudioName, second.registeredStudioName)
    || compareBusinessLabel(first.status, second.status)
  );
}

function sortRows<T>(rows: T[], direction: SortDirection, compare: (first: T, second: T) => number) {
  return rows.slice().sort((first, second) => {
    const result = compare(first, second);
    return direction === "asc" ? result : -result;
  });
}

function compareNumber(first: number, second: number) {
  return first - second;
}

function applyCurveBaselineToRows(rows: StudioBaselineComparisonRow[], curveRows: StudioBaselineComparisonRow[]) {
  if (!curveRows.length) return rows;
  const curveBaselineByCustomerStudio = new Map(
    curveRows.map((row) => [getCustomerStudioKey(row.customerName, row.studioName), {
      hunter: row.registeredCustomerStudioHunterTarget || row.baselineHunter,
      maintenance: row.registeredCustomerStudioMaintenanceTarget || row.baselineMaintenance,
      total: row.registeredCustomerStudioTarget || row.baselineTotal,
    }]),
  );

  return rows.map((row) => {
    const curveStudioTarget = curveBaselineByCustomerStudio.get(getCustomerStudioKey(row.customerName, row.studioName));
    if (!curveStudioTarget) return row;
    return {
      ...row,
      registeredCustomerStudioHunterTarget: curveStudioTarget.hunter,
      registeredCustomerStudioMaintenanceTarget: curveStudioTarget.maintenance,
      registeredCustomerStudioTarget: curveStudioTarget.total,
    };
  });
}

function getCurveSplitAmount(curveTotal: number, splitAmount: number) {
  if (Math.abs(curveTotal) <= 0.01) return undefined;
  return splitAmount;
}

function getCustomerStudioKey(customerName: string, studioName: string) {
  return `${normalizeBusinessName(customerName)}:${normalizeBusinessName(studioName)}`;
}

function compareBusinessLabel(first: string, second: string) {
  return first.localeCompare(second, "pt-BR", { sensitivity: "base", numeric: true });
}

function getStudioTotals(rows: StudioBaselineComparisonRow[]) {
  return rows.reduce((totals, row) => ({
    baselineTotal: totals.baselineTotal + row.baselineTotal,
    hunterTotal: totals.hunterTotal + row.baselineHunter,
    maintenanceTotal: totals.maintenanceTotal + row.baselineMaintenance,
    allocatedTotal: totals.allocatedTotal + row.allocatedTotal,
    curveStudioTotal: totals.curveStudioTotal + row.registeredCustomerStudioTarget,
    allocationDelta: totals.allocationDelta + row.allocationDelta,
  }), {
    baselineTotal: 0,
    hunterTotal: 0,
    maintenanceTotal: 0,
    allocatedTotal: 0,
    curveStudioTotal: 0,
    allocationDelta: 0,
  });
}

function getDivergenceLabel(row: StudioBaselineComparisonRow) {
  if (row.status === "missing_customer") return "Cliente ausente";
  if (row.status === "missing_studio") return "Studio ausente";
  const hunterDiverges = Math.abs(row.hunterDelta) > 0.01;
  const maintenanceDiverges = Math.abs(row.maintenanceDelta) > 0.01;
  if (hunterDiverges && maintenanceDiverges) return "Hunter e Manutenção";
  if (hunterDiverges) return "Hunter";
  if (maintenanceDiverges) return "Manutenção";
  return "Reconciliado";
}

function getDivergenceClassName(row: StudioBaselineComparisonRow) {
  if (row.status === "missing_customer" || row.status === "missing_studio") return "text-red-700";
  if (row.allocationDelta > 0.01) return "text-emerald-700";
  if (row.allocationDelta < -0.01) return "text-red-700";
  return "text-sky-700";
}

function getDeltaTone(value: number) {
  if (Math.abs(value) <= 0.01) return "sky";
  if (value > 0.01) return "ok";
  return "danger";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar a planilha. Verifique o formato e tente novamente.";
}
