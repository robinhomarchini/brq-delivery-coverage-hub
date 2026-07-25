"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SortableTableHead, type SortState } from "@/components/shared/sortable-table-head";
import { formatCurrency } from "@/lib/utils";

type PeopleClientSortKey = "person" | "role" | "customer" | "relationship" | "hunter" | "renewal" | "total";

export interface PeopleClientRow {
  id: string;
  personId: string;
  customerId: string;
  customerName: string;
  lineSource: string;
  studioName: string;
  lineType: string;
  hunterAmount: number;
  renewalAmount: number;
  total: number;
  isFirstCustomerLine: boolean;
}

export interface PeopleClientsViewProps {
  rows: PeopleClientRow[];
  selectedPersonId: string;
  sort: SortState<PeopleClientSortKey>;
  onSortChange: React.Dispatch<React.SetStateAction<SortState<PeopleClientSortKey>>>;
  canEdit: boolean;
  year: string;
  totalHunter: number;
  totalRenewal: number;
  totalAll: number;
}

export function PeopleClientsView({
  rows,
  selectedPersonId,
  sort,
  onSortChange,
  canEdit,
  year,
  totalHunter,
  totalRenewal,
  totalAll,
}: PeopleClientsViewProps) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-sm font-bold text-slate-900">Visão completa por pessoa e cliente</p>
        <p className="text-xs text-slate-500">
          Mostra os clientes da pessoa em linhas de Meta Squads/Times e Studios contidos, sem somar Studio novamente.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Cliente" sortKey="customer" sortState={sort} onSort={onSortChange} />
              <TableHead>Origem</TableHead>
              <TableHead>Studio</TableHead>
              <TableHead>Tipo</TableHead>
              <SortableTableHead label="Hunter atual" sortKey="hunter" sortState={sort} onSort={onSortChange} />
              <SortableTableHead label="Renov. + Ampl. atual" sortKey="renewal" sortState={sort} onSort={onSortChange} />
              <SortableTableHead label="Total linha" sortKey="total" sortState={sort} onSort={onSortChange} />
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedPersonId && rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-semibold text-slate-900">{row.customerName}</p>
                </TableCell>
                <TableCell><Badge variant="secondary">{row.lineSource}</Badge></TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-900">{row.studioName}</p>
                </TableCell>
                <TableCell>
                  <Badge className={row.lineType === "Studio Hunter" ? "bg-sky-100 text-sky-800 hover:bg-sky-100" : row.lineType === "Studio Manutenção" ? "bg-purple-100 text-purple-800 hover:bg-purple-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                    {row.lineType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.hunterAmount)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.renewalAmount)}</TableCell>
                <TableCell className="text-right font-black tabular-nums text-slate-950">{formatCurrency(row.total)}</TableCell>
                <TableCell className="text-right">
                  {canEdit && row.isFirstCustomerLine && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&customerId=${encodeURIComponent(row.customerId)}&year=${encodeURIComponent(year)}`}>
                        Ajustar <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {selectedPersonId && rows.length > 0 && (
              <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                <TableCell colSpan={4} className="font-bold">Total da visão filtrada</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalHunter)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalRenewal)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalAll)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!selectedPersonId && <EmptyState message="Escolha uma pessoa para montar a visão completa de clientes, Metas Squads/Times e Studios contidos." />}
      {selectedPersonId && !rows.length && <EmptyState message="Nenhum cliente foi encontrado para os filtros atuais." />}
    </Card>
  );
}
