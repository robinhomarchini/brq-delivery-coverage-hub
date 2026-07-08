"use client";

import { Save, SquareCheckBig, Target, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { isSpecialistHunterRole } from "@/lib/roles";
import { formatCurrency } from "@/lib/utils";

const currentYear = defaultTargetYear;

type SpecialistHunterTargetAssignmentProps = {
  initialPersonId?: string;
  initialYear?: number;
};

type SpecialistSelectionRow = {
  id: string;
  personId: string;
  customerId: string;
  customerName: string;
  areaName: string;
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
  notes?: string;
  pending: boolean;
};

export function SpecialistHunterTargetAssignment({ initialPersonId = "", initialYear }: SpecialistHunterTargetAssignmentProps) {
  const {
    people,
    customers,
    customerTargets,
    areas,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
    saveSpecialistHunterStudioAssignments,
  } = useDeliveryStore();
  const specialistHunters = useMemo(
    () => people
      .filter((person) => person.active && isSpecialistHunterRole(person.roleType))
      .sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
    [people],
  );
  const years = useMemo(
    () => Array.from(new Set([
      ...getAvailableTargetYears(customerTargets, currentYear),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((first, second) => second - first),
    [customerTargets, studioTargetAllocations],
  );
  const initialSafeYear = initialYear && Number.isFinite(initialYear) ? initialYear : currentYear;
  const [personId, setPersonId] = useState(initialPersonId);
  const [customerId, setCustomerId] = useState("");
  const [year, setYear] = useState(initialSafeYear);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedPerson = specialistHunters.find((person) => person.id === personId);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas]);
  const customersById = useMemo(() => new Map(yearCustomers.map((customer) => [customer.id, customer])), [yearCustomers]);
  const customersWithStudios = useMemo(() => {
    const customerIds = new Set(studioTargetAllocations
      .filter((allocation) => allocation.year === year && allocation.hunterAmount + allocation.maintenanceAmount > 0)
      .map((allocation) => allocation.customerId));
    return yearCustomers
      .filter((customer) => customerIds.has(customer.id))
      .sort((first, second) => {
        const firstLinked = selectedPerson?.clientIds.includes(first.id) ? 0 : 1;
        const secondLinked = selectedPerson?.clientIds.includes(second.id) ? 0 : 1;
        return firstLinked - secondLinked || first.name.localeCompare(second.name, "pt-BR");
      });
  }, [selectedPerson?.clientIds, studioTargetAllocations, year, yearCustomers]);
  const selectedCustomerId = customersWithStudios.some((customer) => customer.id === customerId) ? customerId : "";
  const studioRows = useMemo(() => studioTargetAllocations
    .filter((allocation) =>
      allocation.customerId === selectedCustomerId
      && allocation.year === year
      && allocation.hunterAmount + allocation.maintenanceAmount > 0
    )
    .map((allocation) => ({
      ...allocation,
      areaName: areasById.get(allocation.areaId) ?? allocation.areaId,
      total: allocation.hunterAmount + allocation.maintenanceAmount,
    }))
    .sort((first, second) => first.areaName.localeCompare(second.areaName, "pt-BR")),
  [areasById, selectedCustomerId, studioTargetAllocations, year]);
  const selectedRows = studioRows.filter((row) => selectedIds.has(row.id));
  const savedSelectionRows = useMemo<SpecialistSelectionRow[]>(() => {
    const allocationsById = new Map(studioTargetAllocations.map((allocation) => [allocation.id, allocation]));

    return specialistHunterStudioAssignments
      .filter((assignment) => assignment.personId === personId && assignment.year === year)
      .reduce<SpecialistSelectionRow[]>((rows, assignment) => {
        const allocation = allocationsById.get(assignment.studioTargetAllocationId);
        if (!allocation || allocation.hunterAmount + allocation.maintenanceAmount <= 0) return rows;
        rows.push({
          id: allocation.id,
          personId,
          customerId: allocation.customerId,
          customerName: customersById.get(allocation.customerId)?.name ?? allocation.customerId,
          areaName: areasById.get(allocation.areaId) ?? allocation.areaId,
          hunterAmount: allocation.hunterAmount,
          maintenanceAmount: allocation.maintenanceAmount,
          total: allocation.hunterAmount + allocation.maintenanceAmount,
          notes: allocation.notes,
          pending: false,
        });
        return rows;
      }, [])
      .sort((first, second) =>
        first.customerName.localeCompare(second.customerName, "pt-BR")
        || first.areaName.localeCompare(second.areaName, "pt-BR"));
  }, [areasById, customersById, personId, specialistHunterStudioAssignments, studioTargetAllocations, year]);
  const savedSelectionIds = useMemo(() => new Set(savedSelectionRows.map((row) => row.id)), [savedSelectionRows]);
  const pendingSelectionRows = useMemo<SpecialistSelectionRow[]>(() => selectedRows
    .filter((row) => !savedSelectionIds.has(row.id))
    .map((row) => ({
      id: row.id,
      personId,
      customerId: row.customerId,
      customerName: customersById.get(row.customerId)?.name ?? row.customerId,
      areaName: row.areaName,
      hunterAmount: row.hunterAmount,
      maintenanceAmount: row.maintenanceAmount,
      total: row.total,
      notes: row.notes,
      pending: true,
    })),
  [customersById, personId, savedSelectionIds, selectedRows]);
  const selectionSummaryRows = useMemo(
    () => [...savedSelectionRows, ...pendingSelectionRows].sort((first, second) =>
      first.customerName.localeCompare(second.customerName, "pt-BR")
      || first.areaName.localeCompare(second.areaName, "pt-BR")),
    [pendingSelectionRows, savedSelectionRows],
  );
  const selectedTotal = selectionSummaryRows.reduce((total, row) => total + row.total, 0);
  const selectedHunterTotal = selectionSummaryRows.reduce((total, row) => total + row.hunterAmount, 0);
  const selectedMaintenanceTotal = selectionSummaryRows.reduce((total, row) => total + row.maintenanceAmount, 0);
  const availableTotal = studioRows.reduce((total, row) => total + row.total, 0);

  function getSavedSelectionIds(nextPersonId: string, nextCustomerId: string, nextYear: number) {
    const studioIdsForCustomer = new Set(studioTargetAllocations
      .filter((allocation) =>
        allocation.customerId === nextCustomerId
        && allocation.year === nextYear
        && allocation.hunterAmount + allocation.maintenanceAmount > 0
      )
      .map((allocation) => allocation.id));

    return new Set(specialistHunterStudioAssignments
      .filter((assignment) =>
        assignment.personId === nextPersonId
        && assignment.year === nextYear
        && studioIdsForCustomer.has(assignment.studioTargetAllocationId)
      )
      .map((assignment) => assignment.studioTargetAllocationId));
  }

  function customerHasStudios(nextCustomerId: string, nextYear: number) {
    return studioTargetAllocations.some((allocation) =>
      allocation.customerId === nextCustomerId
      && allocation.year === nextYear
      && allocation.hunterAmount + allocation.maintenanceAmount > 0
    );
  }

  function handlePersonChange(nextPersonId: string) {
    setPersonId(nextPersonId);
    setSelectedIds(getSavedSelectionIds(nextPersonId, selectedCustomerId, year));
  }

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setSelectedIds(getSavedSelectionIds(personId, nextCustomerId, year));
  }

  function handleYearChange(nextYear: number) {
    const nextCustomerId = customerHasStudios(selectedCustomerId, nextYear) ? selectedCustomerId : "";
    setYear(nextYear);
    setCustomerId(nextCustomerId);
    setSelectedIds(getSavedSelectionIds(personId, nextCustomerId, nextYear));
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveSelection() {
    setSuccessMessage("");
    setErrorMessage("");

    if (!personId) {
      setErrorMessage("Selecione um Hunter Especializado.");
      return;
    }
    if (!selectedCustomerId) {
      setErrorMessage("Selecione um cliente com metas de Studio cadastradas.");
      return;
    }

    setSaving(true);
    try {
      await saveSpecialistHunterStudioAssignments({
        personId,
        customerId: selectedCustomerId,
        year,
        studioTargetAllocationIds: Array.from(selectedIds),
      });
      setSuccessMessage(`Meta gerencial de ${selectedPerson?.name ?? "Hunter Especializado"} salva para o cliente selecionado.`);
      setSelectedIds(new Set(selectedIds));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar a seleção.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Metas gerenciais"
        title="Hunter Especializado"
        description="Monte a meta gerencial do Hunter Especializado escolhendo quais metas de Studio do cliente entram na leitura dele. Essa seleção não altera metas oficiais nem totais do cliente."
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="grid gap-4 p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-end">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Hunter Especializado</span>
          <Select value={personId} onChange={(event) => handlePersonChange(event.target.value)}>
            <option value="">Selecione uma pessoa</option>
            {specialistHunters.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Ano</span>
          <Select value={String(year)} onChange={(event) => handleYearChange(Number(event.target.value))}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </label>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiSummaryCard label="Total selecionado" currencyValue={selectedTotal} icon={Target} tone="purple" />
        <KpiSummaryCard label="Studio Hunter selecionado" currencyValue={selectedHunterTotal} icon={SquareCheckBig} tone="blue" />
        <KpiSummaryCard label="Studio Manutenção selecionado" currencyValue={selectedMaintenanceTotal} icon={SquareCheckBig} tone="sky" />
        <KpiSummaryCard label="Disponível no cliente" currencyValue={availableTotal} icon={UsersRound} tone="neutral" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-bold text-slate-950">Nova inclusão</h2>
            <p className="text-sm text-slate-500">
              Escolha um cliente e marque as linhas de Studio que entram na meta gerencial.
            </p>
          </div>
          <div className="grid gap-4 p-5">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Cliente</span>
              <Select value={selectedCustomerId} onChange={(event) => handleCustomerChange(event.target.value)} disabled={!personId || !customersWithStudios.length}>
                <option value="">{customersWithStudios.length ? "Selecione um cliente" : "Sem clientes com Studio no ano"}</option>
                {customersWithStudios.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </label>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Usar</TableHead>
                    <TableHead>Área / Studio</TableHead>
                    <TableHead className="text-right">Studio Hunter</TableHead>
                    <TableHead className="text-right">Manutenção</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studioRows.map((row) => {
                    const checked = selectedIds.has(row.id);

                    return (
                      <TableRow key={row.id} className={checked ? "bg-purple-50/50" : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                            checked={checked}
                            onChange={() => toggleSelection(row.id)}
                            aria-label={`Incluir ${row.areaName} na meta gerencial`}
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-slate-950">{row.areaName}</p>
                          {row.notes && <p className="mt-0.5 max-w-md truncate text-xs text-slate-500" title={row.notes}>{row.notes}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.hunterAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.maintenanceAmount)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!studioRows.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        Selecione um cliente com metas de Studio cadastradas para montar a meta gerencial.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="secondary">{selectedRows.length} de {studioRows.length} linha(s) selecionada(s) no cliente</Badge>
              <Button type="button" onClick={saveSelection} disabled={saving || !personId || !selectedCustomerId}>
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar inclusão"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-bold text-slate-950">Seleções cadastradas</h2>
            <p className="text-sm text-slate-500">
              Lista consolidada da pessoa no ano. Linhas em prévia ainda dependem do botão Salvar inclusão.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área / Studio</TableHead>
                  <TableHead className="text-right">Hunter</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectionSummaryRows.map((row) => (
                  <TableRow key={`${row.pending ? "pending" : "saved"}-${row.id}`} className={row.pending ? "bg-amber-50/60" : undefined}>
                    <TableCell className="font-semibold text-slate-950">{row.customerName}</TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900">{row.areaName}</p>
                      {row.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500" title={row.notes}>{row.notes}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.hunterAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.maintenanceAmount)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(row.total)}</TableCell>
                    <TableCell>
                      {row.pending
                        ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Prévia</Badge>
                        : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Salvo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {!selectionSummaryRows.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhuma meta gerencial cadastrada para essa pessoa no ano.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
