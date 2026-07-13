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
  difference: number;
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiSummaryCard label="Baseline importado" currencyValue={totals.baselineTotal} tone="purple" />
          <KpiSummaryCard label="Hunter / Novo" currencyValue={totals.hunterTotal} tone="sky" />
          <KpiSummaryCard label="Manutenção" currencyValue={totals.maintenanceTotal} />
          <KpiSummaryCard label="Linhas" value={rows.length} />
          <KpiSummaryCard label="Pendências de match" value={rows.filter((row) => row.status !== "ok").length} tone={rows.some((row) => row.status !== "ok") ? "warning" : "ok"} />
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
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Studio/Origem</TableHead>
                  <TableHead className="text-right">Novo/Hunter</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Alocado atual</TableHead>
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
                    <MoneyCell value={row.allocatedTotal} />
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

function MoneyCell({ value, bold = false }: { value: number; bold?: boolean }) {
  return (
    <TableCell className={cn("text-right tabular-nums", bold ? "font-black text-slate-950" : "font-semibold text-slate-800")}>
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
      difference: 0,
    },
    {
      ...base,
      key: `${row.key}:allocated`,
      view: "Hunters / Alocações",
      hunterAmount: row.allocatedHunter,
      maintenanceAmount: row.allocatedMaintenance,
      totalAmount: row.allocatedTotal,
      difference: row.allocationDelta,
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

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar a planilha. Verifique o formato e tente novamente.";
}
