import type { Area, Customer, Person, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import type { SortDirection, SortState } from "@/components/shared/sortable-table-head";
import { getCustomerEffectiveTotalTarget, getCustomerTotalTarget } from "@/lib/customer-target-total";
import { customerCountsTowardTarget } from "@/lib/domain/customer-target-scope";
import { displayDirectorName } from "@/lib/director-governance";
import { isCustomerFarmerResponsibleProfile, isHunterSelectionRole, isSpecialistHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { formatCurrency, roundCurrency } from "@/lib/utils";

export interface CustomerTargetBreakdown {
  hunter: number;
  farmerRenewal: number;
  studioHunter: number;
  studio: number;
  total: number;
}

export interface CustomerDerivedStudioTargets {
  studioHunterTarget: number;
  studioTarget: number;
  total: number;
}

export interface CustomerAllocationWarningData {
  customerId: string;
  year: number;
  target: number;
  allocated: number;
  gap: number;
  people: Pick<Person, "id" | "name" | "jobTitle" | "roleType">[];
}

export interface CustomerAllocationCompositionData {
  customerId: string;
  year: number;
  rows: CustomerAllocationPersonRow[];
  allocatedHunter: number;
  allocatedFarmerRenewal: number;
  allocatedStudio: number;
  targetFarmerRenewal: number;
  farmerRenewalTargetForPeople: number;
  eligibleStudioMaintenance: number;
  studioMaintenanceOutsidePeople: number;
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

export interface CustomerStudioCompositionData {
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

export interface CustomerStudioAllocationRow {
  id: string;
  areaName: string;
  hunterPersonName: string;
  maintenancePersonName: string;
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
}

export interface CustomerAllocationPersonRow {
  personId: string;
  personName: string;
  jobTitle: string;
  roleType: string;
  hunter: number;
  farmerRenewal: number;
  studio: number;
  total: number;
}

export interface CustomerTargetPerson {
  personId: string;
  name: string;
  roleType: string;
  amount: number;
}

export type CustomerCoverageStatus = "ok" | "issue" | "mismatch" | "specialist" | "outOfTarget" | "empty";

export type CustomerCoverageSignal = {
  status: CustomerCoverageStatus;
  title: string;
  difference?: number;
};

export type CustomerSortKey = "customer" | "director" | "allocated" | "target" | "margin" | "strategic";

export function getCustomerTargetBreakdown(customer: Customer): CustomerTargetBreakdown {
  if (!customerCountsTowardTarget(customer)) {
    return { hunter: 0, farmerRenewal: 0, studioHunter: 0, studio: 0, total: 0 };
  }
  const hunter = roundCurrency(customer.hunterTarget);
  const farmerRenewal = roundCurrency(customer.farmerRenewalTarget);
  const studioHunter = roundCurrency(customer.studioHunterTarget);
  const studio = roundCurrency(customer.studioTarget);
  return { hunter, farmerRenewal, studioHunter, studio, total: getCustomerTotalTarget({ hunterTarget: hunter, farmerRenewalTarget: farmerRenewal }) };
}

export function getCustomerDerivedStudioTargets(
  customerId: string,
  allocations: StudioTargetAllocation[],
  year: number,
): CustomerDerivedStudioTargets {
  const customerAllocations = allocations.filter((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
  );
  const studioHunterTarget = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.hunterAmount, 0));
  const studioTarget = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.maintenanceAmount, 0));

  return {
    studioHunterTarget,
    studioTarget,
    total: roundCurrency(studioHunterTarget + studioTarget),
  };
}

export function getCustomerCoverageStatus(
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
  const hunterAllocation = getContainedHunterAllocationForCustomer(customer.id, people, allocations, studioAllocations, year);
  const allocatedDirectHunter = hunterAllocation.directHunter;
  const allocatedStudioHunter = hunterAllocation.studioHunter;
  const allocatedHunter = hunterAllocation.containedHunter;
  const allocatedFarmerRenewal = roundCurrency(customerAllocations
    .filter((allocation) => allocation.type === "farmer_renewal")
    .reduce((total, allocation) => total + allocation.amount, 0));
  const allocatedStudioMaintenance = roundCurrency(customerStudioAllocations
    .reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
  const allocated = getContainedCustomerAllocatedTotal(allocatedHunter, allocatedFarmerRenewal);
  const hunterGap = roundCurrency(allocatedHunter - breakdown.hunter);
  const farmerRenewalGap = roundCurrency(allocatedFarmerRenewal - breakdown.farmerRenewal);
  const studioMaintenanceGap = roundCurrency(allocatedStudioMaintenance - breakdown.studio);
  const difference = roundCurrency(hunterGap + farmerRenewalGap);
  const specialistOnlyCoverage = hasOnlySpecialistHunterCoverage(customer, people, customerAllocations, customerStudioAllocations);
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

  if (!customerCountsTowardTarget(customer)) {
    return {
      status: "outOfTarget",
      title: [
        "Cliente New Logo mantido no controle, mas sem compor a meta oficial do ano selecionado.",
        "",
        compositionTitle,
      ].join("\n"),
      difference: 0,
    };
  }

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

  if (specialistOnlyCoverage) {
    return {
      status: "specialist",
      title: [
        "Cliente com cobertura apenas por Hunter Especializado.",
        "",
        compositionTitle,
      ].join("\n"),
      difference,
    };
  }

  if (difference < -0.01 && hasVisibleCurrencyAmount(difference)) {
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

  if (difference > 0.01 && hasVisibleCurrencyAmount(difference)) {
    return {
      status: "mismatch",
      title: [
        "Distribuição por pessoas acima da meta geral do cliente.",
        "",
        compositionTitle,
      ].join("\n"),
      difference,
    };
  }

  if (!customer.managerResponsibleIds.length && breakdown.farmerRenewal > 0.01) {
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

export function getCustomerStatusIconClassName(status: CustomerCoverageStatus, difference = 0) {
  if (status === "ok") return "bg-sky-50 text-sky-700";
  if (status === "specialist") return "bg-purple-50 text-purple-700";
  if (status === "outOfTarget") return "bg-slate-100 text-slate-700";
  if (status === "mismatch") return difference > 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  if (status === "issue") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-400";
}

export function getCoverageStatusLabel(status: CustomerCoverageStatus) {
  if (status === "ok") return "Reconciliado";
  if (status === "specialist") return "Hunter Especializado";
  if (status === "outOfTarget") return "New Logo";
  if (status === "mismatch") return "Diferença de valores";
  if (status === "issue") return "Pendente de responsável";
  return "Sem dados";
}

export function getCustomerAllocationWarning(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
): CustomerAllocationWarningData | null {
  if (!customerCountsTowardTarget(customer)) return null;

  const target = getCustomerEffectiveTotalTarget(customer);
  const customerAllocations = allocations.filter((allocation) =>
    allocation.customerId === customer.id
    && allocation.year === year
    && allocation.type !== "studio"
  );
  const hunterAllocation = getContainedHunterAllocationForCustomer(customer.id, people, allocations, studioAllocations, year);
  const allocatedFarmerRenewal = customerAllocations
    .filter((allocation) => allocation.type === "farmer_renewal")
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const allocated = getContainedCustomerAllocatedTotal(hunterAllocation.containedHunter, allocatedFarmerRenewal);
  const gap = roundCurrency(target - allocated);

  if (!hasVisibleCurrencyAmount(gap)) return null;

  const involvedIds = new Set([
    ...customer.managerResponsibleIds,
    ...customerAllocations
      .filter((allocation) => hasVisibleCurrencyAmount(allocation.amount))
      .map((allocation) => allocation.personId),
    ...studioAllocations
      .filter((allocation) =>
        allocation.customerId === customer.id
        && allocation.year === year
        && hasStudioAllocationValue(allocation)
      )
      .map((allocation) => getEffectiveStudioHunterPersonId(allocation, people, allocations))
      .filter(Boolean),
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

export function getCustomerAllocationComposition(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  areas: Area[],
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
      if (!isOfficialTargetPerson(person)) return;
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
      && hasStudioAllocationValue(allocation)
    )
    .forEach((allocation) => {
      const personId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      if (!personId) return;
      if (!isOfficialTargetPerson(peopleById.get(personId))) return;
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
  const eligibleStudioMaintenance = getCustomerStudioMaintenanceCoverage(customer.id, studioAllocations, year, peopleById, true);
  const studioMaintenanceOutsidePeople = getCustomerStudioMaintenanceCoverage(customer.id, studioAllocations, year, peopleById, false);
  const allocatedTotal = getContainedCustomerAllocatedTotal(allocatedHunter, allocatedFarmerRenewal);
  const hunterGap = roundCurrency(targetBreakdown.hunter - allocatedHunter);
  const farmerRenewalTargetForPeople = targetBreakdown.farmerRenewal;
  const farmerRenewalGap = roundCurrency(farmerRenewalTargetForPeople - allocatedFarmerRenewal);
  const personTargetTotal = roundCurrency(targetBreakdown.hunter + farmerRenewalTargetForPeople);
  const totalGap = roundCurrency(personTargetTotal - allocatedTotal);
  const openTotal = Math.max(0, totalGap);
  const overTotal = 0;
  const openSplit = splitFinancialGap(openTotal, Math.max(0, hunterGap), Math.max(0, farmerRenewalGap), 0);
  const overSplit = { hunter: 0, farmerRenewal: 0, studio: 0 };

  return {
    customerId: customer.id,
    year,
    rows,
    allocatedHunter,
    allocatedFarmerRenewal,
    allocatedStudio: studioMaintenanceOutsidePeople,
    targetFarmerRenewal: targetBreakdown.farmerRenewal,
    farmerRenewalTargetForPeople,
    eligibleStudioMaintenance,
    studioMaintenanceOutsidePeople,
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

export function getCustomerTargetPeople(customer: Customer, people: Person[], allocations: TargetAllocation[], studioAllocations: StudioTargetAllocation[], year: number) {
  return {
    hunterPeople: getCustomerTargetPeopleByType(customer, people, allocations, studioAllocations, year, "hunter"),
    farmerRenewalPeople: getCustomerTargetPeopleByType(customer, people, allocations, studioAllocations, year, "farmer_renewal"),
  };
}

export function getCustomerStudioComposition(
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
      hunterPersonName: getEffectiveStudioHunterPersonId(allocation, people, [])
        ? peopleNamesById.get(getEffectiveStudioHunterPersonId(allocation, people, [])) ?? getEffectiveStudioHunterPersonId(allocation, people, [])
        : "Hunter não informado",
      maintenancePersonName: getStudioMaintenancePersonId(allocation)
        ? peopleNamesById.get(getStudioMaintenancePersonId(allocation) as string) ?? getStudioMaintenancePersonId(allocation) as string
        : "Responsável não informado",
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

export function sortCustomerRows(
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
        getCustomerCoverageAllocatedTotal(first, people, allocations, studioAllocations, areas, year),
        getCustomerCoverageAllocatedTotal(second, people, allocations, studioAllocations, areas, year),
      );
    }
    if (sortState.key === "target") return compareNumber(getCustomerTargetBreakdown(first).total, getCustomerTargetBreakdown(second).total);
    if (sortState.key === "margin") return compareNumber(first.margin, second.margin);
    return compareNumber(first.strategicAccount ? 1 : 0, second.strategicAccount ? 1 : 0);
  });
}

export function getPrimaryHunterIdForCustomer(customerId: string, people: Person[]) {
  if (!customerId) return "";
  return people
    .filter((person) => person.active && isHunterSelectionRole(person.roleType) && person.clientIds.includes(customerId))
    .sort((first, second) => first.name.localeCompare(second.name))[0]?.id ?? "";
}

export function hasVisibleCurrencyAmount(value: number) {
  return Math.abs(value) >= 1;
}

function getContainedHunterAllocationForCustomer(
  customerId: string,
  people: Person[],
  targetAllocations: TargetAllocation[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const directByPerson = new Map<string, number>();
  const studioByPerson = new Map<string, number>();

  targetAllocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.type === "hunter")
    .forEach((allocation) => {
      if (!isOfficialTargetPerson(peopleById.get(allocation.personId))) return;
      directByPerson.set(allocation.personId, roundCurrency((directByPerson.get(allocation.personId) ?? 0) + allocation.amount));
    });

  studioTargetAllocations
    .filter((allocation) => allocation.customerId === customerId && allocation.year === year && allocation.hunterAmount > 0)
    .forEach((allocation) => {
      const personId = getEffectiveStudioHunterPersonId(allocation, people, targetAllocations);
      if (!personId) return;
      if (!isOfficialTargetPerson(peopleById.get(personId))) return;
      studioByPerson.set(personId, roundCurrency((studioByPerson.get(personId) ?? 0) + allocation.hunterAmount));
    });

  const personIds = new Set([...directByPerson.keys(), ...studioByPerson.keys()]);
  const containedHunter = Array.from(personIds).reduce((total, personId) => {
    const direct = directByPerson.get(personId) ?? 0;
    const studio = studioByPerson.get(personId) ?? 0;
    return total + Math.max(direct, studio);
  }, 0);

  return {
    directHunter: roundCurrency(sumMapValues(directByPerson)),
    studioHunter: roundCurrency(sumMapValues(studioByPerson)),
    containedHunter: roundCurrency(containedHunter),
  };
}

function hasOnlySpecialistHunterCoverage(
  customer: Customer,
  people: Person[],
  customerAllocations: TargetAllocation[],
  customerStudioAllocations: StudioTargetAllocation[],
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const personIds = new Set([
    ...people
      .filter((person) => person.clientIds.includes(customer.id) && isHunterSelectionRole(person.roleType))
      .map((person) => person.id),
    ...customerAllocations
      .filter((allocation) => hasVisibleCurrencyAmount(allocation.amount))
      .map((allocation) => allocation.personId),
    ...customerStudioAllocations
      .filter((allocation) => hasStudioAllocationValue(allocation))
      .map((allocation) => getEffectiveStudioHunterPersonId(allocation, people, customerAllocations))
      .filter(Boolean),
  ]);
  const involvedPeople = Array.from(personIds)
    .map((personId) => peopleById.get(personId))
    .filter((person): person is Person => Boolean(person));

  return involvedPeople.length > 0 && involvedPeople.every((person) => isSpecialistHunterRole(person.roleType));
}

function sumMapValues(values: Map<string, number>) {
  return Array.from(values.values()).reduce((total, value) => total + value, 0);
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
  const isCovered = difference >= -0.01;
  return [
    isCovered
      ? `Diferença de metas em ${year}: ${formatCurrency(0)} reconciliado. A alocação cobre a meta cadastrada.`
      : `Diferença de metas em ${year}: ${formatCurrency(Math.abs(difference))} abaixo da meta.`,
    "",
    "Meta do cliente:",
    `Hunter: ${formatCurrency(breakdown.hunter)}`,
    `Renov. + Ampl.: ${formatCurrency(breakdown.farmerRenewal)}`,
    `Studio Manut.: ${formatCurrency(breakdown.studio)} (contido em Renov. + Ampl.)`,
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
    `Studio Manut.: ${formatCurrency(breakdown.studio)} fica contido em Renovação + Ampliação e não soma novamente no Total.`,
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

function getCustomerStudioMaintenanceCoverage(
  customerId: string,
  studioAllocations: StudioTargetAllocation[],
  year: number,
  peopleById: Map<string, Person>,
  expectedEligible: boolean,
) {
  return roundCurrency(studioAllocations
    .filter((allocation) => {
      if (allocation.customerId !== customerId || allocation.year !== year) return false;
      if (!allocation.maintenanceAmount) return false;
      const maintenancePersonId = allocation.maintenancePersonId;
      const hasMaintenanceResponsible = Boolean(maintenancePersonId && peopleById.get(maintenancePersonId));
      return hasMaintenanceResponsible === expectedEligible;
    })
    .reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
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
  const primaryHunterId = type === "hunter" ? getPrimaryHunterIdForCustomer(customer.id, people) : "";

  people
    .filter((person) =>
      person.clientIds.includes(customer.id)
      && (type === "hunter"
        ? person.id === primaryHunterId
        : type === "farmer_renewal"
        ? isCustomerFarmerResponsibleProfile(person.roleType, person.isManager)
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
      if (!isOfficialTargetPerson(person)) return;
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
        && hasStudioAllocationValue(allocation)
      )
      .forEach((allocation) => {
        const personId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
        if (!personId) return;
        studioHunterByPerson.set(
          personId,
          roundCurrency((studioHunterByPerson.get(personId) ?? 0) + allocation.hunterAmount),
        );
      });

    studioHunterByPerson.forEach((studioHunterAmount, personId) => {
      const person = peopleById.get(personId);
      if (!isOfficialTargetPerson(person)) return;
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

  const rows = Array.from(totalsByPerson.values())
    .map((person) => ({ ...person, amount: roundCurrency(person.amount) }));
  const hasHunterWithValue = type === "hunter" && rows.some((person) => person.amount > 0.01);

  return rows
    .filter((person) => type !== "hunter" || person.amount > 0.01 || (!hasHunterWithValue && person.personId === primaryHunterId))
    .sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name));
}

function getEffectiveStudioHunterPersonId(
  allocation: StudioTargetAllocation,
  people: Person[],
  targetAllocations: TargetAllocation[],
) {
  if (allocation.hunterPersonId) return allocation.hunterPersonId;

  const hunterFromDirectTarget = targetAllocations
    .filter((targetAllocation) =>
      targetAllocation.customerId === allocation.customerId
      && targetAllocation.year === allocation.year
      && targetAllocation.type === "hunter"
    )
    .sort((first, second) => second.amount - first.amount)[0]?.personId;

  return hunterFromDirectTarget || getPrimaryHunterIdForCustomer(allocation.customerId, people);
}

function isOfficialTargetPerson(person: Person | undefined) {
  return Boolean(person?.active && isTargetAssignableRole(person.roleType));
}

function getStudioMaintenancePersonId(allocation: Pick<StudioTargetAllocation, "hunterPersonId" | "maintenancePersonId">) {
  return allocation.maintenancePersonId ?? allocation.hunterPersonId;
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

function getCustomerDirectorName(customer: Customer, people: Person[]) {
  return displayDirectorName(people.find((person) => person.id === customer.directorResponsibleId)?.name ?? customer.directorResponsibleId);
}

export function getCustomerCoverageAllocatedTotal(
  customer: Customer,
  people: Person[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  areas: Area[],
  year: number,
) {
  const breakdown = getCustomerTargetBreakdown(customer);
  const peopleComposition = getCustomerAllocationComposition(customer, people, allocations, studioAllocations, areas, year, breakdown);
  return peopleComposition.allocatedTotal;
}

function getContainedCustomerAllocatedTotal(allocatedHunter: number, allocatedFarmerRenewal: number) {
  return roundCurrency(allocatedHunter + allocatedFarmerRenewal);
}

function hasStudioAllocationValue(allocation: StudioTargetAllocation) {
  return allocation.hunterAmount + allocation.maintenanceAmount > 0;
}

function formatGap(value: number) {
  if (Math.abs(value) <= 0.01) return `${formatCurrency(0)} reconciliado`;
  return value > 0
    ? `${formatCurrency(value)} acima`
    : `${formatCurrency(value)} abaixo`;
}

function formatTitleRows(rows: string[]) {
  if (!rows.length) return ["- Sem alocação cadastrada"];
  return rows.map((row) => `- ${row}`);
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
