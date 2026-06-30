"use client";

import { AlertTriangle, FileSpreadsheet, RefreshCw, UploadCloud } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import { useMemo, useState } from "react";
import type { Customer } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { useDeliveryStore } from "@/store/delivery-store";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import {
  buildTargetBaselineComparisons,
  getResponsibleDisplayName,
  parseTargetBaselineRows,
  type TargetBaselineComparison,
  type TargetBaselineRow,
} from "@/lib/target-baseline-import";
import { cn, formatCurrency } from "@/lib/utils";

const currentYear = defaultTargetYear;
const maxFileSizeInBytes = 5 * 1024 * 1024;

export function TargetBaselineImport() {
  const { customers, customerTargets, people, targetAllocations, saveCustomers } = useDeliveryStore();
  const [year, setYear] = useState(currentYear);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<TargetBaselineRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, currentYear), [customerTargets]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const comparisons = useMemo(
    () => buildTargetBaselineComparisons(rows, yearCustomers, people, targetAllocations, year),
    [people, rows, targetAllocations, year, yearCustomers],
  );
  const selectableComparisons = comparisons.filter(canApplyComparison);
  const selectedComparisons = comparisons.filter((comparison) => selectedKeys.has(comparison.key) && canApplyComparison(comparison));
  const divergentCount = comparisons.filter((comparison) => comparison.valueStatus === "different").length;
  const hunterWarnings = comparisons.filter((comparison) => comparison.hunterStatus === "warning").length;
  const missingCustomers = comparisons.filter((comparison) => comparison.valueStatus === "missing_customer").length;
  const invalidTotals = comparisons.filter((comparison) => comparison.valueStatus === "invalid_total").length;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setSelectedKeys(new Set());

    try {
      if (file.size > maxFileSizeInBytes) {
        throw new Error("Arquivo maior que 5 MB. Use uma planilha menor para homologação.");
      }
      const spreadsheetRows = await readSheet(file);
      const parsedRows = parseTargetBaselineRows(spreadsheetRows);
      setRows(parsedRows);
      setFileName(file.name);
      setSuccess(`${parsedRows.length} cliente(s) lido(s) da planilha.`);
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (error) {
      setRows([]);
      setFileName("");
      setError(getImportErrorMessage(error));
    } finally {
      setLoading(false);
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
              Faça upload da planilha com Cliente, Target RL Hunter, Target RL Farmer, Total RL 2026 e resp.
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
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Summary label={`Ano de referência`} value={String(year)} />
        <Summary label="Clientes divergentes" value={String(divergentCount)} />
        <Summary label="Alertas de Hunter" value={String(hunterWarnings)} />
        <Summary label="Clientes não encontrados" value={String(missingCustomers)} />
        <Summary label="Selecionados" value={String(selectedComparisons.length)} />
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
                  Há {invalidTotals} linha(s) com total da planilha diferente da soma Hunter + Renovação e {missingCustomers} cliente(s) não encontrado(s).
                  Revise esses itens antes de aplicar qualquer atualização.
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table className="min-w-[1380px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Usar</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Resp. planilha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hunter atual</TableHead>
                  <TableHead>Hunter planilha</TableHead>
                  <TableHead>Renov. atual</TableHead>
                  <TableHead>Renov. planilha</TableHead>
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
                      <TableCell>
                        <p className="font-semibold text-slate-800">{getResponsibleDisplayName(comparison.row.responsibleCode, people)}</p>
                        <p className="text-xs text-slate-400">{comparison.row.responsibleCode || "sem código"}</p>
                      </TableCell>
                      <TableCell><StatusBadge comparison={comparison} /></TableCell>
                      <MoneyCell value={comparison.customer?.hunterTarget ?? 0} />
                      <MoneyCell value={comparison.row.hunterTarget} highlight={hasDifference(comparison, "hunterTarget")} />
                      <MoneyCell value={comparison.customer?.farmerRenewalTarget ?? 0} />
                      <MoneyCell value={comparison.row.farmerRenewalTarget} highlight={hasDifference(comparison, "farmerRenewalTarget")} />
                      <MoneyCell value={comparison.customer ? comparison.customer.hunterTarget + comparison.customer.farmerRenewalTarget : 0} />
                      <TableCell>
                        <p className={cn("font-semibold", hasDifference(comparison, "revenue") && "text-brq-purple")}>{formatCurrency(comparison.row.totalTarget)}</p>
                        {Math.abs(comparison.sheetTotalDifference) > 0.01 && (
                          <p className="mt-1 text-xs text-red-600">
                            Soma difere {formatCurrency(comparison.sheetTotalDifference)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className={cn("text-sm", comparison.hunterStatus === "warning" ? "font-semibold text-amber-700" : "text-slate-600")}>
                          {comparison.hunterMessage}
                        </p>
                      </TableCell>
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

function MoneyCell({ value, highlight = false }: { value: number; highlight?: boolean }) {
  return (
    <TableCell>
      <p className={cn("font-semibold", highlight ? "text-brq-purple" : "text-slate-900")}>{formatCurrency(value)}</p>
    </TableCell>
  );
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

function hasDifference(comparison: TargetBaselineComparison, field: "hunterTarget" | "farmerRenewalTarget" | "revenue") {
  return comparison.differences.some((difference) => difference.field === field);
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar a planilha. Verifique o formato do arquivo.";
}
