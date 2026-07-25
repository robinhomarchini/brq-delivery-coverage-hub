"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils";

const hunterSquadsTeamsSegmentLabel = "Meta Squads/Times Hunter";

export interface HunterClientRow {
  id: string;
  hunterId: string;
  hunterName: string;
  customerId: string;
  customerName: string;
  detailName: string;
  segment: string;
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
  observations: string;
}

export interface HunterClientGroup {
  hunterId: string;
  hunterName: string;
  customerId: string;
  customerName: string;
  rows: HunterClientRow[];
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
}

export interface HunterClientsViewProps {
  groups: HunterClientGroup[];
  selectedHunterClientId: string;
}

export function HunterClientsView({ groups, selectedHunterClientId }: HunterClientsViewProps) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-sm font-bold text-slate-900">Hunter x Clientes</p>
        <p className="text-xs text-slate-500">
          Escolha um Hunter para ver Meta Squads/Times, Studio Hunter, Studio Manutenção e Renovação + Ampliação por cliente. Manutenção/Renovação aparece para leitura operacional e não soma na meta Hunter.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Área / Studio / Pessoa</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Hunter efetivo</TableHead>
              <TableHead className="text-right">Studio Hunter</TableHead>
              <TableHead className="text-right">Manutenção / Renovação</TableHead>
              <TableHead className="text-right">Total da linha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={`${group.hunterId}-${group.customerName}`}>
                <TableRow className="bg-slate-50">
                  <TableCell colSpan={4}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-bold text-slate-950">{group.customerName}</span>
                      <Badge variant="secondary">{group.rows.length} quebra(s)</Badge>
                      <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                        Studio Hunter {formatCurrency(group.hunterAmount)}
                      </Badge>
                      {group.maintenanceAmount > 0 && (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                          Manut./Renov. {formatCurrency(group.maintenanceAmount)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-sky-700">{formatCurrency(group.hunterAmount)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-slate-700">{formatCurrency(group.maintenanceAmount)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(group.total)}</TableCell>
                </TableRow>
                {group.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell />
                    <TableCell>
                      <p className="font-semibold text-slate-900">{row.detailName}</p>
                      {row.observations && <p className="max-w-xl text-xs text-slate-500">{row.observations}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={row.segment === hunterSquadsTeamsSegmentLabel ? "bg-violet-100 text-violet-800 hover:bg-violet-100" : row.hunterAmount > 0 ? "bg-sky-100 text-sky-800 hover:bg-sky-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                        {row.segment}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.hunterName}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sky-700">{formatCurrency(row.hunterAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.maintenanceAmount)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {groups.length > 0 && (
              <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                <TableCell colSpan={4} className="font-bold">Total do Hunter nos clientes filtrados</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(groups.reduce((sum, group) => sum + group.hunterAmount, 0))}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(groups.reduce((sum, group) => sum + group.maintenanceAmount, 0))}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(groups.reduce((sum, group) => sum + group.total, 0))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!selectedHunterClientId && <EmptyState message="Escolha um Hunter para abrir os clientes, Studios e manutenções associados." />}
      {selectedHunterClientId && !groups.length && <EmptyState message="Nenhuma quebra foi encontrada para o Hunter e filtros selecionados." />}
    </Card>
  );
}
