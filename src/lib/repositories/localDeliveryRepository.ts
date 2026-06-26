import { areas, customers, people, subjects, targetAllocations } from "@/data/mockData";
import type { Customer, Person, Subject, TargetAllocation } from "@/data/mockData";
import type { DeliveryData, DeliveryRepository } from "./types";
import { validateCustomer, validatePerson, validateSubject, validateTargetAllocation } from "@/lib/validation";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isHunterRole } from "@/lib/roles";

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
    const managerIds = new Set(this.data.people.filter((person) => person.isManager).map((person) => person.id));
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
    this.data.targetAllocations = upsert(this.data.targetAllocations, allocation);
    return structuredClone(allocation);
  }

  async deleteTargetAllocation(id: string) {
    this.data.targetAllocations = this.data.targetAllocations.filter((item) => item.id !== id);
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

export const localDeliveryRepository = new LocalDeliveryRepository();
