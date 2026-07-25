"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SortableTableHead, type SortState } from "@/components/shared/sortable-table-head";
import { useSetSelection } from "@/hooks/use-set-selection";
import { formatCurrency } from "@/lib/utils";
import type { PeopleSortKey } from "./person-target-view-types";

export interface PeopleReportRow {
  personId: string;
  personName: string;
  email?: string;
  roleType: string;
  customerCount: number;
  customerNames: string[];
  hunter: number;
  farmerRenewal: number;
  total: number;
}

export interface PeopleViewProps {
  rows: PeopleReportRow[];
  selectedRows: PeopleReportRow[];
  sort: SortState<PeopleSortKey>;
  onSortChange: React.Dispatch<React.SetStateAction<SortState<PeopleSortKey>>>;
  selectedIds: ReturnType<typeof useSetSelection>;
  canEdit: boolean;
  year: number;
}

export function PeopleView({ rows, selectedRows, sort, onSortChange, selectedIds, canEdit, year }: PeopleViewProps) {
  const allVisibleSelected = rows.length > 0 && selectedRows.length === rows.length;

  const peopleSortColumns = useMemo(() => [
    { key: "person", label: "Pessoa" },
    { key: "role", label: "Perfil" },
    { key: "clients", label: "Clientes" },
    { key: "hunter", label: "Meta Hunter" },
    { key: "renewal", label: "Renovação + Ampliação" },
    { key: "total", label: "Meta Total" },
    { key: "status", label: "Status" },
  ], []);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {selectedRows.length
              ? `${selectedRows.length} pessoa(s) selecionada(s) para exportação.`
              : "Sem seleção ativa: a exportação usa a lista filtrada."}
          </p>
          <p className="text-xs text-slate-500">
            Marque pessoas na grade para exportar apenas uma seleção.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => selectedIds.selectAll(rows.map((row) => row.personId))} disabled={!rows.length}>
            Selecionar visíveis
          </Button>
          <Button type="button" variant="outline" onClick={selectedIds.clear} disabled={!selectedIds.size}>
            Limpar seleção
          </Button>
        </div>
      </div>

      <div className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1520px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                    aria-label="Selecionar pessoas visíveis para exportação"
                    checked={allVisibleSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        selectedIds.selectAll(rows.map((row) => row.personId));
                      } else {
                        selectedIds.clear();
                      }
                    }}
                  />
                </TableHead>
                {peopleSortColumns.map((column) => (
                  <SortableTableHead
                    key={column.key}
                    label={column.label}
                    sortKey={column.key as PeopleSortKey}
                    sortState={sort}
                    onSort={onSortChange}
                  />
                ))}
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.personId}
                  className="cursor-pointer"
                  title="Dê duplo clique para ajustar as metas da pessoa"
                  onDoubleClick={() => {
                    window.location.href = `/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(String(year))}`;
                  }}
                >
                  <TableCell onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                      aria-label={`Selecionar ${row.personName} para exportação`}
                      checked={selectedIds.has(row.personId)}
                      onChange={() => selectedIds.toggle(row.personId)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-purple-50 text-brq-purple">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{row.personName}</p>
                        <p className="text-xs text-slate-400">{row.email || "E-mail não informado"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{row.roleType}</Badge></TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{row.customerCount}</p>
                    <p className="max-w-md truncate text-xs text-slate-500">{row.customerNames.join(", ") || "Sem clientes com meta"}</p>
                  </TableCell>
                  <TableCell>{formatCurrency(row.hunter)}</TableCell>
                  <TableCell>{formatCurrency(row.farmerRenewal)}</TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(row.total)}</TableCell>
                  <TableCell>{row.total > 0 ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Com meta</Badge> : <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Sem meta</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {canEdit && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(String(year))}`}>
                            Ajustar <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!rows.length && <EmptyState />}
      </div>
    </>
  );
}
