"use client";

import Link from "next/link";
import { ArrowUpRight, Target, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { formatCurrency } from "@/lib/utils";
import { isTargetAssignableRole } from "@/lib/roles";

const currentYear = 2026;

export function PersonTargetReport() {
  const { areas, people, customers, targetAllocations, studioTargetAllocations } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [roleType, setRoleType] = useState("");

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
  const rows = useMemo(() => buildRows(assignablePeople, targetAllocations, customerNames, Number(year) || currentYear), [assignablePeople, customerNames, targetAllocations, year]);
  const areaStudioRows = useMemo(
    () => buildAreaStudioRows(areas, customers, studioTargetAllocations, Number(year) || currentYear),
    [areas, customers, studioTargetAllocations, year],
  );
  const hunterClientRows = useMemo(
    () => buildHunterClientRows(people, customers, targetAllocations, studioTargetAllocations, areaNames, Number(year) || currentYear),
    [areaNames, customers, people, studioTargetAllocations, targetAllocations, year],
  );
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.personName} ${row.roleType} ${row.customerNames.join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType);
  }), [roleType, rows, search]);
  const totals = useMemo(() => filteredRows.reduce((summary, row) => ({
    hunter: summary.hunter + row.hunter,
    farmerRenewal: summary.farmerRenewal + row.farmerRenewal,
    peopleWithTargets: summary.peopleWithTargets + (row.total > 0 ? 1 : 0),
  }), { hunter: 0, farmerRenewal: 0, peopleWithTargets: 0 }), [filteredRows]);
  const roleTypes = useMemo(() => Array.from(new Set(assignablePeople.map((person) => person.roleType))).sort((a, b) => a.localeCompare(b, "pt-BR")), [assignablePeople]);
  const personReportColumns = useMemo<ReportColumn<(typeof filteredRows)[number]>[]>(() => [
    { key: "personName", label: "Pessoa", value: (row) => row.personName },
    { key: "email", label: "E-mail", value: (row) => row.email ?? "" },
    { key: "roleType", label: "Perfil", value: (row) => row.roleType },
    { key: "customerCount", label: "Qtd. clientes", value: (row) => row.customerCount, format: "number", align: "right" },
    { key: "customerNames", label: "Clientes", value: (row) => row.customerNames.join(", ") },
    { key: "hunter", label: "Meta Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
    { key: "farmerRenewal", label: "Renovação + Ampliação", value: (row) => row.farmerRenewal, format: "currency", align: "right" },
    { key: "total", label: "Meta Total", value: (row) => row.total, format: "currency", align: "right" },
  ], []);
  const hunterClientColumns = useMemo<ReportColumn<(typeof hunterClientRows)[number]>[]>(() => [
    { key: "hunterName", label: "Hunter", value: (row) => row.hunterName },
    { key: "roleType", label: "Perfil", value: (row) => row.roleType },
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "ownHunter", label: "Hunter próprio", value: (row) => row.ownHunter, format: "currency", align: "right" },
    { key: "studioHunter", label: "Studio Hunter", value: (row) => row.studioHunter, format: "currency", align: "right" },
    { key: "totalHunter", label: "Total Hunter", value: (row) => row.totalHunter, format: "currency", align: "right" },
    { key: "studioBreakdown", label: "Composição Studio", value: (row) => row.studioBreakdown.map((item) => `${item.areaName}: ${formatCurrency(item.amount)}`).join(" | ") },
  ], []);
  const areaStudioColumns = useMemo<ReportColumn<(typeof areaStudioRows)[number]>[]>(() => [
    { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
    { key: "clientCount", label: "Qtd. clientes", value: (row) => row.clients.length, format: "number", align: "right" },
    { key: "clients", label: "Clientes", value: (row) => row.clients.map((client) => `${client.customerName}: ${formatCurrency(client.total)}`).join(" | ") },
    { key: "hunter", label: "Studio Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
    { key: "maintenance", label: "Studio Manutenção", value: (row) => row.maintenance, format: "currency", align: "right" },
    { key: "total", label: "Total", value: (row) => row.total, format: "currency", align: "right" },
  ], []);

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Relatório de Pessoas e Metas"
        description="Veja metas por pessoa, ano, tipo de meta e clientes associados. Clique em ajustar para abrir a tela operacional da pessoa."
        actions={(
          <div className="flex flex-wrap gap-2">
            <ReportExportActions
              title={`Relatório de Pessoas e Metas · ${year}`}
              filename={`relatorio-pessoas-metas-${year}`}
              rows={filteredRows}
              columns={personReportColumns}
            />
            <Button asChild><Link href="/metas-pessoas"><Target className="h-4 w-4" /> Ajustar metas</Link></Button>
          </div>
        )}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Summary label="Pessoas com meta" value={String(totals.peopleWithTargets)} />
        <Summary label="Meta Hunter" value={formatCurrency(totals.hunter)} />
        <Summary label="Renovação + Ampliação" value={formatCurrency(totals.farmerRenewal)} />
        <Summary label="Meta Total" value={formatCurrency(totals.hunter + totals.farmerRenewal)} />
      </section>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select value={roleType} onChange={(event) => setRoleType(event.target.value)}>
          <option value="">Todos os perfis</option>
          {roleTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </FilterBar>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Visão por Área/Studio</h2>
            <p className="mt-1 text-sm text-slate-500">Agrupa cada área/studio e mostra os clientes como detalhes da composição.</p>
          </div>
          <ReportExportActions
            title={`Relatório por Área/Studio · ${year}`}
            filename={`relatorio-area-studio-${year}`}
            rows={areaStudioRows}
            columns={areaStudioColumns}
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Área / Studio</TableHead>
                <TableHead>Clientes detalhados</TableHead>
                <TableHead>Studio Hunter</TableHead>
                <TableHead>Studio Manutenção</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areaStudioRows.map((row) => (
                <TableRow key={row.areaId}>
                  <TableCell>
                    <p className="font-bold text-slate-950">{row.areaName}</p>
                    <p className="text-xs text-slate-400">{row.clients.length} cliente(s)</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-2xl flex-wrap gap-2">
                      {row.clients.slice(0, 8).map((client) => (
                        <Badge key={client.customerId} variant="secondary">
                          {client.customerName} · {formatCurrency(client.total)}
                        </Badge>
                      ))}
                      {row.clients.length > 8 && <Badge variant="secondary">+{row.clients.length - 8}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(row.hunter)}</TableCell>
                  <TableCell>{formatCurrency(row.maintenance)}</TableCell>
                  <TableCell className="font-bold text-slate-950">{formatCurrency(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!areaStudioRows.length && <EmptyState message="Nenhuma meta de área/studio foi encontrada para o ano selecionado." />}
      </Card>

      <Card className="mb-5 overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Visão Hunter por Cliente</h2>
            <p className="mt-1 text-sm text-slate-500">Separa o valor próprio do hunter e a composição de Studio Hunter dentro de cada cliente.</p>
          </div>
          <ReportExportActions
            title={`Visão Hunter por Cliente · ${year}`}
            filename={`relatorio-hunter-cliente-${year}`}
            rows={hunterClientRows}
            columns={hunterClientColumns}
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Hunter</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Hunter próprio</TableHead>
                <TableHead>Studio Hunter</TableHead>
                <TableHead>Total Hunter</TableHead>
                <TableHead>Composição Studio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hunterClientRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <p className="font-bold text-slate-950">{row.hunterName}</p>
                    <p className="text-xs text-slate-400">{row.roleType}</p>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">{row.customerName}</TableCell>
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
        {!hunterClientRows.length && <EmptyState message="Nenhuma meta Hunter foi encontrada para o ano selecionado." />}
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1220px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Meta Hunter</TableHead>
                <TableHead>Meta Renovação + Ampliação</TableHead>
                <TableHead>Meta Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
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
        {!filteredRows.length && <EmptyState />}
      </Card>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </Card>
  );
}

function buildRows(
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
      studio: 0,
      total: hunter + farmerRenewal,
    };
  }).sort((a, b) => b.total - a.total || a.personName.localeCompare(b.personName, "pt-BR"));
}

function buildAreaStudioRows(
  areas: Array<{ id: string; name: string }>,
  customers: Array<{ id: string; name: string }>,
  allocations: Array<{ customerId: string; areaId: string; year: number; hunterAmount: number; maintenanceAmount: number }>,
  year: number,
) {
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const groups = new Map<string, {
    areaId: string;
    areaName: string;
    hunter: number;
    maintenance: number;
    total: number;
    clients: Map<string, {
      customerId: string;
      customerName: string;
      hunter: number;
      maintenance: number;
      total: number;
    }>;
  }>();

  allocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount + allocation.maintenanceAmount > 0)
    .forEach((allocation) => {
      const group = groups.get(allocation.areaId) ?? {
        areaId: allocation.areaId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        hunter: 0,
        maintenance: 0,
        total: 0,
        clients: new Map(),
      };
      const client = group.clients.get(allocation.customerId) ?? {
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        hunter: 0,
        maintenance: 0,
        total: 0,
      };

      client.hunter += allocation.hunterAmount;
      client.maintenance += allocation.maintenanceAmount;
      client.total = client.hunter + client.maintenance;
      group.hunter += allocation.hunterAmount;
      group.maintenance += allocation.maintenanceAmount;
      group.total = group.hunter + group.maintenance;
      group.clients.set(allocation.customerId, client);
      groups.set(allocation.areaId, group);
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    clients: Array.from(group.clients.values()).sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName, "pt-BR")),
  })).sort((a, b) => b.total - a.total || a.areaName.localeCompare(b.areaName, "pt-BR"));
}

function buildHunterClientRows(
  people: Array<{ id: string; name: string; roleType: string }>,
  customers: Array<{ id: string; name: string }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number }>,
  studioAllocations: Array<{ customerId: string; areaId: string; year: number; hunterAmount: number }>,
  areaNames: Map<string, string>,
  year: number,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const studioByCustomer = new Map<string, Array<{ areaId: string; areaName: string; amount: number }>>();

  studioAllocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount > 0)
    .forEach((allocation) => {
      const items = studioByCustomer.get(allocation.customerId) ?? [];
      items.push({
        areaId: allocation.areaId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        amount: allocation.hunterAmount,
      });
      studioByCustomer.set(allocation.customerId, items);
    });

  const rows = allocations
    .filter((allocation) => allocation.year === year && allocation.type === "hunter" && allocation.amount > 0)
    .map((allocation) => {
      const person = peopleById.get(allocation.personId);
      const studioBreakdown = studioByCustomer.get(allocation.customerId) ?? [];
      const studioHunter = studioBreakdown.reduce((total, item) => total + item.amount, 0);
      return {
        key: `${allocation.personId}-${allocation.customerId}`,
        customerId: allocation.customerId,
        hunterName: person?.name ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Hunter",
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        ownHunter: allocation.amount,
        studioHunter,
        totalHunter: allocation.amount + studioHunter,
        studioBreakdown,
      };
    });

  const customersWithHunterAllocation = new Set(rows.map((row) => row.customerId));
  studioByCustomer.forEach((studioBreakdown, customerId) => {
    if (customersWithHunterAllocation.has(customerId)) return;
    const studioHunter = studioBreakdown.reduce((total, item) => total + item.amount, 0);
    rows.push({
      key: `studio-only-${customerId}`,
      customerId,
      hunterName: "Sem hunter próprio alocado",
      roleType: "Studio Hunter",
      customerName: customerNames.get(customerId) ?? customerId,
      ownHunter: 0,
      studioHunter,
      totalHunter: studioHunter,
      studioBreakdown,
    });
  });

  return rows
    .filter((row) => row.ownHunter > 0 || row.studioHunter > 0)
    .sort((a, b) => b.totalHunter - a.totalHunter || a.hunterName.localeCompare(b.hunterName, "pt-BR"));
}
