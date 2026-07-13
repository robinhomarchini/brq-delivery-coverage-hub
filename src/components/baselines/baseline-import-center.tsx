"use client";

import { useMemo, useState } from "react";
import { FileSearch, RefreshCw, UploadCloud } from "lucide-react";
import { TargetBaselineImport } from "@/components/insights/target-baseline-import";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
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
  readStudioBaselineWorkbook,
  studioBaselineSources,
  type StudioBaselineComparisonRow,
  type StudioBaselineSourceCode,
} from "@/lib/studio-baseline-import";
import { cn, formatCurrency } from "@/lib/utils";

const maxFileSizeInBytes = 5 * 1024 * 1024;

type StudioSnapshotRow = {
  key: string;
  customerName: string;
  studioName: string;
  view: "Baseline" | "Hunters / Alocações";
  hunterAmount: number;
  maintenanceAmount: number;
  totalAmount: number;
  customerHunterTarget: number;
  customerMaintenanceTarget: number;
  customerTotalTarget: number;
  difference: number;
  hunterDelta: number;
  maintenanceDelta: number;
  status: string;
  year: number;
};

export function BaselineImportCenter() {
  const { areas, customers, customerTargets, studioTargetAllocations, saveStudioBaselineSnapshot } = useDeliveryStore();
  const [year, setYear] = useState(defaultTargetYear);
  const [sourceCode, setSourceCode] = useState<StudioBaselineSourceCode>("studio_px");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<StudioBaselineComparisonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, defaultTargetYear), [customerTargets]);
  const source = useMemo(() => getStudioBaselineSource(sourceCode), [sourceCode]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const totals = useMemo(() => getStudioTotals(rows), [rows]);
  const snapshotRows = useMemo(() => rows.flatMap((row) => buildSnapshotRows(row, year)), [rows, year]);

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
      const comparisonRows = buildStudioBaselineComparisons(baselineRows, yearCustomers, areas, studioTargetAllocations, year);
      setRows(comparisonRows);
      setFileName(file.name);
      setSuccess(`${baselineRows.length} linha(s) importada(s) para ${source.name}. Revise o match antes de salvar a foto.`);
      window.setTimeout(() => setSuccess(""), 4500);
    } catch (importError) {
      setRows([]);
      setFileName("");
      setError(getImportErrorMessage(importError));
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function saveSnapshot() {
    if (!snapshotRows.length) {
      setError("Importe uma baseline de Studio/Área antes de salvar.");
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
        rows: snapshotRows,
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
          </div>
        </div>
      </Card>

      <TargetBaselineImport />

      <section className="space-y-5">
        <Card className="p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-brq-purple">Baselines por área/studio</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">PX, Alianças, Mobile, Analytics e GENAI</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                A planilha pode estar no layout detalhado de Studios ou no layout com Cliente, Renovação/Manut e Novos Projetos/Hunter.
                Linhas de agrupamento são descartadas automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))} disabled={loading || saving}>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={sourceCode} onChange={(event) => setSourceCode(event.target.value as StudioBaselineSourceCode)} disabled={loading || saving}>
                {studioBaselineSources.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </Select>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-[#6823a7]">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {loading ? "Lendo..." : "Importar baseline"}
                <input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} disabled={loading || saving} />
              </label>
            </div>
          </div>
          {fileName && (
            <p className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Arquivo carregado: <span className="font-semibold text-slate-900">{fileName}</span>
            </p>
          )}
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiSummaryCard label="Baseline importado" currencyValue={totals.baselineTotal} tone="purple" />
          <KpiSummaryCard label="Alocado no sistema" currencyValue={totals.allocatedTotal} tone="sky" />
          <KpiSummaryCard label="Diferença total" currencyValue={totals.allocationDelta} tone={getDeltaTone(totals.allocationDelta)} />
          <KpiSummaryCard label="Hunter / Novo" currencyValue={totals.hunterTotal} tone="sky" />
          <KpiSummaryCard label="Manutenção" currencyValue={totals.maintenanceTotal} />
          <KpiSummaryCard label="Linhas" value={rows.length} />
        </section>

        <Card className="overflow-hidden shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Prévia e match da baseline</h2>
              <p className="mt-1 text-sm text-slate-500">Salvar cria uma foto imutável para comparação; não altera metas de clientes, pessoas ou studios.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setRows([]);
                setFileName("");
              }} disabled={!rows.length || loading || saving}>
                Limpar
              </Button>
              <Button type="button" onClick={saveSnapshot} disabled={!rows.length || loading || saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Salvar foto da baseline
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Studio/Origem</TableHead>
                  <TableHead className="text-right">Baseline Hunter</TableHead>
                  <TableHead className="text-right">Baseline Manut.</TableHead>
                  <TableHead className="text-right">Baseline Total</TableHead>
                  <TableHead className="text-right">Alocado Hunter</TableHead>
                  <TableHead className="text-right">Alocado Manut.</TableHead>
                  <TableHead className="text-right">Alocado Total</TableHead>
                  <TableHead className="text-right">Dif. Hunter</TableHead>
                  <TableHead className="text-right">Dif. Manut.</TableHead>
                  <TableHead>Onde diverge</TableHead>
                  <TableHead className="text-right">Cliente Hunter</TableHead>
                  <TableHead className="text-right">Cliente Manut.</TableHead>
                  <TableHead className="text-right">Cliente Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.customerName}</p>
                      <p className="text-xs text-slate-500">{row.registeredCustomerName || "Cliente não encontrado"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-800">{row.studioName}</p>
                      <p className="text-xs text-slate-500">{row.registeredStudioName || "Studio não encontrado"}</p>
                    </TableCell>
                    <MoneyCell value={row.baselineHunter} />
                    <MoneyCell value={row.baselineMaintenance} />
                    <MoneyCell value={row.baselineTotal} bold />
                    <MoneyCell value={row.allocatedHunter} />
                    <MoneyCell value={row.allocatedMaintenance} />
                    <MoneyCell value={row.allocatedTotal} />
                    <MoneyCell value={row.hunterDelta} tone />
                    <MoneyCell value={row.maintenanceDelta} tone />
                    <TableCell>
                      <p className={cn("text-sm font-semibold", getDivergenceClassName(row))}>{getDivergenceLabel(row)}</p>
                      {Math.abs(row.allocationDelta) > 0.01 && (
                        <p className="mt-1 text-xs text-slate-500">Dif. total: {formatCurrency(row.allocationDelta)}</p>
                      )}
                    </TableCell>
                    <MoneyCell value={row.registeredCustomerHunterTarget} />
                    <MoneyCell value={row.registeredCustomerMaintenanceTarget} />
                    <MoneyCell value={row.registeredCustomerTotalTarget} bold />
                    <TableCell><StudioStatusBadge status={row.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!rows.length && (
            <div className="p-5 text-sm text-slate-500">Importe uma planilha para visualizar os clientes e calibrar o match antes de salvar.</div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MoneyCell({ value, bold = false, tone = false }: { value: number; bold?: boolean; tone?: boolean }) {
  return (
    <TableCell className={cn(
      "text-right tabular-nums",
      bold ? "font-black text-slate-950" : "font-semibold text-slate-800",
      tone && value > 0.01 && "text-emerald-700",
      tone && value < -0.01 && "text-red-700",
    )}>
      {formatCurrency(value)}
    </TableCell>
  );
}

function StudioStatusBadge({ status }: { status: StudioBaselineComparisonRow["status"] }) {
  if (status === "ok") return <Badge variant="success">OK</Badge>;
  if (status === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  if (status === "missing_studio") return <Badge variant="destructive">Studio ausente</Badge>;
  return <Badge variant="warning">Alocação divergente</Badge>;
}

function buildSnapshotRows(row: StudioBaselineComparisonRow, year: number): StudioSnapshotRow[] {
  const base = {
    customerName: row.customerName,
    studioName: row.studioName,
    status: getStudioStatusLabel(row.status),
    year,
  };
  return [
    {
      ...base,
      key: `${row.key}:baseline`,
      view: "Baseline",
      hunterAmount: row.baselineHunter,
      maintenanceAmount: row.baselineMaintenance,
      totalAmount: row.baselineTotal,
      customerHunterTarget: row.registeredCustomerHunterTarget,
      customerMaintenanceTarget: row.registeredCustomerMaintenanceTarget,
      customerTotalTarget: row.registeredCustomerTotalTarget,
      difference: 0,
      hunterDelta: 0,
      maintenanceDelta: 0,
    },
    {
      ...base,
      key: `${row.key}:allocated`,
      view: "Hunters / Alocações",
      hunterAmount: row.allocatedHunter,
      maintenanceAmount: row.allocatedMaintenance,
      totalAmount: row.allocatedTotal,
      customerHunterTarget: row.registeredCustomerHunterTarget,
      customerMaintenanceTarget: row.registeredCustomerMaintenanceTarget,
      customerTotalTarget: row.registeredCustomerTotalTarget,
      difference: row.allocationDelta,
      hunterDelta: row.hunterDelta,
      maintenanceDelta: row.maintenanceDelta,
    },
  ];
}

function getStudioTotals(rows: StudioBaselineComparisonRow[]) {
  return rows.reduce((totals, row) => ({
    baselineTotal: totals.baselineTotal + row.baselineTotal,
    hunterTotal: totals.hunterTotal + row.baselineHunter,
    maintenanceTotal: totals.maintenanceTotal + row.baselineMaintenance,
    allocatedTotal: totals.allocatedTotal + row.allocatedTotal,
    allocationDelta: totals.allocationDelta + row.allocationDelta,
  }), {
    baselineTotal: 0,
    hunterTotal: 0,
    maintenanceTotal: 0,
    allocatedTotal: 0,
    allocationDelta: 0,
  });
}

function getStudioStatusLabel(status: StudioBaselineComparisonRow["status"]) {
  if (status === "ok") return "OK";
  if (status === "missing_customer") return "Cliente ausente";
  if (status === "missing_studio") return "Studio ausente";
  return "Alocação divergente";
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
  if (Math.abs(row.hunterDelta) > 0.01 || Math.abs(row.maintenanceDelta) > 0.01) return "text-amber-700";
  return "text-emerald-700";
}

function getDeltaTone(value: number) {
  if (Math.abs(value) <= 0.01) return "ok";
  return "warning";
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar a planilha. Verifique o formato e tente novamente.";
}
