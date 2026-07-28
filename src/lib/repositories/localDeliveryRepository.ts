import { areas, customers, customerTargets, people, specialistHunterStudioAssignments, studioTargetAllocations, subjects, targetAllocations } from "@/data/mockData";
import { boardTargetBaselineRows } from "@/data/boardTargetBaseline";
import type { Area, Customer, Person, PersonCompensation, StudioTargetAllocation, Subject, TargetAllocation } from "@/data/mockData";
import type { DashboardMetricResult, DashboardSummaryFilters, DeliveryData, DeliveryRepository, PersonCustomerRemovalInput, PersonCustomerTargetsInput, SpecialistHunterStudioAssignmentsInput, CustomerPerformanceResult, CustomerPerformanceMetric } from "./types";
import type { StudioBaselineSnapshot } from "@/lib/studio-baseline-import";
import type { TargetBaselineSnapshot } from "@/lib/target-baseline-import";
import { buildDashboardData } from "@/lib/dashboardMetrics";
import { getCustomerTotalTarget } from "@/lib/customer-target-total";
import { validateArea, validateCustomer, validatePerson, validatePersonCompensation, validateStudioTargetAllocation, validateSubject, validateTargetAllocation } from "@/lib/validation";
import { buildAreaUsages } from "@/lib/area-usage";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isCustomerFarmerResponsibleProfile, isCustomerManagerProfile, isHunterRole, isSpecialistHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { normalizeBusinessName } from "@/lib/utils";
import { getEligibleStudioRenewalAmountForPerson, getTargetOwnAmount } from "@/lib/studio-renewal-rollup";

export class LocalDeliveryRepository implements DeliveryRepository {
  private data: DeliveryData = {
    people: structuredClone(people),
    personCompensations: [],
    customers: structuredClone(customers),
    customerTargets: structuredClone(customerTargets),
    subjects: structuredClone(subjects),
    areas: structuredClone(areas),
    areaUsages: buildAreaUsages(people),
    targetAllocations: structuredClone(targetAllocations),
    studioTargetAllocations: structuredClone(studioTargetAllocations),
    specialistHunterStudioAssignments: structuredClone(specialistHunterStudioAssignments),
    boardTargetBaselines: structuredClone(boardTargetBaselineRows),
    studioBaselineSnapshots: [],
    targetBaselineSnapshots: [],
  };
  private assignments: CoverageAssignment[] = buildAssignmentsFromCoverage(this.data.people, this.data.customers);

  async getAll() {
    const coverage = applyCoverageAssignments(this.data.people, this.data.customers, this.assignments);
    const areaUsages = buildAreaUsages(coverage.people);
    return structuredClone({
      ...this.data,
      people: coverage.people,
      customers: coverage.customers,
      areaUsages,
    });
  }

  async getDashboardSummary(filters: DashboardSummaryFilters): Promise<DashboardMetricResult> {
    const data = await this.getAll();
    const dashboard = buildDashboardData(
      data.people,
      data.customers,
      data.customerTargets,
      data.targetAllocations,
      data.studioTargetAllocations,
      data.boardTargetBaselines,
      data.areas,
      {
        includeNewLogos: filters.includeNewLogos,
        hunterScope: {
          enabled: filters.hunterScopeEnabled,
          person: null,
          customerIds: new Set(filters.hunterCustomerIds),
        },
        targetYear: filters.targetYear,
      },
    );
    return {
      summary: {
        totalTarget: dashboard.summary.totalTarget,
        boardTotalTarget: dashboard.summary.totalTarget,
        hunterTarget: dashboard.summary.hunterTarget,
        farmerRenewalTarget: dashboard.summary.farmerRenewalTarget,
        allocatedPeopleTotal: dashboard.summary.allocatedPeopleTotal,
        peopleDelta: dashboard.summary.peopleDelta,
        achievementPercentage: dashboard.summary.achievementPercentage,
        customerCount: dashboard.summary.customerCount,
        activePeopleCount: dashboard.summary.activePeopleCount,
        directorCount: dashboard.summary.directorCount,
        managerCount: dashboard.summary.managerCount,
      },
      financialByCustomer: dashboard.financialByCustomer,
    };
  }

  async getPerformanceByCustomer(filters: DashboardSummaryFilters): Promise<CustomerPerformanceResult> {
    const data = await this.getAll();
    const items = data.customers.map((customer) => {
      const customerTargets = data.customerTargets.filter((target) => target.customerId === customer.id);
      const targetAmount = customerTargets.reduce((sum, target) => sum + target.hunterTarget + target.farmerRenewalTarget, 0);
      const allocations = data.targetAllocations.filter((allocation) => allocation.customerId === customer.id);
      const hunterAllocated = allocations.filter((item) => item.type === "hunter").reduce((sum, item) => sum + item.amount, 0);
      const deliveryFarmerAllocated = allocations.filter((item) => item.type === "farmer_renewal").reduce((sum, item) => sum + item.amount, 0);
      const allocatedTotal = hunterAllocated + deliveryFarmerAllocated;
      const responsiblePeopleCount = new Set(
        data.people
          .filter((person) => person.clientIds?.includes(customer.id))
          .map((person) => person.id)
      ).size;
      return {
        customerId: customer.id,
        customerName: customer.name,
        targetAmount: roundCurrency(targetAmount),
        allocatedTotal: roundCurrency(allocatedTotal),
        hunterAllocated: roundCurrency(hunterAllocated),
        deliveryFarmerAllocated: roundCurrency(deliveryFarmerAllocated),
        responsiblePeopleCount,
        peopleDelta: roundCurrency(allocatedTotal - targetAmount),
        achievementPercentage: targetAmount > 0 ? roundCurrency((allocatedTotal / targetAmount) * 100) : 0,
      } satisfies CustomerPerformanceMetric;
    });
    return { items };
  }

  async findCustomerById(id: string) {
    const customer = this.data.customers.find((item) => item.id === id) ?? null;
    return customer ? structuredClone(customer) : null;
  }

  async findPersonById(id: string) {
    const person = this.data.people.find((item) => item.id === id) ?? null;
    return person ? structuredClone(person) : null;
  }

  async saveArea(area: Area) {
    area = validateArea(area);
    this.data.areas = upsert(this.data.areas, area)
      .sort((first, second) => first.name.localeCompare(second.name));
    return this.getAll();
  }

  async deleteArea(id: string) {
    this.data.areas = this.data.areas.filter((item) => item.id !== id);
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.filter((item) => item.areaId !== id);
    this.data.people = this.data.people.map((person) =>
      person.areaId === id ? { ...person, areaId: undefined } : person
    );
    return this.getAll();
  }

  async savePerson(person: Person) {
    person = validatePerson(person);
    this.assignments = [
      ...this.assignments.filter((assignment) => assignment.personId !== person.id),
      ...person.clientIds.map((customerId) => ({ personId: person.id, customerId })),
    ];
    this.data.people = upsert(this.data.people, person);
    return this.getAll();
  }

  async savePersonCompensation(compensation: PersonCompensation) {
    compensation = validatePersonCompensation(compensation);
    this.data.personCompensations = upsertByPersonId(this.data.personCompensations, {
      ...compensation,
      updatedAt: new Date().toISOString(),
    });
    return this.getAll();
  }

  async deletePersonCompensation(personId: string) {
    this.data.personCompensations = this.data.personCompensations.filter((item) => item.personId !== personId);
    return this.getAll();
  }

  async deletePerson(id: string) {
    this.data.people = this.data.people.filter((item) => item.id !== id);
    this.data.personCompensations = this.data.personCompensations.filter((item) => item.personId !== id);
    this.assignments = this.assignments.filter((assignment) => assignment.personId !== id);
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.personId !== id);
    this.data.specialistHunterStudioAssignments = this.data.specialistHunterStudioAssignments.filter((item) => item.personId !== id);
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.map((allocation) =>
      allocation.hunterPersonId === id || allocation.maintenancePersonId === id
        ? {
          ...allocation,
          hunterPersonId: allocation.hunterPersonId === id ? undefined : allocation.hunterPersonId,
          maintenancePersonId: allocation.maintenancePersonId === id ? undefined : allocation.maintenancePersonId,
        }
        : allocation
    );
  }

  async saveCustomer(customer: Customer, targetYear = 2026) {
    customer = validateCustomer(customer);
    customer = { ...customer, revenue: getCustomerTarget(customer) };
    ensureUniqueCustomerName(this.data.customers, customer);
    const managerIds = new Set(this.data.people
      .filter((person) => isCustomerFarmerResponsibleProfile(person.roleType, person.isManager))
      .map((person) => person.id));
    const nextManagerIds = new Set(customer.managerResponsibleIds);
    const removedManagerIds = new Set(Array.from(managerIds).filter((personId) => !nextManagerIds.has(personId)));

    if (removedManagerIds.size) {
      this.data.targetAllocations = this.data.targetAllocations.filter((allocation) =>
        allocation.customerId !== customer.id
        || allocation.type !== "farmer_renewal"
        || !removedManagerIds.has(allocation.personId)
      );
    }

    this.assignments = [
      ...this.assignments.filter((assignment) => assignment.customerId !== customer.id || !managerIds.has(assignment.personId)),
      ...customer.managerResponsibleIds.map((personId) => ({ personId, customerId: customer.id })),
    ];
    this.data.customers = upsert(this.data.customers, customer);
    this.upsertCustomerTarget(customer, targetYear);
    return this.getAll();
  }

  async saveCustomers(customers: Customer[], targetYear = 2026) {
    for (const customer of customers.map(validateCustomer)) {
      ensureUniqueCustomerName(this.data.customers, customer);
      const normalizedCustomer = { ...customer, revenue: getCustomerTarget(customer) };
      this.data.customers = upsert(this.data.customers, normalizedCustomer);
      this.upsertCustomerTarget(normalizedCustomer, targetYear);
    }
    return this.getAll();
  }

  private upsertCustomerTarget(customer: Customer, targetYear: number) {
    const existingTarget = this.data.customerTargets.find((item) => item.customerId === customer.id && item.year === targetYear);
    const nextTarget = {
      customerId: customer.id,
      year: targetYear,
      hunterTarget: customer.hunterTarget,
      farmerRenewalTarget: customer.farmerRenewalTarget,
      studioHunterTarget: customer.studioHunterTarget,
      studioTarget: customer.studioTarget,
      revenue: getCustomerTarget(customer),
      countsTowardTarget: customer.countsTowardTarget ?? existingTarget?.countsTowardTarget ?? true,
      targetExclusionReason: customer.countsTowardTarget === false
        ? customer.targetExclusionReason ?? existingTarget?.targetExclusionReason ?? "manual"
        : undefined,
    };
    this.data.customerTargets = this.data.customerTargets.some((item) => item.customerId === customer.id && item.year === targetYear)
      ? this.data.customerTargets.map((item) => item.customerId === customer.id && item.year === targetYear ? nextTarget : item)
      : [...this.data.customerTargets, nextTarget];
  }

  async deleteCustomer(id: string) {
    this.data.customers = this.data.customers.filter((item) => item.id !== id);
    this.data.subjects = this.data.subjects.filter((item) => item.customerId !== id);
    this.assignments = this.assignments.filter((assignment) => assignment.customerId !== id);
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.customerId !== id);
    const removedStudioAllocationIds = new Set(this.data.studioTargetAllocations
      .filter((item) => item.customerId === id)
      .map((item) => item.id));
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.filter((item) => item.customerId !== id);
    this.data.specialistHunterStudioAssignments = this.data.specialistHunterStudioAssignments.filter((item) => !removedStudioAllocationIds.has(item.studioTargetAllocationId));
  }

  async saveSubject(subject: Subject) {
    subject = validateSubject(subject);
    this.data.subjects = upsert(this.data.subjects, subject);
    return structuredClone(subject);
  }

  async deleteSubject(id: string) {
    this.data.subjects = this.data.subjects.filter((item) => item.id !== id);
  }

  async saveTargetAllocation(allocation: TargetAllocation) {
    allocation = validateTargetAllocation(allocation);
    ensureUniqueTargetAllocation(this.data.targetAllocations, allocation);
    this.data.targetAllocations = upsert(this.data.targetAllocations, allocation);
    return structuredClone(allocation);
  }

  async deleteTargetAllocation(id: string) {
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== id);
  }

  async saveStudioTargetAllocation(allocation: StudioTargetAllocation) {
    allocation = validateStudioTargetAllocation(allocation);
    const existingById = this.data.studioTargetAllocations.find((item) => item.id === allocation.id);
    const existingByGrain = this.data.studioTargetAllocations.find((item) =>
      item.customerId === allocation.customerId
      && item.areaId === allocation.areaId
      && (item.hunterPersonId ?? "") === (allocation.hunterPersonId ?? "")
      && (item.maintenancePersonId ?? "") === (allocation.maintenancePersonId ?? "")
      && item.year === allocation.year
    );
    const existing = existingById ?? existingByGrain;
    const nextAllocation = {
      ...allocation,
      id: existing?.id ?? allocation.id,
    };
    this.data.studioTargetAllocations = upsert(this.data.studioTargetAllocations, nextAllocation);
    this.syncStudioDerivedTargets(nextAllocation.customerId, nextAllocation.hunterPersonId, nextAllocation.maintenancePersonId, nextAllocation.year);
    if (existing?.hunterPersonId && existing.hunterPersonId !== nextAllocation.hunterPersonId) {
      this.syncStudioDerivedTargets(existing.customerId, existing.hunterPersonId, existing.maintenancePersonId, existing.year);
    }
    if (existing?.maintenancePersonId && existing.maintenancePersonId !== nextAllocation.maintenancePersonId) {
      this.syncStudioDerivedTargets(existing.customerId, existing.hunterPersonId, existing.maintenancePersonId, existing.year);
    }
    return structuredClone(nextAllocation);
  }

  async deleteStudioTargetAllocation(id: string) {
    const existing = this.data.studioTargetAllocations.find((item) => item.id === id);
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.filter((item) => item.id !== id);
    this.data.specialistHunterStudioAssignments = this.data.specialistHunterStudioAssignments.filter((item) => item.studioTargetAllocationId !== id);
    if (existing) {
      this.syncStudioDerivedTargets(existing.customerId, existing.hunterPersonId, existing.maintenancePersonId, existing.year);
    }
  }

  async saveSpecialistHunterStudioAssignments(input: SpecialistHunterStudioAssignmentsInput) {
    const person = this.data.people.find((item) => item.id === input.personId);
    if (!person || person.roleType !== "Hunter Especializado") {
      throw new Error("Selecione uma pessoa com perfil Hunter Especializado.");
    }

    const validAllocationIds = new Set(this.data.studioTargetAllocations
      .filter((allocation) =>
        allocation.customerId === input.customerId
        && allocation.year === input.year
        && (allocation.hunterAmount + allocation.maintenanceAmount) > 0
      )
      .map((allocation) => allocation.id));
    const selectedIds = Array.from(new Set(input.studioTargetAllocationIds)).filter((id) => validAllocationIds.has(id));

    this.data.specialistHunterStudioAssignments = this.data.specialistHunterStudioAssignments.filter((assignment) => {
      if (assignment.personId !== input.personId || assignment.year !== input.year) return true;
      const allocation = this.data.studioTargetAllocations.find((item) => item.id === assignment.studioTargetAllocationId);
      return allocation?.customerId !== input.customerId;
    });

    this.data.specialistHunterStudioAssignments = [
      ...this.data.specialistHunterStudioAssignments,
      ...selectedIds.map((studioTargetAllocationId) => ({
        id: `specialist-${input.personId}-${studioTargetAllocationId}`,
        personId: input.personId,
        studioTargetAllocationId,
        year: input.year,
        assignedAmount: input.assignedAmounts && Object.hasOwn(input.assignedAmounts, studioTargetAllocationId)
          ? Math.max(Number(input.assignedAmounts[studioTargetAllocationId]) || 0, 0)
          : undefined,
        notes: "Meta gerencial derivada de Studio para Hunter Especializado.",
      })),
    ];

    return this.getAll();
  }

  async saveStudioBaselineSnapshot(snapshot: Omit<StudioBaselineSnapshot, "id" | "createdAt">) {
    const saved = {
      ...snapshot,
      id: `studio-baseline-snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.studioBaselineSnapshots = [saved, ...this.data.studioBaselineSnapshots];
    return structuredClone(saved);
  }

  async saveTargetBaselineSnapshot(snapshot: Omit<TargetBaselineSnapshot, "id" | "createdAt">) {
    const saved = {
      ...snapshot,
      id: `target-baseline-snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.targetBaselineSnapshots = [saved, ...this.data.targetBaselineSnapshots];
    return structuredClone(saved);
  }

  async savePersonCustomerTargets(input: PersonCustomerTargetsInput) {
    const person = this.data.people.find((item) => item.id === input.personId);
    if (!person) throw new Error("Pessoa não encontrada para a meta.");
    const specialistAsCustomerHunter = input.allowSpecialistHunterAsCustomerHunter === true && isSpecialistHunterRole(person.roleType);
    if (!isTargetAssignableRole(person.roleType) && !specialistAsCustomerHunter) {
      throw new Error("Executivo, Diretor e Staff não recebem meta direta.");
    }

    const customer = this.data.customers.find((item) => item.id === input.customerId);
    if (!customer) throw new Error("Cliente não encontrado para a meta.");

    const studioHunterAmount = this.getStudioHunterAmount(input.customerId, input.personId, input.year);
    const nextHunterOwnAmount = sanitizeAmount(input.hunterOwnAmount ?? Math.max(input.hunterAmount - studioHunterAmount, 0));
    const nextHunterAmount = roundCurrency(nextHunterOwnAmount + studioHunterAmount);
    const studioRenewalAmount = this.getEligibleStudioRenewalAmount(input.customerId, input.personId, input.year);
    const nextFarmerRenewalOwnAmount = sanitizeAmount(input.farmerRenewalAmount);
    const nextFarmerRenewalAmount = roundCurrency(nextFarmerRenewalOwnAmount + studioRenewalAmount);
    const nextStudioAmount = 0;
    const otherHunterTotal = this.data.targetAllocations
      .filter((item) => item.customerId === input.customerId && item.year === input.year && item.personId !== input.personId && item.type === "hunter")
      .reduce((total, item) => total + item.amount, 0);
    const otherFarmerRenewalTotal = this.data.targetAllocations
      .filter((item) => item.customerId === input.customerId && item.year === input.year && item.personId !== input.personId && item.type === "farmer_renewal")
      .reduce((total, item) => total + item.amount, 0);
    const nextHunterTotal = otherHunterTotal + nextHunterAmount;
    const nextFarmerRenewalTotal = otherFarmerRenewalTotal + nextFarmerRenewalAmount;
    const nextHunterTarget = Math.max(customer.hunterTarget, nextHunterTotal);
    const nextFarmerRenewalTarget = Math.max(customer.farmerRenewalTarget, nextFarmerRenewalTotal);
    const nextStudioTarget = customer.studioTarget;
    const nextCustomerRevenue = getCustomerTotalTarget({
      hunterTarget: nextHunterTarget,
      farmerRenewalTarget: nextFarmerRenewalTarget,
    });
    const targetIncreaseRequired = nextHunterTotal > customer.hunterTarget + 0.01
      || nextFarmerRenewalTotal > customer.farmerRenewalTarget + 0.01;

    if (targetIncreaseRequired) {
      if (input.increaseCustomerTarget) {
        this.data.customers = this.data.customers.map((item) =>
          item.id === input.customerId
            ? {
              ...item,
              hunterTarget: nextHunterTarget,
              farmerRenewalTarget: nextFarmerRenewalTarget,
              studioHunterTarget: customer.studioHunterTarget,
              studioTarget: nextStudioTarget,
              revenue: nextCustomerRevenue,
            }
            : item
        );
        this.data.customerTargets = this.data.customerTargets.some((item) => item.customerId === input.customerId && item.year === input.year)
          ? this.data.customerTargets.map((item) => item.customerId === input.customerId && item.year === input.year
            ? {
              ...item,
              hunterTarget: nextHunterTarget,
              farmerRenewalTarget: nextFarmerRenewalTarget,
              studioHunterTarget: customer.studioHunterTarget,
              studioTarget: nextStudioTarget,
              revenue: nextCustomerRevenue,
            }
            : item)
          : [...this.data.customerTargets, {
            customerId: input.customerId,
            year: input.year,
            hunterTarget: nextHunterTarget,
            farmerRenewalTarget: nextFarmerRenewalTarget,
            studioHunterTarget: customer.studioHunterTarget,
            studioTarget: nextStudioTarget,
            revenue: nextCustomerRevenue,
            countsTowardTarget: customer.countsTowardTarget !== false,
            targetExclusionReason: customer.targetExclusionReason,
          }];
      }
    }

    this.replaceTargetAmount(input, "hunter", nextHunterAmount, nextHunterOwnAmount);
    this.replaceTargetAmount(input, "farmer_renewal", nextFarmerRenewalAmount, nextFarmerRenewalOwnAmount);
    this.replaceTargetAmount(input, "studio", nextStudioAmount);

    if (isHunterRole(person.roleType) || specialistAsCustomerHunter) {
      const hasAssignment = this.assignments.some((assignment) =>
        assignment.personId === input.personId && assignment.customerId === input.customerId
      );
      if (!hasAssignment) {
        this.assignments = [...this.assignments, { personId: input.personId, customerId: input.customerId }];
      }
    }

    if (person.isManager && isCustomerManagerProfile(person.roleType, person.isManager) && nextFarmerRenewalAmount > 0) {
      const hasAssignment = this.assignments.some((assignment) =>
        assignment.personId === input.personId && assignment.customerId === input.customerId
      );
      if (!hasAssignment) {
        this.assignments = [...this.assignments, { personId: input.personId, customerId: input.customerId }];
      }
    }

    return this.getAll();
  }

  async removePersonCustomerTargets(input: PersonCustomerRemovalInput) {
    this.assignments = this.assignments.filter((assignment) =>
      assignment.personId !== input.personId || assignment.customerId !== input.customerId
    );
    this.data.targetAllocations = this.data.targetAllocations.filter((allocation) =>
      allocation.personId !== input.personId || allocation.customerId !== input.customerId
    );
    return this.getAll();
  }

  private replaceTargetAmount(input: PersonCustomerTargetsInput, type: "hunter" | "farmer_renewal" | "studio", amount: number, ownAmount?: number) {
    const matchingAllocations = this.data.targetAllocations.filter((item) =>
      item.customerId === input.customerId
      && item.personId === input.personId
      && item.type === type
      && item.year === input.year
    );
    const existing = getCanonicalTargetAllocation(matchingAllocations);

    if (amount <= 0) {
      const matchingIds = new Set(matchingAllocations.map((item) => item.id));
      this.data.targetAllocations = this.data.targetAllocations.filter((item) => !matchingIds.has(item.id));
      return;
    }

    this.data.targetAllocations = upsert(this.data.targetAllocations, validateTargetAllocation({
      id: existing?.id ?? `target-${input.customerId}-${input.personId}-${type.replace("_", "-")}-${input.year}`,
      customerId: input.customerId,
      personId: input.personId,
      type,
      year: input.year,
      amount,
      ownAmount: type === "hunter" || type === "farmer_renewal" ? ownAmount ?? amount : undefined,
      notes: input.notes ?? "Meta associada pela tela Metas por Pessoa.",
    }));
  }

  private syncStudioDerivedTargets(customerId: string, hunterPersonId: string | undefined, maintenancePersonId: string | undefined, year: number) {
    this.syncHunterTargetTotal(customerId, hunterPersonId, year);
    this.syncFarmerRenewalTargetTotal(customerId, maintenancePersonId ?? hunterPersonId, year);
  }

  private syncHunterTargetTotal(customerId: string, hunterPersonId: string | undefined, year: number) {
    if (!hunterPersonId) return;
    const existing = this.data.targetAllocations.find((item) =>
      item.customerId === customerId
      && item.personId === hunterPersonId
      && item.type === "hunter"
      && item.year === year
    );
    const studioHunterAmount = this.getStudioHunterAmount(customerId, hunterPersonId, year);
    const ownAmount = roundCurrency(Math.max((existing?.amount ?? 0) - studioHunterAmount, 0));
    const totalAmount = roundCurrency(ownAmount + studioHunterAmount);

    if (totalAmount <= 0.01) {
      if (existing) {
        this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== existing.id);
      }
      return;
    }

    this.data.targetAllocations = upsert(this.data.targetAllocations, validateTargetAllocation({
      id: existing?.id ?? `target-${customerId}-${hunterPersonId}-hunter-${year}`,
      customerId,
      personId: hunterPersonId,
      type: "hunter",
      year,
      amount: totalAmount,
      ownAmount,
      notes: existing?.notes ?? "Meta Hunter total recalculada a partir da Meta Squads/Times e dos Studios.",
    }));
  }

  private getStudioHunterAmount(customerId: string, hunterPersonId: string, year: number) {
    return roundCurrency(this.data.studioTargetAllocations
      .filter((item) => item.customerId === customerId && item.hunterPersonId === hunterPersonId && item.year === year)
      .reduce((total, item) => total + item.hunterAmount, 0));
  }

  private syncFarmerRenewalTargetTotal(customerId: string, personId: string | undefined, year: number) {
    if (!personId) return;
    const existing = this.data.targetAllocations.find((item) =>
      item.customerId === customerId
      && item.personId === personId
      && item.type === "farmer_renewal"
      && item.year === year
    );
    const studioRenewalAmount = this.getEligibleStudioRenewalAmount(customerId, personId, year);
    const ownAmount = getTargetOwnAmount(existing, studioRenewalAmount);
    const totalAmount = roundCurrency(ownAmount + studioRenewalAmount);

    if (totalAmount <= 0.01) {
      if (existing) {
        this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== existing.id);
      }
      return;
    }

    this.data.targetAllocations = upsert(this.data.targetAllocations, validateTargetAllocation({
      id: existing?.id ?? `target-${customerId}-${personId}-farmer-renewal-${year}`,
      customerId,
      personId,
      type: "farmer_renewal",
      year,
      amount: totalAmount,
      ownAmount,
      notes: existing?.notes ?? "Meta Renovação total recalculada a partir da Meta Squads/Times e dos Studios elegíveis.",
    }));
  }

  private getEligibleStudioRenewalAmount(customerId: string, personId: string, year: number) {
    return getEligibleStudioRenewalAmountForPerson({
      allocations: this.data.studioTargetAllocations,
      areas: this.data.areas,
      people: this.data.people,
      customerId,
      personId,
      year,
    });
  }
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  const exists = items.some((current) => current.id === item.id);
  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

function upsertByPersonId<T extends { personId: string }>(items: T[], item: T) {
  const exists = items.some((current) => current.personId === item.personId);
  return exists
    ? items.map((current) => (current.personId === item.personId ? item : current))
    : [...items, item];
}

function ensureUniqueTargetAllocation(items: TargetAllocation[], allocation: TargetAllocation) {
  const duplicate = items.find((item) =>
    item.id !== allocation.id
    && item.customerId === allocation.customerId
    && item.personId === allocation.personId
    && item.type === allocation.type
    && item.year === allocation.year
  );

  if (duplicate) {
    throw new Error("Já existe uma meta para este cliente, pessoa, tipo e ano.");
  }
}

function getCanonicalTargetAllocation(allocations: TargetAllocation[]) {
  return [...allocations].sort((first, second) =>
    second.amount - first.amount
    || (second.ownAmount ?? 0) - (first.ownAmount ?? 0)
    || first.id.localeCompare(second.id, "pt-BR")
  )[0] ?? null;
}

function getCustomerTarget(customer: Customer) {
  return getCustomerTotalTarget(customer);
}

function ensureUniqueCustomerName(customers: Customer[], customer: Customer) {
  const normalized = normalizeBusinessName(customer.name);
  const duplicate = customers.find((item) => item.id !== customer.id && normalizeBusinessName(item.name) === normalized);
  if (duplicate) {
    throw new Error(`Já existe um cliente cadastrado com este nome: ${duplicate.name}.`);
  }
}

function sanitizeAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function createLocalDeliveryRepository() {
  return new LocalDeliveryRepository();
}

export const localDeliveryRepository = createLocalDeliveryRepository();
