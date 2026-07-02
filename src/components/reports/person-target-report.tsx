"use client";

import Link from "next/link";
import { ArrowUpRight, Target, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { formatCurrency } from "@/lib/utils";
import { isTargetAssignableRole } from "@/lib/roles";

const currentYear = 2026;

type ReportView = "people" | "areas" | "hunters";
type PeopleSortKey = "person" | "role" | "clients" | "hunter" | "renewal" | "total" | "status";
type AreaSortKey = "area" | "clients" | "hunter" | "maintenance" | "total";
type HunterSortKey = "hunter" | "role" | "ownHunter" | "studioHunter" | "totalHunter" | "studios";

export function PersonTargetReport() {
  const { areas, people, customers, targetAllocations, studioTargetAllocations } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [roleType, setRoleType] = useState("");
  const [view, setView] = useState<ReportView>("people");
  const [peopleSort, setPeopleSort] = useState<SortState<PeopleSortKey>>({ key: "total", direction: "desc" });
  const [areaSort, setAreaSort] = useState<SortState<AreaSortKey>>({ key: "total", direction: "desc" });
  const [hunterSort, setHunterSort] = useState<SortState<HunterSortKey>>({ key: "totalHunter", direction: "desc" });

  const selectedYear = Number(year) || currentYear;
  const assignablePeople = useMemo(
    () => people.filter((person) => person.active && isTargetAssignableRole(person.roleType)),
    [people],
  );
  const years = useMemo(
    () => Array.from(new Set([
      currentYear,
      ...targetAllocations.map((allocation) => allocation.year),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((a, b) => b - a),
    [studioTargetAllocations, targetAllocations],
  );
  const customerNames = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.name])), [customers]);
  const areaNames = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas]);
  const peopleRows = useMemo(() => buildPeopleRows(assignablePeople, targetAllocations, customerNames, selectedYear), [assignablePeople, customerNames, selectedYear, targetAllocations]);
  const areaRows = useMemo(
    () => buildAreaStudioRows(areas, customers, studioTargetAllocations, selectedYear),
    [areas, customers, selectedYear, studioTargetAllocations],
  );
  const hunterRows = useMemo(
    () => buildHunterRows(people, targetAllocations, studioTargetAllocations, areaNames, selectedYear),
    [areaNames, people, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const filteredPeopleRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortPeopleRows(peopleRows.filter((row) =>
      (!query || `${row.personName} ${row.roleType} ${row.customerNames.join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType)
    ), peopleSort);
  }, [peopleRows, peopleSort, roleType, search]);
  const filteredAreaRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortAreaRows(areaRows.filter((row) =>
      !query || `${row.areaName} ${row.clients.map((client) => client.customerName).join(" ")}`.toLowerCase().includes(query)
    ), areaSort);
  }, [areaRows, areaSort, search]);
  const filteredHunterRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortHunterRows(hunterRows.filter((row) =>
      (!query || `${row.hunterName} ${row.roleType} ${row.studioBreakdown.map((item) => item.areaName).join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType)
    ), hunterSort);
  }, [hunterRows, hunterSort, roleType, search]);
  const activeRows = view === "people" ? filteredPeopleRows : view === "areas" ? filteredAreaRows : filteredHunterRows;
  const totals = useMemo(() => getViewTotals(view, filteredPeopleRows, filteredAreaRows, filteredHunterRows), [filteredAreaRows, filteredHunterRows, filteredPeopleRows, view]);
  const roleTypes = useMemo(() => Array.from(new Set(assignablePeople.map((person) => person.roleType))).sort((a, b) => a.localeCompare(b, "pt-BR")), [assignablePeople]);

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Relatório de Metas"
        description="Escolha a visão de análise e exporte a tabela atual com valores numéricos preservados para Excel."
        actions={(
          <div className="flex flex-wrap gap-2">
            {view === "people" && (
              <ReportExportActions
                title={`Relatório de Pessoas e Metas · ${year}`}
                filename={`relatorio-pessoas-metas-${year}`}
                rows={filteredPeopleRows}
                columns={peopleReportColumns}
              />
            )}
            {view === "areas" && (
              <ReportExportActions
                title={`Relatório por Área/Studio · ${year}`}
                filename={`relatorio-area-studio-${year}`}
                rows={filteredAreaRows}
                columns={areaReportColumns}
              />
            )}
            {view === "hunters" && (
              <ReportExportActions
                title={`Relatório por Hunter · ${year}`}
                filename={`relatorio-hunter-${year}`}
                rows={filteredHunterRows}
                columns={hunterReportColumns}
              />
            )}
            <Button asChild><Link href="/metas-pessoas"><Target className="h-4 w-4" /> Ajustar metas</Link></Button>
          </div>
        )}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary label={totals.countLabel} value={String(totals.count)} />
        <Summary label={totals.firstLabel} value={formatCurrency(totals.first)} />
        <Summary label={totals.secondLabel} value={formatCurrency(totals.second)} />
        <Summary label="Total" value={formatCurrency(totals.total)} />
      </section>

      <Card className="mb-5 p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "people", label: "Pessoas" },
              { key: "areas", label: "Áreas / Studios" },
              { key: "hunters", label: "Hunters" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  view === item.key
                    ? "bg-brq-purple text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setView(item.key as ReportView)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">{getViewDescription(view)}</p>
        </div>
      </Card>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        {view !== "areas" && (
          <Select value={roleType} onChange={(event) => setRoleType(event.target.value)}>
            <option value="">Todos os perfis</option>
            {roleTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        )}
      </FilterBar>

      {view === "people" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Pessoa" sortKey="person" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Perfil" sortKey="role" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Clientes" sortKey="clients" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Meta Hunter" sortKey="hunter" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Renovação + Ampliação" sortKey="renewal" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Meta Total" sortKey="total" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Status" sortKey="status" sortState={peopleSort} onSort={setPeopleSort} />
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeopleRows.map((row) => (
                  <TableRow
                    key={row.personId}
                    className="cursor-pointer"
                    title="Dê duplo clique para ajustar as metas da pessoa"
                    onDoubleClick={() => {
                      window.location.href = `/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(year)}`;
                    }}
                  >
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
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(year)}`}>
                            Ajustar <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!activeRows.length && <EmptyState />}
        </Card>
      )}

      {view === "areas" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Área / Studio" sortKey="area" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Clientes" sortKey="clients" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Studio Hunter" sortKey="hunter" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Studio Manutenção" sortKey="maintenance" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Total" sortKey="total" sortState={areaSort} onSort={setAreaSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAreaRows.map((row) => (
                  <TableRow key={row.areaId}>
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
          {!activeRows.length && <EmptyState message="Nenhuma meta de área/studio foi encontrada para o ano selecionado." />}
        </Card>
      )}

      {view === "hunters" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Hunter" sortKey="hunter" sortState={hunterSort} onSort={setHunterSort} />
                  <SortableTableHead label="Perfil" sortKey="role" sortState={hunterSort} onSort={setHunterSort} />
                  <SortableTableHead label="Hunter próprio" sortKey="ownHunter" sortState={hunterSort} onSort={setHunterSort} />
                  <SortableTableHead label="Studio Hunter" sortKey="studioHunter" sortState={hunterSort} onSort={setHunterSort} />
                  <SortableTableHead label="Total Hunter" sortKey="totalHunter" sortState={hunterSort} onSort={setHunterSort} />
                  <SortableTableHead label="Composição Studio" sortKey="studios" sortState={hunterSort} onSort={setHunterSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHunterRows.map((row) => (
                  <TableRow key={row.hunterId}>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.hunterName}</p>
                      <p className="text-xs text-slate-400">{row.customerCount} cliente(s) na composição</p>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{row.roleType}</Badge></TableCell>
                    <TableCell>{formatCurrency(row.ownHunter)}</TableCell>
                    <TableCell className="text-sky-700">{formatCurrency(row.studioHunter)}</TableCell>
                    <TableCell className="font-bold text-slate-950">{formatCurrency(row.totalHunter)}</TableCell>
                    <TableCell>
                      <div className="flex max-w-xl flex-wrap gap-2">
                        {row.studioBreakdown.length === 0 && <span className="text-sm text-slate-400">Sem Studio Hunter</span>}
                        {row.studioBreakdown.map((item) => (
                          <Badge key={item.areaId} className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                            {item.areaName} · {formatCurrency(item.amount)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!activeRows.length && <EmptyState message="Nenhuma meta Hunter foi encontrada para o ano selecionado." />}
        </Card>
      )}
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5 shadow-sm">
      <p className="min-h-8 text-xs font-semibold uppercase leading-4 tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{value}</p>
    </Card>
  );
}

function getViewDescription(view: ReportView) {
  if (view === "areas") return "Metas agrupadas por Área/Studio, com clientes apenas como detalhe.";
  if (view === "hunters") return "Metas consolidadas por Hunter, sem repetir uma linha por cliente.";
  return "Metas operacionais por pessoa, com acesso rápido para ajuste.";
}

function buildPeopleRows(
  people: Array<{ id: string; name: string; email?: string; roleType: string }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number }>,
  customerNames: Map<string, string>,
  year: number,
) {
  return people.map((person) => {
    const personAllocations = allocations.filter((allocation) =>
      allocation.personId === person.id
      && allocation.year === year
      && allocation.type !== "studio"
    );
    const hunter = personAllocations
      .filter((allocation) => allocation.type === "hunter")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const farmerRenewal = personAllocations
      .filter((allocation) => allocation.type === "farmer_renewal")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const names = Array.from(new Set(personAllocations.map((allocation) => customerNames.get(allocation.customerId) ?? allocation.customerId)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    return {
      personId: person.id,
      personName: person.name,
      email: person.email,
      roleType: person.roleType,
      customerCount: names.length,
      customerNames: names,
      hunter,
      farmerRenewal,
      total: hunter + farmerRenewal,
    };
  });
}

function buildAreaStudioRows(
  areas: Array<{ id: string; name: string }>,
  customers: Array<{ id: string; name: string }>,
  allocations: Array<{ customerId: string; areaId: string; year: number; hunterAmount: number; maintenanceAmount: number }>,
  year: number,
) {
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const groups = new Map<string, AreaStudioRow>();

  allocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount + allocation.maintenanceAmount > 0)
    .forEach((allocation) => {
      const group = groups.get(allocation.areaId) ?? {
        areaId: allocation.areaId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        hunter: 0,
        maintenance: 0,
        total: 0,
        clients: [],
      };
      const client = group.clients.find((item) => item.customerId === allocation.customerId) ?? {
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        hunter: 0,
        maintenance: 0,
        total: 0,
      };

      if (!group.clients.some((item) => item.customerId === allocation.customerId)) {
        group.clients.push(client);
      }
      client.hunter += allocation.hunterAmount;
      client.maintenance += allocation.maintenanceAmount;
      client.total = client.hunter + client.maintenance;
      group.hunter += allocation.hunterAmount;
      group.maintenance += allocation.maintenanceAmount;
      group.total = group.hunter + group.maintenance;
      groups.set(allocation.areaId, group);
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    clients: group.clients.sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName, "pt-BR")),
  }));
}

function buildHunterRows(
  people: Array<{ id: string; name: string; roleType: string }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number }>,
  studioAllocations: Array<{ customerId: string; areaId: string; year: number; hunterAmount: number }>,
  areaNames: Map<string, string>,
  year: number,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rows = new Map<string, HunterRow>();
  const studioByCustomer = new Map<string, Array<{ areaId: string; areaName: string; amount: number }>>();

  studioAllocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount > 0)
    .forEach((allocation) => {
      const items = studioByCustomer.get(allocation.customerId) ?? [];
      const existing = items.find((item) => item.areaId === allocation.areaId);
      if (existing) {
        existing.amount += allocation.hunterAmount;
      } else {
        items.push({
          areaId: allocation.areaId,
          areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
          amount: allocation.hunterAmount,
        });
      }
      studioByCustomer.set(allocation.customerId, items);
    });

  allocations
    .filter((allocation) => allocation.year === year && allocation.type === "hunter" && allocation.amount > 0)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const row = rows.get(allocation.personId) ?? {
        hunterId: allocation.personId,
        hunterName: person?.name ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Hunter",
        ownHunter: 0,
        studioHunter: 0,
        totalHunter: 0,
        customerIds: new Set<string>(),
        customerCount: 0,
        studioBreakdown: [],
      } satisfies HunterRow;
      row.ownHunter += allocation.amount;
      row.customerIds.add(allocation.customerId);
      const studioItems = studioByCustomer.get(allocation.customerId) ?? [];
      studioItems.forEach((studio) => {
        const existing = row.studioBreakdown.find((item) => item.areaId === studio.areaId);
        if (existing) {
          existing.amount += studio.amount;
        } else {
          row.studioBreakdown.push({ ...studio });
        }
        row.studioHunter += studio.amount;
      });
      row.totalHunter = row.ownHunter + row.studioHunter;
      rows.set(allocation.personId, row);
    });

  return Array.from(rows.values()).map((row) => ({
    ...row,
    customerCount: row.customerIds.size,
    studioBreakdown: row.studioBreakdown.sort((a, b) => b.amount - a.amount || a.areaName.localeCompare(b.areaName, "pt-BR")),
  }));
}

function getViewTotals(view: ReportView, peopleRows: PeopleRow[], areaRows: AreaStudioRow[], hunterRows: HunterRow[]) {
  if (view === "areas") {
    return areaRows.reduce((summary, row) => ({
      countLabel: "Áreas/Studios com meta",
      count: summary.count + 1,
      firstLabel: "Studio Hunter",
      first: summary.first + row.hunter,
      secondLabel: "Studio Manutenção",
      second: summary.second + row.maintenance,
      total: summary.total + row.total,
    }), emptyTotals("Áreas/Studios com meta", "Studio Hunter", "Studio Manutenção"));
  }
  if (view === "hunters") {
    return hunterRows.reduce((summary, row) => ({
      countLabel: "Hunters com meta",
      count: summary.count + 1,
      firstLabel: "Hunter próprio",
      first: summary.first + row.ownHunter,
      secondLabel: "Studio Hunter",
      second: summary.second + row.studioHunter,
      total: summary.total + row.totalHunter,
    }), emptyTotals("Hunters com meta", "Hunter próprio", "Studio Hunter"));
  }
  return peopleRows.reduce((summary, row) => ({
    countLabel: "Pessoas com meta",
    count: summary.count + (row.total > 0 ? 1 : 0),
    firstLabel: "Meta Hunter",
    first: summary.first + row.hunter,
    secondLabel: "Renovação + Ampliação",
    second: summary.second + row.farmerRenewal,
    total: summary.total + row.total,
  }), emptyTotals("Pessoas com meta", "Meta Hunter", "Renovação + Ampliação"));
}

function emptyTotals(countLabel: string, firstLabel: string, secondLabel: string) {
  return { countLabel, count: 0, firstLabel, first: 0, secondLabel, second: 0, total: 0 };
}

const peopleReportColumns: ReportColumn<PeopleRow>[] = [
  { key: "personName", label: "Pessoa", value: (row) => row.personName },
  { key: "email", label: "E-mail", value: (row) => row.email ?? "" },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerCount", label: "Qtd. clientes", value: (row) => row.customerCount, format: "number", align: "right" },
  { key: "customerNames", label: "Clientes", value: (row) => row.customerNames.join(", ") },
  { key: "hunter", label: "Meta Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
  { key: "farmerRenewal", label: "Renovação + Ampliação", value: (row) => row.farmerRenewal, format: "currency", align: "right" },
  { key: "total", label: "Meta Total", value: (row) => row.total, format: "currency", align: "right" },
];

const areaReportColumns: ReportColumn<AreaStudioRow>[] = [
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "clientCount", label: "Qtd. clientes", value: (row) => row.clients.length, format: "number", align: "right" },
  { key: "clients", label: "Clientes", value: (row) => row.clients.map((client) => `${client.customerName}: ${formatCurrency(client.total)}`).join(" | ") },
  { key: "hunter", label: "Studio Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
  { key: "maintenance", label: "Studio Manutenção", value: (row) => row.maintenance, format: "currency", align: "right" },
  { key: "total", label: "Total", value: (row) => row.total, format: "currency", align: "right" },
];

const hunterReportColumns: ReportColumn<HunterRow>[] = [
  { key: "hunterName", label: "Hunter", value: (row) => row.hunterName },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerCount", label: "Qtd. clientes", value: (row) => row.customerCount, format: "number", align: "right" },
  { key: "ownHunter", label: "Hunter próprio", value: (row) => row.ownHunter, format: "currency", align: "right" },
  { key: "studioHunter", label: "Studio Hunter", value: (row) => row.studioHunter, format: "currency", align: "right" },
  { key: "totalHunter", label: "Total Hunter", value: (row) => row.totalHunter, format: "currency", align: "right" },
  { key: "studioBreakdown", label: "Composição Studio", value: (row) => row.studioBreakdown.map((item) => `${item.areaName}: ${formatCurrency(item.amount)}`).join(" | ") },
];

function sortPeopleRows(rows: PeopleRow[], sortState: SortState<PeopleSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "person") return compareText(first.personName, second.personName);
    if (sortState.key === "role") return compareText(first.roleType, second.roleType);
    if (sortState.key === "clients") return compareNumber(first.customerCount, second.customerCount);
    if (sortState.key === "hunter") return compareNumber(first.hunter, second.hunter);
    if (sortState.key === "renewal") return compareNumber(first.farmerRenewal, second.farmerRenewal);
    if (sortState.key === "status") return compareNumber(first.total > 0 ? 1 : 0, second.total > 0 ? 1 : 0);
    return compareNumber(first.total, second.total);
  });
}

function sortAreaRows(rows: AreaStudioRow[], sortState: SortState<AreaSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "area") return compareText(first.areaName, second.areaName);
    if (sortState.key === "clients") return compareNumber(first.clients.length, second.clients.length);
    if (sortState.key === "hunter") return compareNumber(first.hunter, second.hunter);
    if (sortState.key === "maintenance") return compareNumber(first.maintenance, second.maintenance);
    return compareNumber(first.total, second.total);
  });
}

function sortHunterRows(rows: HunterRow[], sortState: SortState<HunterSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "hunter") return compareText(first.hunterName, second.hunterName);
    if (sortState.key === "role") return compareText(first.roleType, second.roleType);
    if (sortState.key === "ownHunter") return compareNumber(first.ownHunter, second.ownHunter);
    if (sortState.key === "studioHunter") return compareNumber(first.studioHunter, second.studioHunter);
    if (sortState.key === "studios") return compareText(first.studioBreakdown.map((item) => item.areaName).join(", "), second.studioBreakdown.map((item) => item.areaName).join(", "));
    return compareNumber(first.totalHunter, second.totalHunter);
  });
}

function sortRows<T>(rows: T[], direction: SortDirection, compare: (first: T, second: T) => number) {
  return [...rows].sort((first, second) => {
    const result = compare(first, second);
    return direction === "asc" ? result : -result;
  });
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "pt-BR", { sensitivity: "base", numeric: true });
}

function compareNumber(first: number, second: number) {
  return first - second;
}

type PeopleRow = ReturnType<typeof buildPeopleRows>[number];
type AreaStudioRow = {
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
};
type HunterRow = {
  hunterId: string;
  hunterName: string;
  roleType: string;
  ownHunter: number;
  studioHunter: number;
  totalHunter: number;
  customerIds: Set<string>;
  customerCount: number;
  studioBreakdown: Array<{ areaId: string; areaName: string; amount: number }>;
};
