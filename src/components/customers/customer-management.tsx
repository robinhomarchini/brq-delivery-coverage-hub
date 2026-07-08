"use client";

import { Building2, Info, Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { Area, Customer, Person, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import { PageHeader } from "@/components/shared/page-header";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DualListSelector } from "@/components/shared/dual-list-selector";
import { useDeliveryStore } from "@/store/delivery-store";
import { useAccess } from "@/lib/access-context";
import { isHunterConsultAccess, normalizeAccessEmail } from "@/lib/access-control";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { getFinancialCustomerMetric } from "@/lib/financial-customers";
import { formatPercentPtBr, targetMarginPercent } from "@/lib/financial-targets";
import { isCustomerManagerProfile, isHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { formatCurrency, makeId } from "@/lib/utils";
import { useCloseOnNavigation } from "@/lib/use-close-on-navigation";
import { displayDirectorName, OTHER_DIRECTOR_ID, OTHER_DIRECTOR_NAME } from "@/lib/director-governance";
import { getContainedHunterAllocation } from "@/lib/customer-hunter-reconciliation";

const currentYear = defaultTargetYear;

interface CustomerTargetBreakdown {
  hunter: number;
  farmerRenewal: number;
  studioHunter: number;
  studio: number;
  total: number;
}

interface CustomerAllocationWarningData {
  customerId: string;
  year: number;
  target: number;
  allocated: number;
  gap: number;
  people: Pick<Person, "id" | "name" | "jobTitle" | "roleType">[];
}

interface CustomerAllocationCompositionData {
  customerId: string;
  year: number;
  rows: CustomerAllocationPersonRow[];
  allocatedHunter: number;
  allocatedFarmerRenewal: number;
  allocatedStudio: number;
  allocatedTotal: number;
  openHunter: number;
  openFarmerRenewal: number;
  openStudio: number;
  openTotal: number;
  overHunter: number;
  overFarmerRenewal: number;
  overStudio: number;
  overTotal: number;
}

interface CustomerStudioCompositionData {
  customerId: string;
  year: number;
  targetHunter: number;
  targetMaintenance: number;
  allocatedHunter: number;
  allocatedMaintenance: number;
  openHunter: number;
  openMaintenance: number;
  overHunter: number;
  overMaintenance: number;
  allocatedTotal: number;
  openTotal: number;
  overTotal: number;
  rows: CustomerStudioAllocationRow[];
}

interface CustomerStudioAllocationRow {
  id: string;
  areaName: string;
  hunterPersonName: string;
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
}

interface CustomerAllocationPersonRow {
  personId: string;
  personName: string;
  jobTitle: string;
  roleType: string;
  hunter: number;
  farmerRenewal: number;
  studio: number;
  total: number;
}

interface CustomerTargetPerson {
  personId: string;
  name: string;
  roleType: string;
  amount: number;
}

type CustomerCoverageStatus = "ok" | "issue" | "mismatch" | "empty";
type CustomerCoverageSignal = {
  status: CustomerCoverageStatus;
  title: string;
  difference?: number;
};
type CustomerSortKey = "customer" | "director" | "allocated" | "target" | "margin" | "strategic";

export function CustomerManagement() {
  const initialCustomerId = useMemo(() => getInitialCustomerId(), []);
  const { accessUser, canEdit } = useAccess();
  const {
    areas,
    customers,
    customerTargets,
    people,
    studioTargetAllocations,
    targetAllocations,
    saveCustomer,
    deleteCustomer,
    deleteTargetAllocation,
    saveStudioTargetAllocation,
    deleteStudioTargetAllocation,
    savePersonCustomerTargets,
  } = useDeliveryStore();
  const [year, setYear] = useState(currentYear);
  const years = useMemo(
    () => Array.from(new Set([
      ...getAvailableTargetYears(customerTargets, currentYear),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((first, second) => second - first),
    [customerTargets, studioTargetAllocations],
  );
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const hunterConsultOnly = isHunterConsultAccess(accessUser);
  const accessEmail = accessUser?.email ?? "";
  const scopedHunterPerson = useMemo(() => {
    if (!hunterConsultOnly || !accessEmail) return null;
    const email = normalizeAccessEmail(accessEmail);
    return people.find((person) => person.email && normalizeAccessEmail(person.email) === email && isHunterRole(person.roleType)) ?? null;
  }, [accessEmail, hunterConsultOnly, people]);
  const scopedCustomerIds = useMemo(() => {
    if (!hunterConsultOnly || !scopedHunterPerson) return null;
    return new Set([
      ...scopedHunterPerson.clientIds,
      ...targetAllocations
        .filter((allocation) => allocation.personId === scopedHunterPerson.id && allocation.type === "hunter")
        .map((allocation) => allocation.customerId),
      ...studioTargetAllocations
        .filter((allocation) => allocation.hunterPersonId === scopedHunterPerson.id)
        .map((allocation) => allocation.customerId),
    ]);
  }, [hunterConsultOnly, scopedHunterPerson, studioTargetAllocations, targetAllocations]);
  const scopedYearCustomers = useMemo(
    () => scopedCustomerIds ? yearCustomers.filter((customer) => scopedCustomerIds.has(customer.id)) : yearCustomers,
    [scopedCustomerIds, yearCustomers],
  );
  const initialCustomer = yearCustomers.find((customer) => customer.id === initialCustomerId);
  const [search, setSearch] = useState("");
  const [director, setDirector] = useState("");
  const [manager, setManager] = useState("");
  const [strategic, setStrategic] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissInitialOpen, setDismissInitialOpen] = useState(false);
  const [formName, setFormName] = useState(initialCustomer?.name ?? "");
  const [formDirectorId, setFormDirectorId] = useState(initialCustomer?.directorResponsibleId ?? "");
  const [formManagerIds, setFormManagerIds] = useState<string[]>(initialCustomer?.managerResponsibleIds ?? []);
  const [formHunterId, setFormHunterId] = useState(getPrimaryHunterIdForCustomer(initialCustomer?.id ?? "", people));
  const [formHunterTarget, setFormHunterTarget] = useState(getInputValue(initialCustomer?.hunterTarget ?? getFinancialCustomerMetric(initialCustomer?.name ?? "", "hunterRevenue")));
  const [formFarmerRenewalTarget, setFormFarmerRenewalTarget] = useState(getInputValue(initialCustomer?.farmerRenewalTarget ?? getFinancialCustomerMetric(initialCustomer?.name ?? "", "deliveryFarmerRevenue")));
  const [formStudioHunterTarget, setFormStudioHunterTarget] = useState(getInputValue(initialCustomer?.studioHunterTarget ?? 0));
  const [formStudioTarget, setFormStudioTarget] = useState(getInputValue(initialCustomer?.studioTarget ?? 0));
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [sortState, setSortState] = useState<SortState<CustomerSortKey>>({ key: "customer", direction: "asc" });
  const directors = useMemo(() => {
    const activeDirectors = people
      .filter((person) => person.active && person.roleType === "Director")
      .sort((first, second) => first.name.localeCompare(second.name));
    if (activeDirectors.some((person) => person.id === OTHER_DIRECTOR_ID)) return activeDirectors;
    return [...activeDirectors, makeOtherDirectorOption()];
  }, [people]);
  const managers = useMemo(() => people
    .filter((person) => person.active && isCustomerManagerProfile(person.roleType, person.isManager))
    .sort((first, second) => first.name.localeCompare(second.name)),
  [people]);
  const hunters = useMemo(() => people
    .filter((person) => person.active && isHunterRole(person.roleType))
    .sort((first, second) => first.name.localeCompare(second.name)),
  [people]);
  const managerIds = useMemo(() => new Set(managers.map((person) => person.id)), [managers]);
  const linkedEditing = editing ?? (!dismissInitialOpen ? initialCustomer ?? null : null);
  const open = manualOpen || Boolean(linkedEditing && !dismissInitialOpen);

  const filtered = useMemo(() => scopedYearCustomers.filter((customer) => {
    const query = search.toLowerCase();
    return (!query || `${customer.name} ${customer.industry}`.toLowerCase().includes(query))
      && (!director || customer.directorResponsibleId === director)
      && (!manager || customer.managerResponsibleIds.includes(manager))
      && (!strategic || String(customer.strategicAccount) === strategic);
  }), [scopedYearCustomers, director, manager, search, strategic]);
  const sortedCustomers = useMemo(
    () => sortCustomerRows(filtered, sortState, people, areas, targetAllocations, studioTargetAllocations, year),
    [areas, filtered, people, sortState, studioTargetAllocations, targetAllocations, year],
  );
  const formHunterAmount = parseAmount(formHunterTarget);
  const formFarmerRenewalAmount = parseAmount(formFarmerRenewalTarget);
  const formStudioHunterAmount = parseAmount(formStudioHunterTarget);
  const formStudioAmount = parseAmount(formStudioTarget);
  const formRevenue = roundCurrency(formHunterAmount + formFarmerRenewalAmount + formStudioAmount);

  const targetTotals = filtered.reduce((totals, customer) => {
    const breakdown = getCustomerTargetBreakdown(customer);
    return {
      hunter: totals.hunter + breakdown.hunter,
      farmerRenewal: totals.farmerRenewal + breakdown.farmerRenewal,
      studioHunter: totals.studioHunter + breakdown.studioHunter,
      studio: totals.studio + breakdown.studio,
      total: totals.total + breakdown.total,
    };
  }, { hunter: 0, farmerRenewal: 0, studioHunter: 0, studio: 0, total: 0 });
  const customerReportRows = useMemo(() => sortedCustomers.map((customer) => {
    const breakdown = getCustomerTargetBreakdown(customer);
    const targetPeople = getCustomerTargetPeople(customer, people, targetAllocations, studioTargetAllocations, year);
    const coverage = getCustomerCoverageStatus(customer, people, areas, targetAllocations, studioTargetAllocations, year);
    const directorName = displayDirectorName(people.find((item) => item.id === customer.directorResponsibleId)?.name ?? customer.directorResponsibleId);
    const managerNames = customer.managerResponsibleIds
      .map((managerId) => people.find((person) => person.id === managerId)?.name ?? managerId)
      .join(", ");

    return {
      customerName: customer.name,
      industry: customer.industry,
      directorName,
      managerNames,
      hunterPeople: targetPeople.hunterPeople.map((person) => `${person.name} (${formatCurrency(person.amount)})`).join(", "),
      farmerRenewalPeople: targetPeople.farmerRenewalPeople.map((person) => `${person.name} (${formatCurrency(person.amount)})`).join(", "),
      hunterTarget: breakdown.hunter,
      studioHunterTarget: breakdown.studioHunter,
      farmerRenewalTarget: breakdown.farmerRenewal,
      studioTarget: breakdown.studio,
      totalTarget: breakdown.total,
      margin: customer.margin,
      strategicAccount: customer.strategicAccount ? "Sim" : "Não",
      status: getCoverageStatusLabel(coverage.status),
      difference: coverage.difference ?? 0,
      year,
    };
  }), [areas, people, sortedCustomers, studioTargetAllocations, targetAllocations, year]);
  const customerReportColumns = useMemo<ReportColumn<(typeof customerReportRows)[number]>[]>(() => [
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "industry", label: "Indústria", value: (row) => row.industry },
    { key: "directorName", label: "Diretor responsável", value: (row) => row.directorName },
    { key: "managerNames", label: "Managers responsáveis", value: (row) => row.managerNames },
    { key: "hunterPeople", label: "Hunters alocados", value: (row) => row.hunterPeople },
    { key: "farmerRenewalPeople", label: "Farmers / Delivery alocados", value: (row) => row.farmerRenewalPeople },
    { key: "hunterTarget", label: "Meta Hunter", value: (row) => row.hunterTarget, format: "currency", align: "right" },
    { key: "studioHunterTarget", label: "Studio Hunter", value: (row) => row.studioHunterTarget, format: "currency", align: "right" },
    { key: "farmerRenewalTarget", label: "Renovação + Ampliação", value: (row) => row.farmerRenewalTarget, format: "currency", align: "right" },
    { key: "studioTarget", label: "Studio Manutenção", value: (row) => row.studioTarget, format: "currency", align: "right" },
    { key: "totalTarget", label: "Meta total", value: (row) => row.totalTarget, format: "currency", align: "right" },
    { key: "margin", label: "Margem alvo (%)", value: (row) => row.margin, format: "percent", align: "right" },
    { key: "strategicAccount", label: "Conta estratégica", value: (row) => row.strategicAccount, align: "center" },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "difference", label: "Diferença", value: (row) => row.difference, format: "currency", align: "right" },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);
  const averageMargin = filtered.length ? filtered.reduce((sum, customer) => sum + customer.margin, 0) / filtered.length : 0;
  const formBreakdown = getCustomerTargetBreakdown({
    id: linkedEditing?.id ?? "",
    name: formName || linkedEditing?.name || "",
    industry: linkedEditing?.industry ?? "Financial Services",
    directorResponsibleId: formDirectorId,
    managerResponsibleIds: formManagerIds,
    hunterTarget: formHunterAmount,
    farmerRenewalTarget: formFarmerRenewalAmount,
    studioHunterTarget: formStudioHunterAmount,
    studioTarget: formStudioAmount,
    revenue: formRevenue,
    margin: linkedEditing?.margin ?? 0,
    strategicAccount: linkedEditing?.strategicAccount ?? true,
    lifecycleStatus: linkedEditing?.lifecycleStatus ?? "active",
  });
  const allocationComposition = linkedEditing
    ? getCustomerAllocationComposition(
      {
        ...linkedEditing,
        name: formName || linkedEditing.name,
        managerResponsibleIds: formManagerIds,
        hunterTarget: formHunterAmount,
        farmerRenewalTarget: formFarmerRenewalAmount,
        studioHunterTarget: formStudioHunterAmount,
        studioTarget: formStudioAmount,
        revenue: formRevenue,
      },
      people,
      targetAllocations,
      studioTargetAllocations,
      year,
      formBreakdown,
    )
    : null;
  const studioComposition = linkedEditing
    ? getCustomerStudioComposition(
      linkedEditing.id,
      formStudioAmount,
      formStudioHunterAmount,
      areas,
      people,
      studioTargetAllocations,
      year,
    )
    : null;
  const allocationWarning = linkedEditing
    ? getCustomerAllocationWarning(
      {
        ...linkedEditing,
        name: formName || linkedEditing.name,
        managerResponsibleIds: formManagerIds,
        hunterTarget: formHunterAmount,
        farmerRenewalTarget: formFarmerRenewalAmount,
        studioHunterTarget: formStudioHunterAmount,
        studioTarget: formStudioAmount,
        revenue: formRevenue,
      },
      people,
      targetAllocations,
      studioTargetAllocations,
      year,
    )
    : null;

  const closeForm = useCallback(() => {
    setManualOpen(false);
    setEditing(null);
    setDismissInitialOpen(true);
    setFormError("");
  }, [setDismissInitialOpen, setEditing, setFormError, setManualOpen]);

  useCloseOnNavigation(closeForm);

  function openForm(item?: Customer) {
    if (hunterConsultOnly || !canEdit) return;
    setEditing(item ?? null);
    const defaults = getCustomerDefaults(item?.name ?? "", directors);
    setFormName(item?.name ?? "");
    setFormDirectorId(item?.directorResponsibleId ?? defaults.directorResponsibleId);
    setFormManagerIds(item?.managerResponsibleIds ?? defaults.managerResponsibleIds);
    setFormHunterId(getPrimaryHunterIdForCustomer(item?.id ?? "", people));
    setFormHunterTarget(getInputValue(item?.hunterTarget ?? getFinancialCustomerMetric(item?.name ?? "", "hunterRevenue")));
    setFormFarmerRenewalTarget(getInputValue(item?.farmerRenewalTarget ?? getFinancialCustomerMetric(item?.name ?? "", "deliveryFarmerRevenue")));
    setFormStudioHunterTarget(getInputValue(item?.studioHunterTarget ?? 0));
    setFormStudioTarget(getInputValue(item?.studioTarget ?? 0));
    setFormError("");
    setManualOpen(true);
    setDismissInitialOpen(false);
  }

  function applyCustomerRules(name: string) {
    if (linkedEditing) return;
    const defaults = getCustomerDefaults(name, directors);
    setFormDirectorId(defaults.directorResponsibleId);
    setFormManagerIds(defaults.managerResponsibleIds);
    if (!linkedEditing) {
      setFormHunterTarget(getInputValue(getFinancialCustomerMetric(name, "hunterRevenue")));
      setFormFarmerRenewalTarget(getInputValue(getFinancialCustomerMetric(name, "deliveryFarmerRevenue")));
      setFormStudioHunterTarget("0");
      setFormStudioTarget("0");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hunterConsultOnly || !canEdit) {
      setFormError("Seu perfil permite apenas consulta de clientes.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const customerName = String(formData.get("name"));
    const defaults = getCustomerDefaults(customerName, directors);
    const validManagers = formManagerIds.filter((id) => managerIds.has(id));
    const customerId = linkedEditing?.id ?? makeId("customer");
    try {
      setFormError("");
      await saveCustomer({
        id: customerId,
        name: customerName,
        industry: String(formData.get("industry")),
        directorResponsibleId: String(formData.get("directorResponsibleId") || defaults.directorResponsibleId),
        managerResponsibleIds: validManagers,
        hunterTarget: formHunterAmount,
        farmerRenewalTarget: formFarmerRenewalAmount,
        studioHunterTarget: formStudioHunterAmount,
        studioTarget: formStudioAmount,
        revenue: formRevenue,
        margin: Number(formData.get("margin")),
        strategicAccount: formData.get("strategicAccount") === "true",
        lifecycleStatus: linkedEditing?.lifecycleStatus ?? "active",
        closedAt: linkedEditing?.closedAt,
        closedReason: linkedEditing?.closedReason,
      }, year);
      await syncCustomerHunterAssignmentAndTarget(customerId);
      closeForm();
      setSuccessMessage(`Cliente ${customerName} salvo com sucesso.`);
      window.setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      setFormError(getFormErrorMessage(error));
    }
  }

  async function syncCustomerHunterAssignmentAndTarget(customerId: string) {
    const selectedHunter = hunters.find((person) => person.id === formHunterId);
    const previousHunterId = getPrimaryHunterIdForCustomer(customerId, people);
    const hunterChanged = Boolean(previousHunterId && previousHunterId !== formHunterId);
    const staleHunterAllocations = targetAllocations.filter((allocation) =>
      allocation.customerId === customerId
      && allocation.year === year
      && allocation.type === "hunter"
      && allocation.personId === previousHunterId
      && allocation.personId !== formHunterId
    );
    const staleStudioAllocations = studioTargetAllocations.filter((allocation) =>
      allocation.customerId === customerId
      && allocation.year === year
      && allocation.hunterPersonId
      && allocation.hunterPersonId === previousHunterId
      && allocation.hunterPersonId !== formHunterId
      && allocation.hunterAmount > 0
    );

    if (!selectedHunter) {
      return;
    }

    if (!hunterChanged) {
      await savePersonCustomerTargets({
        customerId,
        personId: selectedHunter.id,
        year,
        hunterAmount: formHunterAmount,
        farmerRenewalAmount: 0,
        studioAmount: 0,
        increaseCustomerTarget: false,
        notes: "Meta Hunter sincronizada pela tela Clientes.",
      });
      return;
    }

    const hasTransferableTargets = staleHunterAllocations.length > 0 || staleStudioAllocations.length > 0;
    const shouldTransferTargets = hunterChanged && hasTransferableTargets
      ? window.confirm(
        `O Hunter responsável foi alterado para ${selectedHunter.name}.\n\nDeseja transferir automaticamente a Meta Hunter e os Studios Hunter do Hunter responsável anterior para o novo Hunter?\n\nOK: transfere apenas os valores do responsável anterior.\nCancelar: mantém os valores com o Hunter atual e preserva os demais Hunters/Farmers associados.`,
      )
      : true;

    if (hasTransferableTargets && shouldTransferTargets) {
      for (const allocation of staleStudioAllocations) {
        await transferStudioHunterAllocation(allocation, selectedHunter.id);
      }
    }

    const transferredHunterAmount = staleHunterAllocations.reduce((total, allocation) => total + allocation.amount, 0);
    await savePersonCustomerTargets({
        customerId,
        personId: selectedHunter.id,
        year,
        hunterAmount: shouldTransferTargets && transferredHunterAmount > 0 ? transferredHunterAmount : formHunterAmount,
        farmerRenewalAmount: 0,
        studioAmount: 0,
        increaseCustomerTarget: false,
        notes: hasTransferableTargets && shouldTransferTargets
          ? "Meta Hunter transferida pela tela Clientes."
          : "Meta Hunter sincronizada pela tela Clientes.",
      });

    if (hasTransferableTargets && shouldTransferTargets) {
      for (const allocation of staleHunterAllocations) {
        await deleteTargetAllocation(allocation.id);
      }
    }
  }

  async function transferStudioHunterAllocation(allocation: StudioTargetAllocation, nextHunterPersonId: string) {
    const existingForNewHunter = studioTargetAllocations.find((item) =>
      item.id !== allocation.id
      && item.customerId === allocation.customerId
      && item.areaId === allocation.areaId
      && item.year === allocation.year
      && item.hunterPersonId === nextHunterPersonId
    );

    if (existingForNewHunter) {
      await saveStudioTargetAllocation({
        ...existingForNewHunter,
        hunterAmount: roundCurrency(existingForNewHunter.hunterAmount + allocation.hunterAmount),
        maintenanceAmount: roundCurrency(existingForNewHunter.maintenanceAmount + allocation.maintenanceAmount),
        notes: [existingForNewHunter.notes, allocation.notes, "Studio Hunter transferido pela tela Clientes."]
          .filter(Boolean)
          .join(" | "),
      });
      await deleteStudioTargetAllocation(allocation.id);
      return;
    }

    await saveStudioTargetAllocation({
      ...allocation,
      hunterPersonId: nextHunterPersonId,
      notes: allocation.notes || "Studio Hunter transferido pela tela Clientes.",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Portfólio executivo"
        title="Clientes"
        description="Acompanhe responsáveis, metas financeiras, margem e relevância estratégica das contas."
        actions={(
          <>
            <ReportExportActions
              title={`Relatório de Clientes · ${year}`}
              filename={`relatorio-clientes-${year}`}
              rows={customerReportRows}
              columns={customerReportColumns}
            />
            {!hunterConsultOnly && canEdit && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Novo cliente</Button>}
          </>
        )}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {formError && <ErrorNotice message={formError} floating onClose={() => setFormError("")} />}

      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiSummaryCard label="Clientes filtrados" value={sortedCustomers.length} />
        <KpiSummaryCard label={`Meta Hunter · ${year}`} currencyValue={targetTotals.hunter} />
        <KpiSummaryCard label={`Renovação + Ampliação · ${year}`} currencyValue={targetTotals.farmerRenewal} />
        <KpiSummaryCard label={`Studio Hunter · ${year}`} currencyValue={targetTotals.studioHunter} />
        <KpiSummaryCard label={`Studio Manutenção · ${year}`} currencyValue={targetTotals.studio} />
        <KpiSummaryCard label={`Meta total · ${year}`} currencyValue={targetTotals.total} />
        <KpiSummaryCard label="Margem média" value={formatPercentPtBr(averageMargin)} />
      </section>

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
        {!hunterConsultOnly && <Select value={director} onChange={(event) => setDirector(event.target.value)}><option value="">Todos os diretores</option>{directors.map((item) => <option key={item.id} value={item.id}>{displayDirectorName(item.name)}</option>)}</Select>}
        {!hunterConsultOnly && <Select value={manager} onChange={(event) => setManager(event.target.value)}><option value="">Todos os managers</option>{managers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}
        <Select value={strategic} onChange={(event) => setStrategic(event.target.value)}><option value="">Todas as contas</option><option value="true">Estratégicas</option><option value="false">Não estratégicas</option></Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableTableHead label="Cliente" sortKey="customer" sortState={sortState} onSort={setSortState} />
              <SortableTableHead label="Diretor responsável" sortKey="director" sortState={sortState} onSort={setSortState} />
              <SortableTableHead label="Alocado por pessoas" sortKey="allocated" sortState={sortState} onSort={setSortState} />
              <SortableTableHead label="Meta do cliente" sortKey="target" sortState={sortState} onSort={setSortState} />
              <SortableTableHead label="Margem alvo" sortKey="margin" sortState={sortState} onSort={setSortState} />
              <SortableTableHead label="Estratégica" sortKey="strategic" sortState={sortState} onSort={setSortState} />
              {!hunterConsultOnly && canEdit && <TableHead className="text-right">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {sortedCustomers.map((customer) => {
                const breakdown = getCustomerTargetBreakdown(customer);
                const targetPeople = getCustomerTargetPeople(customer, people, targetAllocations, studioTargetAllocations, year);
                const coverage = getCustomerCoverageStatus(customer, people, areas, targetAllocations, studioTargetAllocations, year);
                return (
                  <TableRow
                    key={customer.id}
                    className={hunterConsultOnly || !canEdit ? "" : "cursor-pointer"}
                    title={hunterConsultOnly || !canEdit ? "Consulta em modo leitura" : "Dê duplo clique para editar o cliente"}
                    onDoubleClick={() => openForm(customer)}
                  >
                    <TableCell><div className="flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${getCustomerStatusIconClassName(coverage.status, coverage.difference)}`} title={coverage.title} aria-label={coverage.title}><Building2 className="h-5 w-5" /></div><div><p className="font-semibold">{customer.name}</p><p className="text-xs text-slate-400">{customer.industry}</p>{coverage.status === "mismatch" && typeof coverage.difference === "number" && <p className={`text-xs font-semibold ${coverage.difference > 0 ? "text-emerald-700" : "text-red-600"}`} title={coverage.title}>{coverage.difference > 0 ? "Acima" : "Abaixo"}: {formatCurrency(Math.abs(coverage.difference))}</p>}</div></div></TableCell>
                    <TableCell>
                      <p>{displayDirectorName(people.find((item) => item.id === customer.directorResponsibleId)?.name ?? customer.directorResponsibleId)}</p>
                      <p className="text-xs text-slate-400">Governança Delivery</p>
                    </TableCell>
                    <TableCell><CustomerTargetPeopleView hunterPeople={targetPeople.hunterPeople} farmerRenewalPeople={targetPeople.farmerRenewalPeople} /></TableCell>
                    <TableCell><TargetBreakdownView breakdown={breakdown} /></TableCell>
                    <TableCell>
                      <span className={customer.margin < targetMarginPercent ? "font-semibold text-amber-600" : "text-emerald-700"}>
                        {formatPercentPtBr(customer.margin)}
                      </span>
                      <p className="text-xs text-slate-400">Alvo {formatPercentPtBr(targetMarginPercent)}</p>
                    </TableCell>
                    <TableCell>{customer.strategicAccount ? <Badge><Star className="mr-1 h-3 w-3 fill-current" /> Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                    {!hunterConsultOnly && canEdit && (
                      <TableCell onDoubleClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openForm(customer)} aria-label={`Editar cliente ${customer.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-600" aria-label={`Excluir cliente ${customer.name}`} onClick={() => {
                          if (window.confirm(`Excluir o cliente ${customer.name}?`)) void deleteCustomer(customer.id).catch(() => undefined);
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div></TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!sortedCustomers.length && (
          <EmptyState message={hunterConsultOnly && !scopedHunterPerson ? "Seu e-mail de acesso ainda não está vinculado a uma pessoa Hunter ativa." : "Nenhum cliente encontrado para os filtros selecionados."} />
        )}
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setManualOpen(true) : closeForm())}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{linkedEditing ? "Editar cliente" : "Novo cliente"}</DialogTitle><DialogDescription>Cadastre a conta e seus indicadores executivos.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do cliente"><Input name="name" value={formName} onChange={(event) => setFormName(event.target.value)} onBlur={(event) => applyCustomerRules(event.target.value)} maxLength={160} required /></Field>
            <Field label="Indústria"><Input name="industry" defaultValue={linkedEditing?.industry ?? "Financial Services"} maxLength={120} required /></Field>
            <Field label="Diretor responsável"><Select name="directorResponsibleId" value={formDirectorId} onChange={(event) => setFormDirectorId(event.target.value)} required><option value="">Selecione</option>{directors.map((item) => <option key={item.id} value={item.id}>{displayDirectorName(item.name)}</option>)}</Select></Field>
            <Field label="Managers responsáveis" className="md:col-span-2">
              <DualListSelector
                items={managers.map((item) => ({
                  id: item.id,
                  label: item.name,
                  description: item.jobTitle,
                }))}
                selectedIds={formManagerIds}
                onChange={setFormManagerIds}
                availableTitle="Managers disponíveis"
                selectedTitle="Managers selecionados"
                availableSearchPlaceholder="Buscar manager disponível"
                selectedSearchPlaceholder="Buscar manager selecionado"
                emptyAvailableMessage="Todos os managers de Delivery já foram selecionados."
                emptySelectedMessage="Nenhum manager selecionado."
              />
              <span className="mt-1 block text-xs text-slate-400">Mova um ou mais managers para a lista de selecionados. Nenhuma pessoa é incluída por padrão.</span>
            </Field>
            <Field label="Hunter responsável">
              <Select value={formHunterId} onChange={(event) => setFormHunterId(event.target.value)}>
                <option value="">Sem Hunter responsável</option>
                {hunters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <span className="mt-1 block text-xs text-slate-400">
                Ao salvar, o vínculo e a meta Hunter da pessoa/ano são sincronizados automaticamente. Valor zero mantém apenas o vínculo.
              </span>
            </Field>
            <Field label="Conta estratégica"><Select name="strategicAccount" defaultValue={String(linkedEditing?.strategicAccount ?? true)}><option value="true">Sim</option><option value="false">Não</option></Select></Field>
            <Field label={`Meta Hunter ${year} (R$)`}>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
                <Input
                  name="hunterTarget"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formHunterTarget}
                  onChange={(event) => setFormHunterTarget(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="0"
                  className="h-10 border-0 px-0 text-right font-semibold tabular-nums focus:ring-0"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">{formatCurrency(formHunterAmount)}</span>
            </Field>
            <Field label={`Meta Renovação + Ampliação ${year} (R$)`}>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
                <Input
                  name="farmerRenewalTarget"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formFarmerRenewalTarget}
                  onChange={(event) => setFormFarmerRenewalTarget(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="0"
                  className="h-10 border-0 px-0 text-right font-semibold tabular-nums focus:ring-0"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">{formatCurrency(formFarmerRenewalAmount)}</span>
            </Field>
            <Field label={`Área/Studio Hunter ${year} (R$)`}>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
                <Input
                  name="studioHunterTarget"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formStudioHunterTarget}
                  onChange={(event) => setFormStudioHunterTarget(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="0"
                  className="h-10 border-0 px-0 text-right font-semibold tabular-nums focus:ring-0"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">{formatCurrency(formStudioHunterAmount)} dentro da Meta Hunter; não soma novamente no total.</span>
            </Field>
            <Field label={`Área/Studio Manutenção ${year} (R$)`}>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100">
                <span className="mr-2 text-sm font-semibold text-slate-400">R$</span>
                <Input
                  name="studioTarget"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={formStudioTarget}
                  onChange={(event) => setFormStudioTarget(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="0"
                  className="h-10 border-0 px-0 text-right font-semibold tabular-nums focus:ring-0"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">{formatCurrency(formStudioAmount)}</span>
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Meta total</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{formatCurrency(formRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">Calculada por Hunter + Renovação + Ampliação + Área/Studio Manutenção para {year}. Área/Studio Hunter é subquebra da meta Hunter.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Composição da meta</p>
              <TargetBreakdownView breakdown={formBreakdown} compact />
              {allocationComposition && <CustomerAllocationCompositionView composition={allocationComposition} />}
              {studioComposition && <CustomerStudioCompositionView composition={studioComposition} />}
              <p className="mt-2 text-xs text-slate-500">
                A tela de Cliente é a base da meta. Metas por Pessoa distribui Hunter/Farmer; Metas por Área/Studio distribui a abertura Hunter e Manutenção por studio.
              </p>
            </div>
            {allocationWarning && <CustomerAllocationWarning warning={allocationWarning} />}
            <Field label="Margem alvo (%)">
              <Input name="margin" type="number" min="0" max="100" step="0.1" defaultValue={linkedEditing?.margin ?? targetMarginPercent} required />
              <span className="mt-1 block text-xs text-slate-400">Informativo neste momento. Alvo padrão: {formatPercentPtBr(targetMarginPercent)}.</span>
            </Field>
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button><Button type="submit">Salvar cliente</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function TargetBreakdownView({ breakdown, compact = false }: { breakdown: CustomerTargetBreakdown; compact?: boolean }) {
  const containerClassName = compact
    ? "mt-3 grid gap-2 text-sm md:grid-cols-5"
    : "grid min-w-56 gap-1 text-sm";
  return (
    <div className={containerClassName}>
      <MoneyLine label="Hunter" value={breakdown.hunter} />
      <MoneyLine
        label="Studio Hunter"
        value={breakdown.studioHunter}
        included
        helpText="Studio Hunter é uma abertura da meta Hunter do cliente. Ele está contido em Hunter e não soma novamente no Total."
      />
      <MoneyLine label="Renov. + Ampl." value={breakdown.farmerRenewal} />
      <MoneyLine label="Studio Manut." value={breakdown.studio} />
      <MoneyLine label="Total" value={breakdown.total} strong />
    </div>
  );
}

function MoneyLine({
  label,
  value,
  strong = false,
  included = false,
  helpText,
}: {
  label: string;
  value: number;
  strong?: boolean;
  included?: boolean;
  helpText?: string;
}) {
  const lineClassName = strong
    ? "border-t border-slate-200 pt-1 font-bold text-slate-950"
    : included
      ? "rounded-lg border border-sky-100 bg-sky-50/80 px-2 py-1 text-sky-900"
      : "text-slate-600";
  const labelClassName = included ? "text-sky-600" : "text-slate-400";

  return (
    <div
      className={`flex items-center justify-between gap-3 ${helpText ? "cursor-help" : ""} ${lineClassName}`}
      title={helpText}
      aria-label={helpText ? `${label}: ${formatCurrency(value)}. ${helpText}` : `${label}: ${formatCurrency(value)}`}
    >
      <span className={`inline-flex items-center gap-1 text-xs uppercase tracking-wide ${labelClassName}`}>
        {label}
        {included && <Info className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function CustomerTargetPeopleView({
  hunterPeople,
  farmerRenewalPeople,
}: {
  hunterPeople: CustomerTargetPerson[];
  farmerRenewalPeople: CustomerTargetPerson[];
}) {
  return (
    <div className="min-w-60 space-y-2 text-xs">
      <CustomerTargetPeopleGroup label="Hunters" people={hunterPeople} emptyLabel="Sem hunter" tone="orange" />
      <CustomerTargetPeopleGroup label="Farmers / Delivery" people={farmerRenewalPeople} emptyLabel="Sem farmer/delivery" tone="purple" />
    </div>
  );
}

function CustomerTargetPeopleGroup({
  label,
  people,
  emptyLabel,
  tone,
}: {
  label: string;
  people: CustomerTargetPerson[];
  emptyLabel: string;
  tone: "orange" | "purple" | "blue";
}) {
  const toneClassName = tone === "orange"
    ? "bg-orange-50 text-orange-800"
    : tone === "blue"
      ? "bg-sky-50 text-sky-700"
      : "bg-purple-50 text-brq-purple";

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {people.length ? (
        <div className="flex max-w-80 flex-wrap gap-1.5">
          {people.map((person) => (
            <span key={`${label}-${person.personId}`} className={`rounded-full px-2 py-1 font-semibold ${toneClassName}`} title={`${person.name} · ${formatCurrency(person.amount)}`}>
              {person.name}
              <span className="ml-1 opacity-70">{formatCurrency(person.amount)}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-slate-400">{emptyLabel}</span>
      )}
    </div>
  );
}

function CustomerAllocationCompositionView({ composition }: { composition: CustomerAllocationCompositionData }) {
  const hasOpenAmount = hasVisibleCurrencyAmount(composition.openTotal);
  const hasOverAmount = hasVisibleCurrencyAmount(composition.overTotal);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distribuição por pessoa · {composition.year}</p>
          <p className="text-sm text-slate-500">
            Alocado: <span className="font-semibold text-slate-800">{formatCurrency(composition.allocatedTotal)}</span>
            {hasOpenAmount && <> · Abaixo da meta: <span className="font-semibold text-red-700">{formatCurrency(composition.openTotal)}</span></>}
            {hasOverAmount && <> · Acima da meta: <span className="font-semibold text-emerald-700">{formatCurrency(composition.overTotal)}</span></>}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
            Ajustar metas
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Pessoa</th>
              <th className="px-4 py-2 font-semibold">Perfil</th>
              <th className="px-4 py-2 text-right font-semibold">Hunter</th>
              <th className="px-4 py-2 text-right font-semibold">Renov. + Ampl.</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {composition.rows.map((row) => (
              <tr key={row.personId}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{row.personName}</p>
                  <p className="text-xs text-slate-400">{row.jobTitle}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">{row.roleType}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.hunter)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.farmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(row.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-brq-purple hover:underline" href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {hasOpenAmount && (
              <tr className="bg-red-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-red-900">Abaixo da meta sem pessoa alocada</p>
                  <p className="text-xs text-red-700">Distribua este saldo em Metas por Pessoa.</p>
                </td>
                <td className="px-4 py-3 text-red-700">Abaixo</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.openHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.openFarmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-red-900">{formatCurrency(composition.openTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-red-800 hover:underline" href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Alocar
                  </Link>
                </td>
              </tr>
            )}
            {hasOverAmount && (
              <tr className="bg-emerald-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-emerald-900">Acima da meta do cliente</p>
                  <p className="text-xs text-emerald-700">Distribuição supera a meta cadastrada.</p>
                </td>
                <td className="px-4 py-3 text-emerald-700">Superado</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-800">{formatCurrency(composition.overHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-800">{formatCurrency(composition.overFarmerRenewal)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-900">{formatCurrency(composition.overTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-emerald-800 hover:underline" href={`/metas-pessoas?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            )}
            {!composition.rows.length && !hasOpenAmount && !hasOverAmount && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Ainda não há meta Hunter/Farmer associada a pessoas para este cliente no ano selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerStudioCompositionView({ composition }: { composition: CustomerStudioCompositionData }) {
  const hasOpenAmount = hasVisibleCurrencyAmount(composition.openTotal);
  const hasOverAmount = hasVisibleCurrencyAmount(composition.overTotal);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Distribuição por área/studio · {composition.year}</p>
          <p className="text-sm text-slate-500">
            Alocado: <span className="font-semibold text-slate-800">{formatCurrency(composition.allocatedTotal)}</span>
            {hasOpenAmount && <> · Abaixo da meta: <span className="font-semibold text-red-700">{formatCurrency(composition.openTotal)}</span></>}
            {hasOverAmount && <> · Acima da meta: <span className="font-semibold text-emerald-700">{formatCurrency(composition.overTotal)}</span></>}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Hunter detalhado {formatCurrency(composition.allocatedHunter)} de {formatCurrency(composition.targetHunter)} ·
            {" "}Manutenção alocada {formatCurrency(composition.allocatedMaintenance)} de {formatCurrency(composition.targetMaintenance)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/metas-studios?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
            Ajustar studios
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-cyan-50/60 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Área / Studio</th>
              <th className="px-4 py-2 font-semibold">Hunter</th>
              <th className="px-4 py-2 text-right font-semibold">Hunter</th>
              <th className="px-4 py-2 text-right font-semibold">Manutenção</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {composition.rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.areaName}</td>
                <td className="px-4 py-3 text-slate-600">{row.hunterPersonName}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.hunterAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.maintenanceAmount)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(row.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-brq-purple hover:underline" href={`/metas-studios?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {!composition.rows.length && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Ainda não há meta associada a áreas/studios para este cliente no ano selecionado.
                </td>
              </tr>
            )}
            {hasOpenAmount && (
              <tr className="bg-red-50/70">
                <td className="px-4 py-3 font-semibold text-red-900">Abaixo da meta sem Área/Studio alocada</td>
                <td className="px-4 py-3 text-red-800">-</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.openHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-800">{formatCurrency(composition.openMaintenance)}</td>
                <td className="px-4 py-3 text-right font-bold text-red-900">{formatCurrency(composition.openTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-red-800 hover:underline" href={`/metas-studios?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Alocar
                  </Link>
                </td>
              </tr>
            )}
            {hasOverAmount && (
              <tr className="bg-emerald-50/70">
                <td className="px-4 py-3 font-semibold text-emerald-900">Acima da meta de Área/Studio</td>
                <td className="px-4 py-3 text-emerald-800">-</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-800">{formatCurrency(composition.overHunter)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-800">{formatCurrency(composition.overMaintenance)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-900">{formatCurrency(composition.overTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="font-semibold text-emerald-800 hover:underline" href={`/metas-studios?customerId=${encodeURIComponent(composition.customerId)}&year=${composition.year}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerAllocationWarning({ warning }: { warning: CustomerAllocationWarningData }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 md:col-span-2">
      <p className="font-semibold">Distribuição por pessoa abaixo da meta do cliente</p>
      <p className="mt-1 text-sm">
        Para {warning.year}, faltam {formatCurrency(warning.gap)} para a soma associada às pessoas bater com a meta:
        {" "}{formatCurrency(warning.target)} de meta vs. {formatCurrency(warning.allocated)} distribuído.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {warning.people.length ? warning.people.map((person) => (
          <Button key={person.id} asChild variant="outline" size="sm" className="border-red-300 bg-white/80 text-red-950 hover:bg-white">
            <Link href={`/metas-pessoas?personId=${encodeURIComponent(person.id)}&customerId=${encodeURIComponent(warning.customerId)}&year=${warning.year}`}>
              Ajustar {person.name}
            </Link>
          </Button>
        )) : (
          <Button asChild variant="outline" size="sm" className="border-red-300 bg-white/80 text-red-950 hover:bg-white">
            <Link href={`/metas-pessoas?customerId=${encodeURIComponent(warning.customerId)}&year=${warning.year}`}>
              Abrir Metas por Pessoa
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function getCustomerCoverageStatus(
  customer: Customer,
  people: Person[],
  areas: Area[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
): CustomerCoverageSignal {
  const breakdown = getCustomerTargetBreakdown(customer);
  const customerAllocations = allocations.filter((allocation) =>
    allocation.customerId === customer.id
    && allocation.year === year
    && allocation.type !== "studio"
  );
  const customerStudioAllocations = studioAllocations.filter((allocation) =>
    allocation.customerId === customer.id
    && allocation.year === year
  );
  const assignedPeople = people.filter((person) => person.clientIds.includes(customer.id));
  const hunterAllocation = getContainedHunterAllocation({
    customerId: customer.id,
    year,
    targetAllocations: allocations,
    studioTargetAllocations: studioAllocations,
  });
  const allocatedDirectHunter = hunterAllocation.directHunter;
  const allocatedStudioHunter = hunterAllocation.studioHunter;
  const allocatedHunter = hunterAllocation.containedHunter;
  const allocatedFarmerRenewal = roundCurrency(customerAllocations
    .filter((allocation) => allocation.type === "farmer_renewal")
    .reduce((total, allocation) => total + allocation.amount, 0));
  const allocatedStudioMaintenance = roundCurrency(customerStudioAllocations
    .reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
  const allocated = roundCurrency(allocatedHunter + allocatedFarmerRenewal + allocatedStudioMaintenance);
  const hunterGap = roundCurrency(allocatedHunter - breakdown.hunter);
  const farmerRenewalGap = roundCurrency(allocatedFarmerRenewal - breakdown.farmerRenewal);
  const studioMaintenanceGap = roundCurrency(allocatedStudioMaintenance - breakdown.studio);
  const difference = roundCurrency(hunterGap + farmerRenewalGap + studioMaintenanceGap);
  const compositionTitle = buildCustomerReconciliationTitle({
    year,
    breakdown,
    allocatedHunter,
    allocatedDirectHunter,
    allocatedStudioHunter,
    allocatedFarmerRenewal,
    allocatedStudioMaintenance,
    allocated,
    difference,
    hunterGap,
    farmerRenewalGap,
    studioMaintenanceGap,
    hunterPeople: getAllocationPeopleTitleRows(customerAllocations, people, "hunter"),
    farmerRenewalPeople: getAllocationPeopleTitleRows(customerAllocations, people, "farmer_renewal"),
    studioHunterAreas: getStudioAllocationTitleRows(customerStudioAllocations, areas, "hunter"),
    studioMaintenanceAreas: getStudioAllocationTitleRows(customerStudioAllocations, areas, "maintenance"),
  });

  if (breakdown.total <= 0.01 && !customer.managerResponsibleIds.length && !assignedPeople.length && !customerAllocations.length && !customerStudioAllocations.length) {
    return {
      status: "empty",
      title: [
        "Cliente sem associação ou meta cadastrada no ano selecionado.",
        "",
        compositionTitle,
      ].join("\n"),
      difference: 0,
    };
  }

  if (Math.abs(difference) > 0.01) {
    return {
      status: "mismatch",
      title: [
        getPrimaryReconciliationIssueLabel({
          hunterGap,
          farmerRenewalGap,
          studioMaintenanceGap,
          hunterPeople: getAllocationPeopleTitleRows(customerAllocations, people, "hunter"),
          farmerRenewalPeople: getAllocationPeopleTitleRows(customerAllocations, people, "farmer_renewal"),
          studioHunterAreas: getStudioAllocationTitleRows(customerStudioAllocations, areas, "hunter"),
          studioMaintenanceAreas: getStudioAllocationTitleRows(customerStudioAllocations, areas, "maintenance"),
        }),
        "",
        compositionTitle,
      ].join("\n"),
      difference,
    };
  }

  if (!customer.managerResponsibleIds.length && breakdown.total > 0.01) {
    return {
      status: "issue",
      title: [
        "Cliente com meta reconciliada, mas sem manager responsável cadastrado no ano selecionado.",
        "",
        compositionTitle,
      ].join("\n"),
      difference: 0,
    };
  }

  return {
    status: "ok",
    title: [
      "Cliente reconciliado no ano selecionado.",
      "",
      compositionTitle,
    ].join("\n"),
    difference: 0,
  };
}

function getCustomerStatusIconClassName(status: CustomerCoverageStatus, difference = 0) {
  if (status === "ok") return "bg-emerald-50 text-emerald-700";
  if (status === "mismatch") return difference > 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  if (status === "issue") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-400";
}

function getCoverageStatusLabel(status: CustomerCoverageStatus) {
  if (status === "ok") return "Reconciliado";
  if (status === "mismatch") return "Diferença de valores";
  if (status === "issue") return "Pendente de responsável";
  return "Sem dados";
}

function buildCustomerReconciliationTitle({
  year,
  breakdown,
  allocatedHunter,
  allocatedDirectHunter,
  allocatedStudioHunter,
  allocatedFarmerRenewal,
  allocatedStudioMaintenance,
  allocated,
  difference,
  hunterGap,
  farmerRenewalGap,
  studioMaintenanceGap,
  hunterPeople,
  farmerRenewalPeople,
  studioHunterAreas,
  studioMaintenanceAreas,
}: {
  year: number;
  breakdown: CustomerTargetBreakdown;
  allocatedHunter: number;
  allocatedDirectHunter: number;
  allocatedStudioHunter: number;
  allocatedFarmerRenewal: number;
  allocatedStudioMaintenance: number;
  allocated: number;
  difference: number;
  hunterGap: number;
  farmerRenewalGap: number;
  studioMaintenanceGap: number;
  hunterPeople: string[];
  farmerRenewalPeople: string[];
  studioHunterAreas: string[];
  studioMaintenanceAreas: string[];
}) {
  const direction = Math.abs(difference) <= 0.01
    ? "reconciliado"
    : difference > 0
      ? "acima da meta"
      : "abaixo da meta";
  return [
    Math.abs(difference) <= 0.01
      ? `Diferença de metas em ${year}: ${formatCurrency(0)} reconciliado.`
      : `Diferença de metas em ${year}: ${formatCurrency(Math.abs(difference))} ${direction}.`,
    "",
    "Meta do cliente:",
    `Hunter: ${formatCurrency(breakdown.hunter)}`,
    `Renov. + Ampl.: ${formatCurrency(breakdown.farmerRenewal)}`,
    `Studio Manut.: ${formatCurrency(breakdown.studio)}`,
    `Total esperado: ${formatCurrency(breakdown.total)}`,
    "",
    "Alocado:",
    `Hunter para reconciliação: ${formatCurrency(allocatedHunter)} (soma por pessoa do maior valor entre Meta Hunter direta e Studio Hunter, sem duplicar)`,
    `Meta Hunter direta: ${formatCurrency(allocatedDirectHunter)}`,
    `Studio Hunter detalhado: ${formatCurrency(allocatedStudioHunter)} (contido em Hunter)`,
    `Renov. + Ampl.: ${formatCurrency(allocatedFarmerRenewal)}`,
    `Studio Manut.: ${formatCurrency(allocatedStudioMaintenance)}`,
    `Total alocado: ${formatCurrency(allocated)}`,
    "",
    "Gaps por componente:",
    `Hunter: ${formatGap(hunterGap)}`,
    `Renov. + Ampl.: ${formatGap(farmerRenewalGap)}`,
    `Studio Manut.: ${formatGap(studioMaintenanceGap)}`,
    "",
    "Composição por pessoa/área:",
    "Hunters:",
    ...formatTitleRows(hunterPeople),
    "Renov. + Ampl.:",
    ...formatTitleRows(farmerRenewalPeople),
    "Studio Hunter (contido no Hunter alocado):",
    ...formatTitleRows(studioHunterAreas),
    "Studio Manut.:",
    ...formatTitleRows(studioMaintenanceAreas),
    "",
    `Studio Hunter: ${formatCurrency(breakdown.studioHunter)} fica contido em Hunter e não soma novamente no Total.`,
  ].join("\n");
}

function getPrimaryReconciliationIssueLabel({
  hunterGap,
  farmerRenewalGap,
  studioMaintenanceGap,
  hunterPeople,
  farmerRenewalPeople,
  studioHunterAreas,
  studioMaintenanceAreas,
}: {
  hunterGap: number;
  farmerRenewalGap: number;
  studioMaintenanceGap: number;
  hunterPeople: string[];
  farmerRenewalPeople: string[];
  studioHunterAreas: string[];
  studioMaintenanceAreas: string[];
}) {
  if (hunterGap < -0.01 && !hunterPeople.length && !studioHunterAreas.length) {
    return `Falta Hunter alocado: ${formatCurrency(Math.abs(hunterGap))}.`;
  }
  if (farmerRenewalGap < -0.01 && !farmerRenewalPeople.length) {
    return `Falta Farmer/Delivery alocado: ${formatCurrency(Math.abs(farmerRenewalGap))}.`;
  }
  if (studioMaintenanceGap < -0.01 && !studioMaintenanceAreas.length) {
    return `Falta Área/Studio de manutenção alocada: ${formatCurrency(Math.abs(studioMaintenanceGap))}.`;
  }
  if (hunterGap > 0.01) {
    return `Hunter alocado acima da meta: ${formatCurrency(hunterGap)}.`;
  }
  if (farmerRenewalGap > 0.01) {
    return `Renovação + Ampliação alocada acima da meta: ${formatCurrency(farmerRenewalGap)}.`;
  }
  if (studioMaintenanceGap > 0.01) {
    return `Área/Studio de manutenção acima da meta: ${formatCurrency(studioMaintenanceGap)}.`;
  }
  return "Há diferença entre a meta do cliente e as alocações cadastradas.";
}

function formatGap(value: number) {
  if (Math.abs(value) <= 0.01) return `${formatCurrency(0)} reconciliado`;
  return value > 0
    ? `${formatCurrency(value)} acima`
    : `${formatCurrency(value)} abaixo`;
}

function getAllocationPeopleTitleRows(
  allocations: TargetAllocation[],
  people: Person[],
  type: "hunter" | "farmer_renewal",
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const totalsByPerson = new Map<string, { name: string; amount: number }>();

  allocations
    .filter((allocation) => allocation.type === type)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const current = totalsByPerson.get(allocation.personId) ?? {
        name: person?.name ?? allocation.personId,
        amount: 0,
      };
      current.amount += allocation.amount;
      totalsByPerson.set(allocation.personId, current);
    });

  return Array.from(totalsByPerson.values())
    .map((row) => ({ ...row, amount: roundCurrency(row.amount) }))
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name, "pt-BR"))
    .map((row) => `${row.name}: ${formatCurrency(row.amount)}`);
}

function getStudioAllocationTitleRows(
  allocations: StudioTargetAllocation[],
  areas: Area[],
  type: "hunter" | "maintenance",
) {
  const areaNamesById = new Map(areas.map((area) => [area.id, area.name]));
  const totalsByArea = new Map<string, { name: string; amount: number }>();

  allocations.forEach((allocation) => {
    const current = totalsByArea.get(allocation.areaId) ?? {
      name: areaNamesById.get(allocation.areaId) ?? allocation.areaId,
      amount: 0,
    };
    current.amount += type === "hunter" ? allocation.hunterAmount : allocation.maintenanceAmount;
    totalsByArea.set(allocation.areaId, current);
  });

  return Array.from(totalsByArea.values())
    .map((row) => ({ ...row, amount: roundCurrency(row.amount) }))
    .filter((row) => hasVisibleCurrencyAmount(row.amount))
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name, "pt-BR"))
    .map((row) => `${row.name}: ${formatCurrency(row.amount)}`);
}

function formatTitleRows(rows: string[]) {
  if (!rows.length) return ["- Sem alocação cadastrada"];
  return rows.map((row) => `- ${row}`);
}

function getFormErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar. Verifique permissões, dados e conexão.";
}

function getCustomerDefaults(name: string, directors: Person[]) {
  const normalized = normalizeName(name);
  const caDirectorId = findPersonIdByName(directors, ["CA"]) ?? "ca";
  const aneDirectorId = findPersonIdByName(directors, ["Ane Knust", "Ane Knust Coelho"]) ?? "ane";
  if (normalized.includes("itau")) {
    return { directorResponsibleId: caDirectorId, managerResponsibleIds: [] };
  }
  if (normalized.includes("alelo") || normalized.includes("nuclea") || normalized === "cip") {
    return { directorResponsibleId: caDirectorId, managerResponsibleIds: [] };
  }
  return { directorResponsibleId: aneDirectorId, managerResponsibleIds: [] };
}

function findPersonIdByName(people: Person[], names: string[]) {
  return findPersonIdsByName(people, names)[0];
}

function findPersonIdsByName(people: Person[], names: string[]) {
  const normalizedNames = names.map(normalizeName);
  return people
    .filter((person) => normalizedNames.some((name) => normalizeName(person.name).includes(name)))
    .map((person) => person.id);
}

function getPrimaryHunterIdForCustomer(customerId: string, people: Person[]) {
  if (!customerId) return "";
  return people
    .filter((person) => person.active && isHunterRole(person.roleType) && person.clientIds.includes(customerId))
    .sort((first, second) => first.name.localeCompare(second.name))[0]?.id ?? "";
}

function getCustomerTargetBreakdown(customer: Customer): CustomerTargetBreakdown {
  const hunter = roundCurrency(customer.hunterTarget);
  const farmerRenewal = roundCurrency(customer.farmerRenewalTarget);
  const studioHunter = roundCurrency(customer.studioHunterTarget);
  const studio = roundCurrency(customer.studioTarget);
  return { hunter, farmerRenewal, studioHunter, studio, total: roundCurrency(hunter + farmerRenewal + studio) };
}

function getCustomerAllocationWarning(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
): CustomerAllocationWarningData | null {
  const target = roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget);
  const customerAllocations = allocations.filter((allocation) =>
    allocation.customerId === customer.id
    && allocation.year === year
    && allocation.type !== "studio"
  );
  const hunterAllocation = getContainedHunterAllocation({
    customerId: customer.id,
    year,
    targetAllocations: allocations,
    studioTargetAllocations: studioAllocations,
  });
  const allocatedFarmerRenewal = customerAllocations
    .filter((allocation) => allocation.type === "farmer_renewal")
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const allocated = roundCurrency(hunterAllocation.containedHunter + allocatedFarmerRenewal);
  const gap = roundCurrency(target - allocated);

  if (gap <= 0.01) return null;

  const involvedIds = new Set([
    ...customer.managerResponsibleIds,
    ...customerAllocations.map((allocation) => allocation.personId),
    ...studioAllocations
      .filter((allocation) =>
        allocation.customerId === customer.id
        && allocation.year === year
        && allocation.hunterPersonId
        && hasStudioAllocationValue(allocation)
      )
      .map((allocation) => allocation.hunterPersonId as string),
  ]);
  const involvedPeople = people
    .filter((person) => involvedIds.has(person.id) && person.active && isTargetAssignableRole(person.roleType))
    .sort((first, second) => {
      const firstIsManager = customer.managerResponsibleIds.includes(first.id) ? 0 : 1;
      const secondIsManager = customer.managerResponsibleIds.includes(second.id) ? 0 : 1;
      return firstIsManager - secondIsManager || first.name.localeCompare(second.name);
    })
    .map((person) => ({
      id: person.id,
      name: person.name,
      jobTitle: person.jobTitle,
      roleType: person.roleType,
    }));

  return { customerId: customer.id, year, target, allocated, gap, people: involvedPeople };
}

function getCustomerAllocationComposition(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
  targetBreakdown: CustomerTargetBreakdown,
): CustomerAllocationCompositionData {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rowsByPerson = new Map<string, CustomerAllocationPersonRow>();
  const studioHunterByPerson = new Map<string, number>();

  allocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type !== "studio")
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const current = rowsByPerson.get(allocation.personId) ?? {
        personId: allocation.personId,
        personName: person?.name ?? allocation.personId,
        jobTitle: person?.jobTitle ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Sem perfil",
        hunter: 0,
        farmerRenewal: 0,
        studio: 0,
        total: 0,
      };

      if (allocation.type === "hunter") {
        current.hunter += allocation.amount;
      } else {
        current.farmerRenewal += allocation.amount;
      }
      current.total = current.hunter + current.farmerRenewal + current.studio;
      rowsByPerson.set(allocation.personId, current);
    });

  studioAllocations
    .filter((allocation) =>
      allocation.customerId === customer.id
      && allocation.year === year
      && allocation.hunterPersonId
      && hasStudioAllocationValue(allocation)
    )
    .forEach((allocation) => {
      const personId = allocation.hunterPersonId as string;
      studioHunterByPerson.set(
        personId,
        roundCurrency((studioHunterByPerson.get(personId) ?? 0) + allocation.hunterAmount),
      );
    });

  studioHunterByPerson.forEach((studioHunterAmount, personId) => {
    const person = peopleById.get(personId);
    const current = rowsByPerson.get(personId) ?? {
      personId,
      personName: person?.name ?? personId,
      jobTitle: person?.jobTitle ?? "Pessoa não encontrada",
      roleType: person?.roleType ?? "Sem perfil",
      hunter: 0,
      farmerRenewal: 0,
      studio: 0,
      total: 0,
    };

    current.hunter = Math.max(current.hunter, studioHunterAmount);
    current.total = current.hunter + current.farmerRenewal + current.studio;
    rowsByPerson.set(personId, current);
  });

  const rows = Array.from(rowsByPerson.values())
    .map((row) => ({
      ...row,
      hunter: roundCurrency(row.hunter),
      farmerRenewal: roundCurrency(row.farmerRenewal),
      studio: roundCurrency(row.studio),
      total: roundCurrency(row.total),
    }))
    .sort((first, second) => second.total - first.total || first.personName.localeCompare(second.personName));
  const allocatedHunter = roundCurrency(rows.reduce((total, row) => total + row.hunter, 0));
  const allocatedFarmerRenewal = roundCurrency(rows.reduce((total, row) => total + row.farmerRenewal, 0));
  const allocatedStudio = getCustomerStudioMaintenanceCoverage(customer.id, studioAllocations, year);
  const allocatedTotal = roundCurrency(allocatedHunter + allocatedFarmerRenewal);
  const hunterGap = roundCurrency(targetBreakdown.hunter - allocatedHunter);
  const farmerRenewalTargetForPeople = roundCurrency(Math.max(0, targetBreakdown.farmerRenewal - allocatedStudio));
  const farmerRenewalGap = roundCurrency(farmerRenewalTargetForPeople - allocatedFarmerRenewal);
  const personTargetTotal = roundCurrency(targetBreakdown.hunter + farmerRenewalTargetForPeople);
  const totalGap = roundCurrency(personTargetTotal - allocatedTotal);
  const openTotal = Math.max(0, totalGap);
  const overTotal = Math.max(0, roundCurrency(-totalGap));
  const openSplit = splitFinancialGap(openTotal, Math.max(0, hunterGap), Math.max(0, farmerRenewalGap), 0);
  const overSplit = splitFinancialGap(overTotal, Math.max(0, -hunterGap), Math.max(0, -farmerRenewalGap), 0);

  return {
    customerId: customer.id,
    year,
    rows,
    allocatedHunter,
    allocatedFarmerRenewal,
    allocatedStudio,
    allocatedTotal,
    openHunter: openSplit.hunter,
    openFarmerRenewal: openSplit.farmerRenewal,
    openStudio: openSplit.studio,
    openTotal,
    overHunter: overSplit.hunter,
    overFarmerRenewal: overSplit.farmerRenewal,
    overStudio: overSplit.studio,
    overTotal,
  };
}

function getCustomerStudioMaintenanceCoverage(customerId: string, studioAllocations: StudioTargetAllocation[], year: number) {
  return roundCurrency(studioAllocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year)
    .reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
}

function getCustomerTargetPeople(customer: Customer, people: Person[], allocations: TargetAllocation[], studioAllocations: StudioTargetAllocation[], year: number) {
  return {
    hunterPeople: getCustomerTargetPeopleByType(customer, people, allocations, studioAllocations, year, "hunter"),
    farmerRenewalPeople: getCustomerTargetPeopleByType(customer, people, allocations, studioAllocations, year, "farmer_renewal"),
  };
}

function getCustomerStudioComposition(
  customerId: string,
  studioTarget: number,
  studioHunterTarget: number,
  areas: Area[],
  people: Person[],
  allocations: StudioTargetAllocation[],
  year: number,
): CustomerStudioCompositionData {
  const areaNamesById = new Map(areas.map((area) => [area.id, area.name]));
  const peopleNamesById = new Map(people.map((person) => [person.id, person.name]));
  const rows = allocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year)
    .map((allocation) => ({
      id: allocation.id,
      areaName: areaNamesById.get(allocation.areaId) ?? allocation.areaId,
      hunterPersonName: allocation.hunterPersonId
        ? peopleNamesById.get(allocation.hunterPersonId) ?? allocation.hunterPersonId
        : "Hunter não informado",
      hunterAmount: roundCurrency(allocation.hunterAmount),
      maintenanceAmount: roundCurrency(allocation.maintenanceAmount),
      total: roundCurrency(allocation.hunterAmount + allocation.maintenanceAmount),
    }))
    .sort((first, second) => second.total - first.total || first.areaName.localeCompare(second.areaName, "pt-BR"));
  const allocatedHunter = roundCurrency(rows.reduce((total, row) => total + row.hunterAmount, 0));
  const allocatedMaintenance = roundCurrency(rows.reduce((total, row) => total + row.maintenanceAmount, 0));
  const hunterDifference = roundCurrency(studioHunterTarget - allocatedHunter);
  const maintenanceDifference = roundCurrency(studioTarget - allocatedMaintenance);
  const openHunter = Math.max(0, hunterDifference);
  const openMaintenance = Math.max(0, maintenanceDifference);
  const overMaintenance = Math.max(0, -maintenanceDifference);

  return {
    customerId,
    year,
    targetHunter: roundCurrency(studioHunterTarget),
    targetMaintenance: roundCurrency(studioTarget),
    allocatedHunter,
    allocatedMaintenance,
    openHunter,
    openMaintenance,
    overHunter: 0,
    overMaintenance,
    allocatedTotal: roundCurrency(allocatedHunter + allocatedMaintenance),
    openTotal: roundCurrency(openHunter + openMaintenance),
    overTotal: roundCurrency(overMaintenance),
    rows,
  };
}

function getCustomerTargetPeopleByType(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
  type: "hunter" | "farmer_renewal" | "studio",
) {
  if (type === "studio") return [];

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const totalsByPerson = new Map<string, CustomerTargetPerson>();

  people
    .filter((person) =>
      person.clientIds.includes(customer.id)
      && (type === "hunter"
        ? isHunterRole(person.roleType)
        : type === "farmer_renewal"
          ? isCustomerManagerProfile(person.roleType, person.isManager)
          : isTargetAssignableRole(person.roleType))
    )
    .forEach((person) => {
      totalsByPerson.set(person.id, {
        personId: person.id,
        name: person.name,
        roleType: person.roleType,
        amount: 0,
      });
    });

  allocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type === type)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const current = totalsByPerson.get(allocation.personId) ?? {
        personId: allocation.personId,
        name: person?.name ?? allocation.personId,
        roleType: person?.roleType ?? "Sem perfil",
        amount: 0,
      };
      current.amount += allocation.amount;
      totalsByPerson.set(allocation.personId, current);
    });

  if (type === "hunter") {
    const studioHunterByPerson = new Map<string, number>();
    studioAllocations
      .filter((allocation) =>
        allocation.customerId === customer.id
        && allocation.year === year
        && allocation.hunterPersonId
        && hasStudioAllocationValue(allocation)
      )
      .forEach((allocation) => {
        const personId = allocation.hunterPersonId as string;
        studioHunterByPerson.set(
          personId,
          roundCurrency((studioHunterByPerson.get(personId) ?? 0) + allocation.hunterAmount),
        );
      });

    studioHunterByPerson.forEach((studioHunterAmount, personId) => {
      const person = peopleById.get(personId);
      const current = totalsByPerson.get(personId) ?? {
        personId,
        name: person?.name ?? personId,
        roleType: person?.roleType ?? "Sem perfil",
        amount: 0,
      };
      current.amount = Math.max(current.amount, studioHunterAmount);
      totalsByPerson.set(personId, current);
    });
  }

  return Array.from(totalsByPerson.values())
    .map((person) => ({ ...person, amount: roundCurrency(person.amount) }))
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name));
}

function hasStudioAllocationValue(allocation: StudioTargetAllocation) {
  return allocation.hunterAmount + allocation.maintenanceAmount > 0;
}

function sortCustomerRows(
  rows: Customer[],
  sortState: SortState<CustomerSortKey>,
  people: Person[],
  areas: Area[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "customer") return compareText(first.name, second.name);
    if (sortState.key === "director") return compareText(getCustomerDirectorName(first, people), getCustomerDirectorName(second, people));
    if (sortState.key === "allocated") {
      return compareNumber(
        getCustomerCoverageAllocatedTotal(first, people, allocations, studioAllocations, year),
        getCustomerCoverageAllocatedTotal(second, people, allocations, studioAllocations, year),
      );
    }
    if (sortState.key === "target") return compareNumber(getCustomerTargetBreakdown(first).total, getCustomerTargetBreakdown(second).total);
    if (sortState.key === "margin") return compareNumber(first.margin, second.margin);
    return compareNumber(first.strategicAccount ? 1 : 0, second.strategicAccount ? 1 : 0);
  });
}

function getCustomerDirectorName(customer: Customer, people: Person[]) {
  return displayDirectorName(people.find((person) => person.id === customer.directorResponsibleId)?.name ?? customer.directorResponsibleId);
}

function getCustomerCoverageAllocatedTotal(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
) {
  const breakdown = getCustomerTargetBreakdown(customer);
  const peopleComposition = getCustomerAllocationComposition(customer, people, allocations, studioAllocations, year, breakdown);
  const studioComposition = getCustomerStudioComposition(customer.id, customer.studioTarget, customer.studioHunterTarget, [], people, studioAllocations, year);
  return peopleComposition.allocatedTotal + studioComposition.allocatedTotal;
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

function getInputValue(value: number) {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAmount(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : isThousandSeparatedAmount(sanitized)
      ? sanitized.replace(/\./g, "")
      : sanitized;
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isThousandSeparatedAmount(value: string) {
  return /^\d{1,3}(\.\d{3})+$/.test(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function splitFinancialGap(total: number, hunterCandidate: number, farmerRenewalCandidate: number, studioCandidate: number) {
  const visibleTotal = roundCurrency(total);
  if (!hasVisibleCurrencyAmount(visibleTotal)) {
    return { hunter: 0, farmerRenewal: 0, studio: 0 };
  }

  const candidateTotal = roundCurrency(hunterCandidate + farmerRenewalCandidate + studioCandidate);
  if (!hasVisibleCurrencyAmount(candidateTotal)) {
    return { hunter: 0, farmerRenewal: 0, studio: visibleTotal };
  }

  const hunter = roundCurrency(visibleTotal * (hunterCandidate / candidateTotal));
  const farmerRenewal = roundCurrency(visibleTotal * (farmerRenewalCandidate / candidateTotal));
  return { hunter, farmerRenewal, studio: roundCurrency(visibleTotal - hunter - farmerRenewal) };
}

function hasVisibleCurrencyAmount(value: number) {
  return Math.abs(Math.round(value)) >= 1;
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getInitialCustomerId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("customerId") ?? "";
}

function makeOtherDirectorOption(): Person {
  return {
    id: OTHER_DIRECTOR_ID,
    name: OTHER_DIRECTOR_NAME,
    email: "outros@brq.com",
    jobTitle: "Diretoria a definir",
    roleType: "Director",
    areaId: "area-corporate",
    clientIds: [],
    notes: "Bucket transitório para clientes ainda sem diretoria definida. Não recebe meta direta.",
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 2,
  };
}
