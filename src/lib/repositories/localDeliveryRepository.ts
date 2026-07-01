import { areas, customers, customerTargets, people, studioTargetAllocations, subjects, targetAllocations } from "@/data/mockData";
import type { Area, Customer, Person, StudioTargetAllocation, Subject, TargetAllocation } from "@/data/mockData";
import type { DeliveryData, DeliveryRepository, PersonCustomerRemovalInput, PersonCustomerTargetsInput } from "./types";
import { validateArea, validateCustomer, validatePerson, validateStudioTargetAllocation, validateSubject, validateTargetAllocation } from "@/lib/validation";
import { buildAreaUsages } from "@/lib/area-usage";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isCustomerManagerProfile, isHunterRole, isTargetAssignableRole } from "@/lib/roles";

export class LocalDeliveryRepository implements DeliveryRepository {
  private data: DeliveryData = {
    people: structuredClone(people),
    customers: structuredClone(customers),
    customerTargets: structuredClone(customerTargets),
    subjects: structuredClone(subjects),
    areas: structuredClone(areas),
    areaUsages: buildAreaUsages(people),
    targetAllocations: structuredClone(targetAllocations),
    studioTargetAllocations: structuredClone(studioTargetAllocations),
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
    ensureHunterAssignmentsAvailable(this.data.people, this.assignments, person);
    this.assignments = [
      ...this.assignments.filter((assignment) => assignment.personId !== person.id),
      ...person.clientIds.map((customerId) => ({ personId: person.id, customerId })),
    ];
    this.data.people = upsert(this.data.people, person);
    return this.getAll();
  }

  async deletePerson(id: string) {
    this.data.people = this.data.people.filter((item) => item.id !== id);
    this.assignments = this.assignments.filter((assignment) => assignment.personId !== id);
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.personId !== id);
  }

  async saveCustomer(customer: Customer, targetYear = 2026) {
    customer = validateCustomer(customer);
    const managerIds = new Set(this.data.people
      .filter((person) => isCustomerManagerProfile(person.roleType, person.isManager))
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
      this.data.customers = upsert(this.data.customers, customer);
      this.upsertCustomerTarget(customer, targetYear);
    }
    return this.getAll();
  }

  private upsertCustomerTarget(customer: Customer, targetYear: number) {
    const nextTarget = {
      customerId: customer.id,
      year: targetYear,
      hunterTarget: customer.hunterTarget,
      farmerRenewalTarget: customer.farmerRenewalTarget,
      studioHunterTarget: customer.studioHunterTarget,
      studioTarget: customer.studioTarget,
      revenue: getCustomerTarget(customer),
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
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.filter((item) => item.customerId !== id);
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
    ensureCustomerTargetNotExceeded(this.data.customers, this.data.targetAllocations, allocation);
    this.data.targetAllocations = upsert(this.data.targetAllocations, allocation);
    return structuredClone(allocation);
  }

  async deleteTargetAllocation(id: string) {
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== id);
  }

  async saveStudioTargetAllocation(allocation: StudioTargetAllocation) {
    allocation = validateStudioTargetAllocation(allocation);
    const existing = this.data.studioTargetAllocations.find((item) =>
      item.customerId === allocation.customerId
      && item.areaId === allocation.areaId
      && item.year === allocation.year
    );
    const nextAllocation = {
      ...allocation,
      id: existing?.id ?? allocation.id,
    };
    this.data.studioTargetAllocations = upsert(this.data.studioTargetAllocations, nextAllocation);
    return structuredClone(nextAllocation);
  }

  async deleteStudioTargetAllocation(id: string) {
    this.data.studioTargetAllocations = this.data.studioTargetAllocations.filter((item) => item.id !== id);
  }

  async savePersonCustomerTargets(input: PersonCustomerTargetsInput) {
    const person = this.data.people.find((item) => item.id === input.personId);
    if (!person) throw new Error("Pessoa não encontrada para a meta.");
    if (!isTargetAssignableRole(person.roleType)) {
      throw new Error("Executivo, Diretor e Staff não recebem meta direta.");
    }

    const customer = this.data.customers.find((item) => item.id === input.customerId);
    if (!customer) throw new Error("Cliente não encontrado para a meta.");

    const nextHunterAmount = sanitizeAmount(input.hunterAmount);
    const nextFarmerRenewalAmount = sanitizeAmount(input.farmerRenewalAmount);
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
              revenue: nextHunterTarget + nextFarmerRenewalTarget + nextStudioTarget,
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
              revenue: nextHunterTarget + nextFarmerRenewalTarget + nextStudioTarget,
            }
            : item)
          : [...this.data.customerTargets, {
            customerId: input.customerId,
            year: input.year,
            hunterTarget: nextHunterTarget,
            farmerRenewalTarget: nextFarmerRenewalTarget,
            studioHunterTarget: customer.studioHunterTarget,
            studioTarget: nextStudioTarget,
            revenue: nextHunterTarget + nextFarmerRenewalTarget + nextStudioTarget,
          }];
      }
    }

    this.replaceTargetAmount(input, "hunter", nextHunterAmount);
    this.replaceTargetAmount(input, "farmer_renewal", nextFarmerRenewalAmount);
    this.replaceTargetAmount(input, "studio", nextStudioAmount);

    if (isHunterRole(person.roleType)) {
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

  private replaceTargetAmount(input: PersonCustomerTargetsInput, type: "hunter" | "farmer_renewal" | "studio", amount: number) {
    const existing = this.data.targetAllocations.find((item) =>
      item.customerId === input.customerId
      && item.personId === input.personId
      && item.type === type
      && item.year === input.year
    );

    if (amount <= 0) {
      if (existing) {
        this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== existing.id);
      }
      return;
    }

    this.data.targetAllocations = upsert(this.data.targetAllocations, validateTargetAllocation({
      id: existing?.id ?? `target-${input.customerId}-${input.personId}-${type.replace("_", "-")}-${input.year}`,
      customerId: input.customerId,
      personId: input.personId,
      type,
      year: input.year,
      amount,
      notes: input.notes ?? "Meta associada pela tela Metas por Pessoa.",
    }));
  }
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  const exists = items.some((current) => current.id === item.id);
  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
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

function ensureCustomerTargetNotExceeded(customers: Customer[], items: TargetAllocation[], allocation: TargetAllocation) {
  const customer = customers.find((item) => item.id === allocation.customerId);
  const customerTarget = customer ? getCustomerTarget(customer) : 0;
  const allocated = items
    .filter((item) =>
      item.id !== allocation.id
      && item.customerId === allocation.customerId
      && item.year === allocation.year
    )
    .reduce((total, item) => total + item.amount, 0) + allocation.amount;

  if (customerTarget > 0 && allocated > customerTarget + 0.01) {
    throw new Error(`A soma das metas das pessoas ultrapassa a meta total do cliente (${customerTarget}).`);
  }
}

function getCustomerTarget(customer: Customer) {
  return customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget;
}

function ensureHunterAssignmentsAvailable(people: Person[], assignments: CoverageAssignment[], person: Person) {
  if (!isHunterRole(person.roleType) || !person.clientIds.length) return;
  const hunterIds = new Set(people
    .filter((item) => item.id !== person.id && isHunterRole(item.roleType))
    .map((item) => item.id));
  const conflicts = assignments.filter((assignment) =>
    hunterIds.has(assignment.personId) && person.clientIds.includes(assignment.customerId)
  );

  if (conflicts.length) {
    throw new Error(`Cliente(s) já associado(s) a outro Hunter: ${Array.from(new Set(conflicts.map((item) => item.customerId))).join(", ")}.`);
  }
}

function sanitizeAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export const localDeliveryRepository = new LocalDeliveryRepository();
