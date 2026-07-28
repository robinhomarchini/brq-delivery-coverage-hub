import type { Area, Customer, Person, TargetAllocation, StudioTargetAllocation } from "@/data/mockData";
import type { BoardTargetBaselineRow } from "@/data/boardTargetBaseline";
import { isDirectorOrExecutiveRole, isDeliveryRole, isFarmerDeliveryTargetRole, isHunterRole, isFarmerRole, isHunterFarmerRole, isStaffRole, isTargetAssignableRole } from "@/lib/roles";
import { getCustomerTotalTarget } from "@/lib/customer-target-total";
import { getCustomerCoverageAllocatedTotal } from "@/lib/customers/customer-coverage-view-model";
import { getBoardTargetBaselineRows } from "@/lib/board-target-baseline";
import { applyCustomerTargetsForYear } from "@/lib/customer-targets";
import { filterCustomersByTargetScope } from "@/lib/domain/customer-target-scope";
import { normalizeBusinessName } from "@/lib/utils";
import type { HunterAccessScope } from "@/lib/hunter-access-scope";

export interface DashboardFilters {
  includeNewLogos: boolean;
  hunterScope: HunterAccessScope;
  targetYear: number;
}

export interface ExecutiveSummary {
  totalTarget: number;
  hunterTarget: number;
  farmerRenewalTarget: number;
  allocatedPeopleTotal: number;
  peopleDelta: number;
  achievementPercentage: number;
  customerCount: number;
  activePeopleCount: number;
  directorCount: number;
  managerCount: number;
}

export interface FinancialByCustomer {
  customerCluster: string;
  revenueCurrent: number;
  revenueTarget: number;
  hunterRevenue: number;
  deliveryFarmerRevenue: number;
  studioRevenue: number;
}

export interface FinancialByDirector {
  name: string;
  revenueTarget: number;
  hunterRevenue: number;
  deliveryFarmerRevenue: number;
}

export interface FinancialByManager {
  name: string;
  revenueTarget: number;
  hunterRevenue: number;
  deliveryFarmerRevenue: number;
}

export interface RoleDistributionItem {
  name: string;
  value: number;
}

export interface ClientCountByManager {
  name: string;
  clientes: number;
}

export interface ClientCountByDirector {
  name: string;
  clientes: number;
}

export interface ManagementAlert {
  type: string;
  severity: "info" | "warning" | "danger";
  description: string;
  affectedEntity: string;
  count: number;
  detail?: string;
}

export interface DashboardData {
  summary: ExecutiveSummary;
  financialByCustomer: FinancialByCustomer[];
  financialByDirector: FinancialByDirector[];
  financialByManager: FinancialByManager[];
  roleDistribution: RoleDistributionItem[];
  clientsByManager: ClientCountByManager[];
  clientsByDirector: ClientCountByDirector[];
  alerts: ManagementAlert[];
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getScopedBoardTotals(
  customers: Array<{ name: string; hunterTarget: number; farmerRenewalTarget: number; studioTarget: number }>,
  boardRows: BoardTargetBaselineRow[],
  scoped: boolean,
) {
  if (!scoped) return getBoardTargetBaselineTotalsFromRows(boardRows);

  const rowsByCustomer = new Map(boardRows.map((row) => [normalizeBusinessName(row.customerName), row]));

  return customers.reduce((totals, customer) => {
    const baseline = rowsByCustomer.get(normalizeBusinessName(customer.name));
    const hunterTarget = baseline?.hunterTarget ?? customer.hunterTarget;
    const farmerRenewalTarget = baseline?.farmerRenewalTarget ?? customer.farmerRenewalTarget;
    const totalTarget = baseline?.totalTarget ?? getCustomerTotalTarget(customer);

    return {
      hunterTarget: roundCurrency(totals.hunterTarget + hunterTarget),
      farmerRenewalTarget: roundCurrency(totals.farmerRenewalTarget + farmerRenewalTarget),
      totalTarget: roundCurrency(totals.totalTarget + totalTarget),
    };
  }, { hunterTarget: 0, farmerRenewalTarget: 0, totalTarget: 0 });
}

function getBoardTargetBaselineTotalsFromRows(rows: BoardTargetBaselineRow[]) {
  return rows.reduce((totals, row) => ({
    hunterTarget: roundCurrency(totals.hunterTarget + row.hunterTarget),
    farmerRenewalTarget: roundCurrency(totals.farmerRenewalTarget + row.farmerRenewalTarget),
    totalTarget: roundCurrency(totals.totalTarget + row.totalTarget),
  }), { hunterTarget: 0, farmerRenewalTarget: 0, totalTarget: 0 });
}

export function buildDashboardData(
  people: Person[],
  customers: Customer[],
  customerTargets: Array<{ customerId: string; year: number; hunterTarget: number; farmerRenewalTarget: number; studioHunterTarget: number; studioTarget: number; revenue: number; countsTowardTarget?: boolean }>,
  targetAllocations: TargetAllocation[],
  studioTargetAllocations: StudioTargetAllocation[],
  boardTargetBaselines: BoardTargetBaselineRow[],
  areas: Area[],
  filters: DashboardFilters,
): DashboardData {
  const financialCustomers = applyCustomerTargetsForYear(customers, customerTargets, filters.targetYear);
  const dashboardCustomers = filterCustomersByTargetScope(financialCustomers, filters.includeNewLogos)
    .filter((customer) => !filters.hunterScope.enabled || filters.hunterScope.customerIds.has(customer.id));
  const scopedCustomerIds = new Set(dashboardCustomers.map((customer) => customer.id));

  const activePeople = people.filter((person) => {
    if (!person.active) return false;
    if (!filters.hunterScope.enabled) return true;
    if (filters.hunterScope.person?.id === person.id) return true;
    return person.clientIds.some((customerId) => scopedCustomerIds.has(customerId))
      || targetAllocations.some((allocation) => allocation.personId === person.id && scopedCustomerIds.has(allocation.customerId))
      || studioTargetAllocations.some((allocation) =>
        scopedCustomerIds.has(allocation.customerId)
        && (allocation.hunterPersonId === person.id || allocation.maintenancePersonId === person.id)
      );
  });

  const directors = activePeople.filter((person) => isDirectorOrExecutiveRole(person.roleType));
  const managers = activePeople.filter((person) => person.isManager);
  const farmerDeliveryManagers = managers.filter((person) => isFarmerDeliveryTargetRole(person.roleType));
  const deliveryManagers = managers.filter((person) => isDeliveryRole(person.roleType));
  const hunters = activePeople.filter((person) => isHunterRole(person.roleType));
  const farmers = activePeople.filter((person) => isFarmerRole(person.roleType));
  const hunterFarmers = activePeople.filter((person) => isHunterFarmerRole(person.roleType));
  const staff = activePeople.filter((person) => isStaffRole(person.roleType));

  const boardRows = getBoardTargetBaselineRows(filters.targetYear, boardTargetBaselines);
  const boardTotals = getScopedBoardTotals(dashboardCustomers, boardRows, filters.hunterScope.enabled);
  const totalRevenue = boardTotals.totalTarget;

  const baselineByCustomer = new Map(
    boardRows.map((row) => [normalizeBusinessName(row.customerName), row.totalTarget]),
  );

  const dashboardCustomerIds = new Set(dashboardCustomers.map((customer) => customer.id));
  const dashboardTargetAllocations = targetAllocations.filter((allocation) => dashboardCustomerIds.has(allocation.customerId));
  const dashboardStudioTargetAllocations = studioTargetAllocations.filter((allocation) => dashboardCustomerIds.has(allocation.customerId));

  const allocatedPeopleByCustomer = new Map(dashboardCustomers.map((customer) => [
    customer.id,
    getCustomerCoverageAllocatedTotal(customer, people, dashboardTargetAllocations, dashboardStudioTargetAllocations, areas, filters.targetYear),
  ]));

  const allocatedPeopleTotal = roundCurrency(Array.from(allocatedPeopleByCustomer.values()).reduce((total, value) => total + value, 0));
  const peopleDelta = roundCurrency(allocatedPeopleTotal - boardTotals.totalTarget);

  const achievementPercentage = totalRevenue > 0
    ? roundCurrency((allocatedPeopleTotal / totalRevenue) * 100)
    : 0;

  const financialByCustomer = dashboardCustomers
    .map((customer) => {
      const baselineTarget = baselineByCustomer.get(normalizeBusinessName(customer.name)) ?? getCustomerTotalTarget(customer);
      const allocatedPeople = allocatedPeopleByCustomer.get(customer.id) ?? 0;
      return {
        customerCluster: customer.name,
        revenueCurrent: allocatedPeople,
        revenueTarget: baselineTarget,
        hunterRevenue: customer.hunterTarget,
        deliveryFarmerRevenue: customer.farmerRenewalTarget,
        studioRevenue: customer.studioTarget,
      };
    })
    .filter((item) => item.revenueCurrent > 0 || item.revenueTarget > 0)
    .sort((a, b) => Math.max(b.revenueCurrent, b.revenueTarget) - Math.max(a.revenueCurrent, a.revenueTarget))
    .slice(0, 10);

  const financialByDirector = activePeople
    .filter((person) => isDirectorOrExecutiveRole(person.roleType))
    .map((director) => {
      const plans = dashboardCustomers.filter((customer) => customer.directorResponsibleId === director.id);
      return {
        name: director.name,
        revenueTarget: plans.reduce((total, customer) => total + getCustomerTotalTarget(customer), 0),
        hunterRevenue: plans.reduce((total, customer) => total + customer.hunterTarget, 0),
        deliveryFarmerRevenue: plans.reduce((total, customer) => total + customer.farmerRenewalTarget, 0),
      };
    })
    .filter((item) => item.revenueTarget > 0)
    .sort((a, b) => b.revenueTarget - a.revenueTarget);

  const financialByManager = managers
    .map((manager) => {
      const plans = dashboardCustomers.filter((customer) => customer.managerResponsibleIds.includes(manager.id));
      return {
        name: manager.name,
        revenueTarget: plans.reduce((total, customer) => total + getCustomerTotalTarget(customer), 0),
        hunterRevenue: plans.reduce((total, customer) => total + customer.hunterTarget, 0),
        deliveryFarmerRevenue: plans.reduce((total, customer) => total + customer.farmerRenewalTarget, 0),
      };
    })
    .filter((item) => item.revenueTarget > 0)
    .sort((a, b) => b.revenueTarget - a.revenueTarget);

  const distributionByDirector = activePeople
    .filter((person) => isDirectorOrExecutiveRole(person.roleType))
    .map((director) => ({
      name: director.name,
      managers: managers.filter((manager) => manager.directorId === director.id).length,
      clientes: dashboardCustomers.filter((customer) => customer.directorResponsibleId === director.id).length,
    }));

  const roleDistribution: RoleDistributionItem[] = [
    { name: "Delivery", value: deliveryManagers.length },
    { name: "Farmer + Delivery", value: farmerDeliveryManagers.length },
    { name: "Hunter", value: hunters.length },
    { name: "Farmer", value: farmers.length },
    { name: "Hunter + Farmer", value: hunterFarmers.length },
    { name: "Staff", value: staff.length },
  ].filter((item) => item.value > 0);

  const clientsByManager = managers
    .map((manager) => ({
      name: manager.name.split(" ")[0],
      clientes: dashboardCustomers.filter((customer) => customer.managerResponsibleIds.includes(manager.id)).length,
    }))
    .sort((a, b) => b.clientes - a.clientes)
    .slice(0, 10);

  const clientsByDirector = distributionByDirector
    .sort((a, b) => b.clientes - a.clientes);

  const alerts = buildManagementAlerts(
    people,
    customers,
    dashboardCustomers,
    targetAllocations,
    studioTargetAllocations,
    filters.targetYear,
  );

  const summary: ExecutiveSummary = {
    totalTarget: totalRevenue,
    hunterTarget: boardTotals.hunterTarget,
    farmerRenewalTarget: boardTotals.farmerRenewalTarget,
    allocatedPeopleTotal,
    peopleDelta,
    achievementPercentage,
    customerCount: dashboardCustomers.length,
    activePeopleCount: activePeople.length,
    directorCount: directors.length,
    managerCount: managers.length,
  };

  return {
    summary,
    financialByCustomer,
    financialByDirector,
    financialByManager,
    roleDistribution,
    clientsByManager,
    clientsByDirector,
    alerts,
  };
}

function buildManagementAlerts(
  people: Person[],
  allCustomers: Customer[],
  dashboardCustomers: Customer[],
  targetAllocations: TargetAllocation[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
): ManagementAlert[] {
  const alerts: ManagementAlert[] = [];

  const activePeopleWithoutTarget = people.filter((person) => {
    if (!person.active) return false;
    if (!isTargetAssignableRole(person.roleType)) return false;
    const hasTarget = targetAllocations.some(
      (allocation) => allocation.personId === person.id && allocation.year === year && allocation.amount > 0,
    );
    const hasStudioTarget = studioTargetAllocations.some(
      (allocation) =>
        (allocation.hunterPersonId === person.id || allocation.maintenancePersonId === person.id)
        && allocation.year === year
        && (allocation.hunterAmount > 0 || allocation.maintenanceAmount > 0),
    );
    return !hasTarget && !hasStudioTarget;
  });

  if (activePeopleWithoutTarget.length > 0) {
    alerts.push({
      type: "activePersonWithoutTarget",
      severity: "warning",
      description: "Pessoa ativa com perfil alocável sem meta cadastrada no ano vigente.",
      affectedEntity: `${activePeopleWithoutTarget.length} pessoa(s)`,
      count: activePeopleWithoutTarget.length,
      detail: activePeopleWithoutTarget.map((p) => p.name).join(", "),
    });
  }

  const customersWithoutResponsible = dashboardCustomers.filter((customer) => {
    const hasManager = customer.managerResponsibleIds.length > 0;
    const hasPerson = people.some((person) => person.clientIds.includes(customer.id) && person.active);
    return !hasManager && !hasPerson;
  });

  if (customersWithoutResponsible.length > 0) {
    alerts.push({
      type: "customerWithoutResponsible",
      severity: "danger",
      description: "Cliente sem manager responsável e sem pessoa vinculada ativa.",
      affectedEntity: `${customersWithoutResponsible.length} cliente(s)`,
      count: customersWithoutResponsible.length,
      detail: customersWithoutResponsible.map((c) => c.name).join(", "),
    });
  }

  const customersWithoutDirector = dashboardCustomers.filter((customer) => {
    return !people.some((person) => person.id === customer.directorResponsibleId && person.active);
  });

  if (customersWithoutDirector.length > 0) {
    alerts.push({
      type: "customerWithoutDirector",
      severity: "warning",
      description: "Cliente com diretor responsável inativo ou não cadastrado.",
      affectedEntity: `${customersWithoutDirector.length} cliente(s)`,
      count: customersWithoutDirector.length,
      detail: customersWithoutDirector.map((c) => c.name).join(", "),
    });
  }

  const inactivePeopleInActiveTotals = people.filter((person) => {
    if (person.active) return false;
    return targetAllocations.some(
      (allocation) => allocation.personId === person.id && allocation.year === year,
    ) || studioTargetAllocations.some(
      (allocation) =>
        (allocation.hunterPersonId === person.id || allocation.maintenancePersonId === person.id)
        && allocation.year === year,
    );
  });

  if (inactivePeopleInActiveTotals.length > 0) {
    alerts.push({
      type: "inactivePersonInActiveTotals",
      severity: "info",
      description: "Pessoa inativa com alocações de meta no ano vigente.",
      affectedEntity: `${inactivePeopleInActiveTotals.length} pessoa(s)`,
      count: inactivePeopleInActiveTotals.length,
      detail: inactivePeopleInActiveTotals.map((p) => p.name).join(", "),
    });
  }

  const customersWithNoTarget = dashboardCustomers.filter((customer) => {
    const target = getCustomerTotalTarget(customer);
    return target <= 0;
  });

  if (customersWithNoTarget.length > 0) {
    alerts.push({
      type: "customerWithNoTarget",
      severity: "info",
      description: "Cliente no escopo do dashboard sem meta cadastrada.",
      affectedEntity: `${customersWithNoTarget.length} cliente(s)`,
      count: customersWithNoTarget.length,
      detail: customersWithNoTarget.map((c) => c.name).join(", "),
    });
  }

  return alerts;
}