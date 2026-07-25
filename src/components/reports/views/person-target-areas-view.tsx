"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SortableTableHead, type SortState } from "@/components/shared/sortable-table-head";
import { useSetSelection } from "@/hooks/use-set-selection";
import { formatCurrency } from "@/lib/utils";
import type { AreaSortKey } from "./person-target-view-types";

export interface AreaStudioRow {
  areaId: string;
  areaName: string;
  hunter: number;
  maintenance: number;
  total: number;
  clients: Array<{
    customerId: string;
    customerName: string;
    hunter: number;
    maintenance: number;
    total: number;
  }>;
}

export interface AreaStudioDetailRow {
  id: string;
  areaId: string;
  areaName: string;
  customerId: string;
  customerName: string;
  segment: "Studio Hunter" | "Studio Manutenção";
  hunterName: string;
  amount: number;
}

export interface AreasViewProps {
  rows: AreaStudioRow[];
  detailRows: AreaStudioDetailRow[];
  selectedIds: ReturnType<typeof useSetSelection>;
  sort: SortState<AreaSortKey>;
  onSortChange: React.Dispatch<React.SetStateAction<SortState<AreaSortKey>>>;
  detailTotal: number;
  hunterConsultOnly: boolean;
}

export function AreasView({
  rows,
  detailRows,
  selectedIds,
  sort,
  onSortChange,
  detailTotal,
  hunterConsultOnly,
}: AreasViewProps) {
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.areaId));

  const areaSortColumns = useMemo(() => [
    { key: "area", label: "Área / Studio" },
    { key: "clients", label: "Clientes" },
    { key: "hunter", label: "Studio Hunter" },
    { key: "maintenance", label: "Studio Manutenção" },
    { key: "total", label: "Total" },
  ], []);

  return (
    <>
      {!hunterConsultOnly && (
        <Card className="mb-5 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedIds.size
                  ? `${selectedIds.size} área/studio(s) selecionado(s). Exportação e prévia usam o detalhe explodido.`
                  : "Sem seleção ativa: a exportação usa o consolidado filtrado."}
              </p>
              <p className="text-xs text-slate-500">
                Marque áreas/studios na grade para exportar cliente, segmento, Hunter Studio e valor alocado.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => selectedIds.selectAll(rows.map((row) => row.areaId))} disabled={!rows.length}>
                Selecionar visíveis
              </Button>
              <Button type="button" variant="outline" onClick={selectedIds.clear} disabled={!selectedIds.size}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1160px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                    aria-label="Selecionar áreas/studios visíveis para exportação detalhada"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        selectedIds.selectAll(rows.map((row) => row.areaId));
                      } else {
                        selectedIds.clear();
                      }
                    }}
                  />
                </TableHead>
                {areaSortColumns.map((column) => (
                  <SortableTableHead
                    key={column.key}
                    label={column.label}
                    sortKey={column.key as AreaSortKey}
                    sortState={sort}
                    onSort={onSortChange}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.areaId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                      aria-label={`Selecionar ${row.areaName} para exportação detalhada`}
                      checked={selectedIds.has(row.areaId)}
                      onChange={() => selectedIds.toggle(row.areaId)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-bold text-slate-950">{row.areaName}</p>
                    <p className="text-xs text-slate-400">{row.clients.length} cliente(s)</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-2xl flex-wrap gap-2">
                      {row.clients.slice(0, 10).map((client) => (
                        <Badge key={client.customerId} variant="secondary" title={`Hunter: ${formatCurrency(client.hunter)} · Manutenção: ${formatCurrency(client.maintenance)}`}>
                          {client.customerName} · {formatCurrency(client.total)}
                        </Badge>
                      ))}
                      {row.clients.length > 10 && <Badge variant="secondary">+{row.clients.length - 10}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sky-700">{formatCurrency(row.hunter)}</TableCell>
                  <TableCell>{formatCurrency(row.maintenance)}</TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!rows.length && <EmptyState message="Nenhuma meta de área/studio foi encontrada para o ano selecionado." />}
        {selectedIds.size > 0 && (
          <div className="border-t border-slate-200">
            <div className="px-5 py-4">
              <p className="text-sm font-bold text-slate-900">Detalhe explodido da seleção</p>
              <p className="text-xs text-slate-500">Esta é a mesma composição usada na prévia e na exportação.</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Área / Studio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Hunter Studio</TableHead>
                    <TableHead className="text-right">Valor alocado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-bold text-slate-950">{row.areaName}</p>
                      </TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>
                        <Badge className={row.segment === "Studio Hunter" ? "bg-sky-100 text-sky-800 hover:bg-sky-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                          {row.segment}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.hunterName || "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-950">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {detailRows.length > 0 && (
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                      <TableCell colSpan={4} className="font-bold">Total selecionado</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(detailTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {!detailRows.length && <EmptyState message="Nenhuma quebra foi encontrada para a seleção atual." />}
          </div>
        )}
      </Card>
    </>
  );
}
