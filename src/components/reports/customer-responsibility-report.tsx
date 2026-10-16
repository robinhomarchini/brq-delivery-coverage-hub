"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions } from "@/components/shared/report-export-actions";
import { SortableTableHead, type SortState } from "@/components/shared/sortable-table-head";
import { ErrorNotice } from "@/components/shared/success-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { buildCustomerResponsibilityRows, filterCustomerResponsibilityRows, customerResponsibilityColumns, type CustomerResponsibilitySortKey, type CustomerResponsibilityFilters } from "@/lib/reports/customer-responsibility";
import { useDeliveryStore } from "@/store/delivery-store";

const pageSize = 50;

export function CustomerResponsibilityReport() {
  const { customers, people, loading, error } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState<CustomerResponsibilityFilters["coverage"]>("all");
  const [hunterId, setHunterId] = useState("");
  const [deliveryManagerId, setDeliveryManagerId] = useState("");
  const [sort, setSort] = useState<SortState<CustomerResponsibilitySortKey>>({ key: "customerName", direction: "asc" });
  const [page, setPage] = useState(1);
  const rows = useMemo(() => buildCustomerResponsibilityRows(customers, people), [customers, people]);
  const responsibleOptions = useMemo(() => {
    const hunters = new Set(rows.flatMap((row) => row.hunterIds));
    const deliveryManagers = new Set(rows.flatMap((row) => row.deliveryManagerIds));
    const sortedPeople = [...people].filter((person) => person.active).sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
    return {
      hunters: sortedPeople.filter((person) => hunters.has(person.id)),
      deliveryManagers: sortedPeople.filter((person) => deliveryManagers.has(person.id)),
    };
  }, [people, rows]);
  const filteredRows = useMemo(() => {
    if (loading || error) return [];
    const filtered = filterCustomerResponsibilityRows(rows, { search, coverage, hunterId, deliveryManagerId });
    if (sort) filtered.sort((first, second) =>
      first[sort.key].localeCompare(second[sort.key], "pt-BR", { sensitivity: "base", numeric: true })
      * (sort.direction === "asc" ? 1 : -1),
    );
    return filtered;
  }, [coverage, deliveryManagerId, error, hunterId, loading, rows, search, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pendingCount = filteredRows.filter((row) => row.hasPending).length;
  const unavailable = loading || Boolean(error);
  const hasFilters = Boolean(search || hunterId || deliveryManagerId || coverage !== "all");

  function clearFilters() {
    setSearch("");
    setHunterId("");
    setDeliveryManagerId("");
    setCoverage("all");
    setPage(1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Relatórios"
        title="Relatório de Clientes"
        description="Hunters e Delivery Managers/Farmers ativos vinculados a cada cliente, incluindo clientes sem responsáveis."
        actions={<ReportExportActions title="Relatório de Clientes e Responsáveis" filename="relatorio-clientes-responsaveis" rows={filteredRows} columns={customerResponsibilityColumns} />}
      />
      <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Cobertura dos clientes selecionados">
        <KpiSummaryCard label="Clientes selecionados" value={unavailable ? "—" : filteredRows.length} />
        <KpiSummaryCard label="Com Hunter e Delivery/Farmer" value={unavailable ? "—" : filteredRows.length - pendingCount} tone="ok" />
        <KpiSummaryCard label="Com pendências" value={unavailable ? "—" : pendingCount} tone="warning" />
      </section>
      <div className="mb-3 grid gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm font-medium">
          <span>Buscar cliente ou responsável</span>
          <Input value={search} placeholder="Nome do cliente, Hunter ou Delivery/Farmer" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Hunter</span>
          <Select value={hunterId} onChange={(event) => { setHunterId(event.target.value); setPage(1); }} disabled={unavailable}>
            <option value="">Todos os Hunters</option>
            {responsibleOptions.hunters.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Delivery Manager / Farmer</span>
          <Select value={deliveryManagerId} onChange={(event) => { setDeliveryManagerId(event.target.value); setPage(1); }} disabled={unavailable}>
            <option value="">Todos os responsáveis</option>
            {responsibleOptions.deliveryManagers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Responsáveis</span>
          <Select value={coverage} onChange={(event) => {
            const value = event.target.value;
            if (value === "all" || value === "pending" || value === "complete") setCoverage(value);
            setPage(1);
          }}>
            <option value="all">Todos os clientes</option>
            <option value="pending">Com pendências</option>
            <option value="complete">Com Hunter e Delivery/Farmer</option>
          </Select>
        </label>
      </div>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>Limpar filtros</Button>
      </div>
      <p className="mb-3 text-sm text-slate-500" role="status">
        {loading ? "Carregando clientes e responsáveis..." : error ? "Relatório indisponível." : `${filteredRows.length} de ${rows.length} cliente(s) · exportação inclui todos os resultados filtrados.`}
      </p>
      {error ? <ErrorNotice message="Não foi possível carregar o relatório. Recarregue a página para tentar novamente." /> : loading ? null : (
        <Card className="overflow-hidden">
          {filteredRows.length === 0 ? <EmptyState message="Nenhum cliente encontrado para os filtros selecionados." /> : (
            <>
              <div className="overflow-x-auto" role="region" aria-label="Clientes e responsáveis" tabIndex={0}>
                <Table>
                  <caption className="sr-only">Clientes com Hunters e Delivery Managers/Farmers responsáveis</caption>
                  <TableHeader>
                    <TableRow>
                      {customerResponsibilityColumns.map((column) => (
                        <SortableTableHead key={column.key} label={column.label} sortKey={column.key} sortState={sort} onSort={(nextSort) => { setSort(nextSort); setPage(1); }} />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => (
                      <TableRow key={row.customerId}>
                        <TableCell className="font-semibold">{row.customerName}</TableCell>
                        <TableCell className="min-w-48 max-w-sm whitespace-normal break-words">{row.huntersText}</TableCell>
                        <TableCell className="min-w-48 max-w-sm whitespace-normal break-words">{row.deliveryManagersText}</TableCell>
                        <TableCell className={row.hasPending ? "text-amber-700" : "text-emerald-700"}>{row.coverageLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                <p className="text-sm text-slate-500">Página {currentPage} de {pageCount}</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
                  <Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
