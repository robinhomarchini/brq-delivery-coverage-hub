"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import {
  buildBoardTargetComparisonRows,
  getBoardComparisonStatusLabel,
  getBoardTargetBaselineTotals,
  getRegisteredTargetTotals,
  type BaselineComparisonMode,
} from "@/lib/board-target-baseline";
import { cn, formatCurrency } from "@/lib/utils";

type ComparisonRow = ReturnType<typeof buildBoardTargetComparisonRows>[number];

export function BaselineComparison() {
  const { customers, customerTargets, boardTargetBaselines } = useDeliveryStore();
  const [year, setYear] = useState(defaultTargetYear);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<BaselineComparisonMode>("client");
  const [status, setStatus] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, defaultTargetYear), [customerTargets]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const baselineTotals = useMemo(() => getBoardTargetBaselineTotals(year, boardTargetBaselines), [boardTargetBaselines, year]);
  const registeredTotals = useMemo(() => getRegisteredTargetTotals(yearCustomers), [yearCustomers]);
  const rows = useMemo(() => buildBoardTargetComparisonRows(yearCustomers, year, boardTargetBaselines), [boardTargetBaselines, year, yearCustomers]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.customerName} ${row.registeredCustomerName}`.toLowerCase().includes(query))
      && (!status || row.status === status)
      && isVisibleForMode(row, mode);
  }), [mode, rows, search, status]);
  const focusedTotals = useMemo(() => getFocusedTotals(filteredRows, mode), [filteredRows, mode]);
  const reportRows = useMemo(() => filteredRows.map((row) => {
    const focused = getFocusedValues(row, mode);
    return {
      customerName: row.customerName,
      registeredCustomerName: row.registeredCustomerName || "Não cadastrado",
      businessUnit: row.businessUnit,
      viewMode: getModeLabel(mode),
      baselineHunterTarget: row.baselineHunterTarget,
      baselineFarmerRenewalTarget: row.baselineFarmerRenewalTarget,
      baselineTotalTarget: row.baselineTotalTarget,
      registeredHunterTarget: row.registeredHunterTarget,
      registeredFarmerRenewalTarget: row.registeredFarmerRenewalTarget,
      registeredStudioMaintenanceTarget: row.registeredStudioMaintenanceTarget,
      registeredTotalTarget: row.registeredTotalTarget,
      comparedBaseline: focused.baseline,
      comparedRegistered: focused.registered,
      comparedDelta: focused.delta,
      status: getBoardComparisonStatusLabel(row.status),
      year,
    };
  }), [filteredRows, mode, year]);
  const reportColumns = useMemo<ReportColumn<(typeof reportRows)[number]>[]>(() => [
    { key: "customerName", label: "Cliente baseline", value: (row) => row.customerName },
    { key: "registeredCustomerName", label: "Cliente cadastrado", value: (row) => row.registeredCustomerName },
    { key: "businessUnit", label: "BU", value: (row) => row.businessUnit },
    { key: "viewMode", label: "Visão", value: (row) => row.viewMode },
    { key: "baselineHunterTarget", label: "Baseline Hunter", value: (row) => row.baselineHunterTarget, format: "currency", align: "right" },
    { key: "baselineFarmerRenewalTarget", label: "Baseline Renovação", value: (row) => row.baselineFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "baselineTotalTarget", label: "Baseline Total", value: (row) => row.baselineTotalTarget, format: "currency", align: "right" },
    { key: "registeredHunterTarget", label: "Cadastrado Hunter", value: (row) => row.registeredHunterTarget, format: "currency", align: "right" },
    { key: "registeredFarmerRenewalTarget", label: "Cadastrado Renovação", value: (row) => row.registeredFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "registeredStudioMaintenanceTarget", label: "Cadastrado Studio Manutenção", value: (row) => row.registeredStudioMaintenanceTarget, format: "currency", align: "right" },
    { key: "registeredTotalTarget", label: "Cadastrado Total", value: (row) => row.registeredTotalTarget, format: "currency", align: "right" },
    { key: "comparedBaseline", label: "Baseline Comparado", value: (row) => row.comparedBaseline, format: "currency", align: "right" },
    { key: "comparedRegistered", label: "Cadastrado Comparado", value: (row) => row.comparedRegistered, format: "currency", align: "right" },
    { key: "comparedDelta", label: "Diferença Comparada", value: (row) => row.comparedDelta, format: "currency", align: "right" },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="Baseline do board"
        title="Comparativo Baseline vs Cadastro"
        description="Compare a foto inicial aprovada no board com os valores cadastrados no sistema por Cliente, Hunter ou Hunter + Farmer."
        actions={(
          <ReportExportActions
            title={`Comparativo Baseline vs Cadastro · ${getModeLabel(mode)} · ${year}`}
            filename={`comparativo-baseline-cadastro-${mode}-${year}`}
            rows={reportRows}
            columns={reportColumns}
          />
        )}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Summary label={`Baseline Board · ${year}`} value={formatCurrency(focusedTotals.baseline)} />
        <Summary label="Cadastrado" value={formatCurrency(focusedTotals.registered)} />
        <Summary label="Diferença" value={formatCurrency(focusedTotals.delta)} tone={getDeltaTone(focusedTotals.delta)} />
        <Summary label="Clientes comparados" value={String(filteredRows.length)} />
        <Summary label="Total Board 2026" value={formatCurrency(baselineTotals.totalTarget)} />
      </section>

      <Card className="mb-5 border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
        <div className="flex gap-3">
          <FileSearch className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            O baseline vem da planilha <span className="font-semibold">metageralinicial.xlsx</span>.
            Coluna I compõe Hunter, coluna L compõe Renovação + Ampliação e coluna M representa o total aprovado.
            O cadastro vem das metas anuais operacionais salvas no sistema. Total cadastrado atual: <span className="font-semibold">{formatCurrency(registeredTotals.totalTarget)}</span>.
          </p>
        </div>
      </Card>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select value={mode} onChange={(event) => setMode(event.target.value as BaselineComparisonMode)}>
          <option value="client">Visão por cliente</option>
          <option value="hunter">Visão Hunter</option>
          <option value="combined">Visão Hunter + Farmer</option>
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="ok">OK</option>
          <option value="above">Acima do baseline</option>
          <option value="below">Abaixo do baseline</option>
          <option value="missing_customer">Cliente não cadastrado</option>
          <option value="extra_customer">Cliente / receita nova</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Cadastrado</TableHead>
                <TableHead>Diferença</TableHead>
                <TableHead>Breakdown cadastrado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const focused = getFocusedValues(row, mode);
                return (
                  <TableRow key={`${row.key}-${mode}`}>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.customerName}</p>
                      <p className="text-xs text-slate-400">{row.registeredCustomerName ? `Cadastro: ${row.registeredCustomerName}` : "Sem cliente cadastrado correspondente"}</p>
                    </TableCell>
                    <TableCell>
                      <MoneyStack
                        main={focused.baseline}
                        lines={mode === "client" ? [
                          ["Hunter", row.baselineHunterTarget],
                          ["Renov. + Ampl.", row.baselineFarmerRenewalTarget],
                        ] : []}
                      />
                    </TableCell>
                    <TableCell><MoneyStack main={focused.registered} /></TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 font-bold", getDeltaClassName(focused.delta))}>
                        {focused.delta > 0.01 ? <ArrowUp className="h-4 w-4" /> : focused.delta < -0.01 ? <ArrowDown className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {formatCurrency(focused.delta)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="grid max-w-md gap-1 text-xs text-slate-500 md:grid-cols-3">
                        <span>Hunter: <strong className="text-slate-900">{formatCurrency(row.registeredHunterTarget)}</strong></span>
                        <span>Renov.: <strong className="text-slate-900">{formatCurrency(row.registeredFarmerRenewalTarget)}</strong></span>
                        <span>Studio Manut.: <strong className="text-slate-900">{formatCurrency(row.registeredStudioMaintenanceTarget)}</strong></span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!filteredRows.length && <EmptyState />}
      </Card>
    </>
  );
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "above" | "below" }) {
  return (
    <Card className={cn(
      "p-5 shadow-sm",
      tone === "above" && "border-emerald-200 bg-emerald-50",
      tone === "below" && "border-red-200 bg-red-50",
      tone === "ok" && "border-emerald-200 bg-emerald-50",
    )}>
      <p className="min-h-8 text-xs font-semibold uppercase leading-4 tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 tabular-nums">{value}</p>
    </Card>
  );
}

function MoneyStack({ main, lines = [] }: { main: number; lines?: Array<[string, number]> }) {
  return (
    <div className="space-y-1">
      <p className="font-bold text-slate-950">{formatCurrency(main)}</p>
      {lines.map(([label, value]) => (
        <p key={label} className="text-xs text-slate-400">{label}: {formatCurrency(value)}</p>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ComparisonRow["status"] }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  if (status === "above") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Acima</Badge>;
  if (status === "below") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Abaixo</Badge>;
  if (status === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Cliente / receita nova</Badge>;
}

function isVisibleForMode(row: ComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") return row.baselineHunterTarget > 0 || row.registeredHunterTarget > 0;
  if (mode === "combined") return row.baselineTotalTarget > 0 || row.registeredHunterTarget + row.registeredFarmerRenewalTarget > 0;
  return true;
}

function getFocusedValues(row: ComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") {
    return {
      baseline: row.baselineHunterTarget,
      registered: row.registeredHunterTarget,
      delta: row.hunterDelta,
    };
  }
  if (mode === "combined") {
    const registered = row.registeredHunterTarget + row.registeredFarmerRenewalTarget;
    return {
      baseline: row.baselineTotalTarget,
      registered,
      delta: registered - row.baselineTotalTarget,
    };
  }
  return {
    baseline: row.baselineTotalTarget,
    registered: row.registeredTotalTarget,
    delta: row.totalDelta,
  };
}

function getFocusedTotals(rows: ComparisonRow[], mode: BaselineComparisonMode) {
  return rows.reduce((totals, row) => {
    const focused = getFocusedValues(row, mode);
    return {
      baseline: totals.baseline + focused.baseline,
      registered: totals.registered + focused.registered,
      delta: totals.delta + focused.delta,
    };
  }, { baseline: 0, registered: 0, delta: 0 });
}

function getModeLabel(mode: BaselineComparisonMode) {
  if (mode === "hunter") return "Hunter";
  if (mode === "combined") return "Hunter + Farmer";
  return "Cliente";
}

function getDeltaTone(value: number) {
  if (value > 0.01) return "above";
  if (value < -0.01) return "below";
  return "ok";
}

function getDeltaClassName(value: number) {
  if (value > 0.01) return "text-emerald-700";
  if (value < -0.01) return "text-red-700";
  return "text-emerald-700";
}
