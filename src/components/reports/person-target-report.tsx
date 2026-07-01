"use client";

import Link from "next/link";
import { ArrowUpRight, Target, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
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
  const { people, customers, targetAllocations } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [roleType, setRoleType] = useState("");

  const assignablePeople = useMemo(
    () => people.filter((person) => person.active && isTargetAssignableRole(person.roleType)),
    [people],
  );
  const years = useMemo(
    () => Array.from(new Set([currentYear, ...targetAllocations.map((allocation) => allocation.year)])).sort((a, b) => b - a),
    [targetAllocations],
  );
  const customerNames = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.name])), [customers]);
  const rows = useMemo(() => buildRows(assignablePeople, targetAllocations, customerNames, Number(year) || currentYear), [assignablePeople, customerNames, targetAllocations, year]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.personName} ${row.roleType} ${row.customerNames.join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType);
  }), [roleType, rows, search]);
  const totals = useMemo(() => filteredRows.reduce((summary, row) => ({
    hunter: summary.hunter + row.hunter,
    farmerRenewal: summary.farmerRenewal + row.farmerRenewal,
    studio: summary.studio + row.studio,
    peopleWithTargets: summary.peopleWithTargets + (row.total > 0 ? 1 : 0),
  }), { hunter: 0, farmerRenewal: 0, studio: 0, peopleWithTargets: 0 }), [filteredRows]);
  const roleTypes = useMemo(() => Array.from(new Set(assignablePeople.map((person) => person.roleType))).sort((a, b) => a.localeCompare(b, "pt-BR")), [assignablePeople]);

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Relatório de Pessoas e Metas"
        description="Veja metas por pessoa, ano, tipo de meta e clientes associados. Clique em ajustar para abrir a tela operacional da pessoa."
        actions={<Button asChild><Link href="/metas-pessoas"><Target className="h-4 w-4" /> Ajustar metas</Link></Button>}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Summary label="Pessoas com meta" value={String(totals.peopleWithTargets)} />
        <Summary label="Meta Hunter" value={formatCurrency(totals.hunter)} />
        <Summary label="Renovação + Ampliação" value={formatCurrency(totals.farmerRenewal)} />
        <Summary label="Áreas / Studios" value={formatCurrency(totals.studio)} />
        <Summary label="Meta Total" value={formatCurrency(totals.hunter + totals.farmerRenewal + totals.studio)} />
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
                <TableHead>Meta Áreas / Studios</TableHead>
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
                  <TableCell>{formatCurrency(row.studio)}</TableCell>
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
    const personAllocations = allocations.filter((allocation) => allocation.personId === person.id && allocation.year === year);
    const hunter = personAllocations
      .filter((allocation) => allocation.type === "hunter")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const farmerRenewal = personAllocations
      .filter((allocation) => allocation.type === "farmer_renewal")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const studio = personAllocations
      .filter((allocation) => allocation.type === "studio")
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
      studio,
      total: hunter + farmerRenewal + studio,
    };
  }).sort((a, b) => b.total - a.total || a.personName.localeCompare(b.personName, "pt-BR"));
}
