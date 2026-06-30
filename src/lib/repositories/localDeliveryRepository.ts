import { areas, customers, people, subjects, targetAllocations } from "@/data/mockData";
import type { Customer, Person, Subject, TargetAllocation } from "@/data/mockData";
import type { DeliveryData, DeliveryRepository, PersonCustomerTargetsInput } from "./types";
import { validateCustomer, validatePerson, validateSubject, validateTargetAllocation } from "@/lib/validation";
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
    subjects: structuredClone(subjects),
    areas: structuredClone(areas),
    targetAllocations: structuredClone(targetAllocations),
  };
  private assignments: CoverageAssignment[] = buildAssignmentsFromCoverage(this.data.people, this.data.customers);

  async getAll() {
    const coverage = applyCoverageAssignments(this.data.people, this.data.customers, this.assignments);
    return structuredClone({
      ...this.data,
      people: coverage.people,
      customers: coverage.customers,
    });
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

  async saveCustomer(customer: Customer) {
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
    return this.getAll();
  }

  async deleteCustomer(id: string) {
    this.data.customers = this.data.customers.filter((item) => item.id !== id);
    this.data.subjects = this.data.subjects.filter((item) => item.customerId !== id);
    this.assignments = this.assignments.filter((assignment) => assignment.customerId !== id);
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.customerId !== id);
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
    const otherPeopleTotal = this.data.targetAllocations
      .filter((item) => item.customerId === input.customerId && item.year === input.year && item.personId !== input.personId)
      .reduce((total, item) => total + item.amount, 0);
    const nextCustomerTotal = otherPeopleTotal + nextHunterAmount + nextFarmerRenewalAmount;

    if (customer.revenue > 0 && nextCustomerTotal > customer.revenue + 0.01) {
      if (!input.increaseCustomerTarget) {
        throw new Error(`A soma das metas das pessoas ultrapassa a meta total do cliente (${customer.revenue}).`);
      }
      this.data.customers = this.data.customers.map((item) =>
        item.id === input.customerId ? { ...item, revenue: nextCustomerTotal } : item
      );
    }

    this.replaceTargetAmount(input, "hunter", nextHunterAmount);
    this.replaceTargetAmount(input, "farmer_renewal", nextFarmerRenewalAmount);
    return this.getAll();
  }

  private replaceTargetAmount(input: PersonCustomerTargetsInput, type: "hunter" | "farmer_renewal", amount: number) {
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
  const customerTarget = customer?.revenue ?? 0;
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
