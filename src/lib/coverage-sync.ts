import type { Customer, Person } from "@/data/mockData";

export type CoverageAssignment = {
  personId: string;
  customerId: string;
};

export function buildAssignmentsFromCoverage(people: Person[], customers: Customer[]) {
  const assignments = new Map<string, CoverageAssignment>();

  for (const person of people) {
    for (const customerId of person.clientIds) {
      assignments.set(`${person.id}:${customerId}`, { personId: person.id, customerId });
    }
  }

  for (const customer of customers) {
    for (const managerId of customer.managerResponsibleIds) {
      assignments.set(`${managerId}:${customer.id}`, { personId: managerId, customerId: customer.id });
    }
  }

  return Array.from(assignments.values());
}

export function applyCoverageAssignments(
  people: Person[],
  customers: Customer[],
  assignments: CoverageAssignment[],
) {
  const customerIdsByPerson = new Map<string, string[]>();
  const managerIdsByCustomer = new Map<string, string[]>();
  const managerIds = new Set(people.filter((person) => person.isManager).map((person) => person.id));

  for (const assignment of assignments) {
    customerIdsByPerson.set(assignment.personId, [
      ...(customerIdsByPerson.get(assignment.personId) ?? []),
      assignment.customerId,
    ]);

    if (managerIds.has(assignment.personId)) {
      managerIdsByCustomer.set(assignment.customerId, [
        ...(managerIdsByCustomer.get(assignment.customerId) ?? []),
        assignment.personId,
      ]);
    }
  }

  return {
    people: people.map((person) => ({ ...person, clientIds: unique(customerIdsByPerson.get(person.id) ?? []) })),
    customers: customers.map((customer) => ({
      ...customer,
      managerResponsibleIds: unique(managerIdsByCustomer.get(customer.id) ?? []),
    })),
  };
}

export function syncCustomersForPerson(customers: Customer[], person: Person) {
  if (!person.isManager) return customers;
  const selectedCustomerIds = new Set(person.clientIds);

  return customers.map((customer) => {
    const managerIds = customer.managerResponsibleIds.includes(person.id)
      ? customer.managerResponsibleIds
      : [...customer.managerResponsibleIds, person.id];
    const nextManagerIds = selectedCustomerIds.has(customer.id)
      ? managerIds
      : managerIds.filter((managerId) => managerId !== person.id);

    return areArraysEqual(customer.managerResponsibleIds, nextManagerIds)
      ? customer
      : { ...customer, managerResponsibleIds: nextManagerIds };
  });
}

export function syncPeopleFromCustomers(people: Person[], customers: Customer[]) {
  const customerIdsByManager = new Map<string, string[]>();

  for (const customer of customers) {
    for (const managerId of customer.managerResponsibleIds) {
      const currentIds = customerIdsByManager.get(managerId) ?? [];
      customerIdsByManager.set(managerId, [...currentIds, customer.id]);
    }
  }

  return people.map((person) => {
    if (!person.isManager) return person;
    const nextClientIds = customerIdsByManager.get(person.id) ?? [];
    return areArraysEqual(person.clientIds, nextClientIds)
      ? person
      : { ...person, clientIds: nextClientIds };
  });
}

export function areArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
