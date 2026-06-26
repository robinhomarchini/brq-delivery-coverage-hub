import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Area,
  type Customer,
  type Person,
  type RoleType,
  type Subject,
  type SubjectStatus,
  type TargetAllocation,
  type TargetAllocationType,
} from "@/data/mockData";
import type { DeliveryData, DeliveryRepository } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateCustomer, validatePerson, validateSubject, validateTargetAllocation } from "@/lib/validation";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isHunterRole } from "@/lib/roles";

type AreaRow = {
  id: string;
  name: string;
  description: string;
};

type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  job_title: string;
  director_id: string | null;
  manager_id: string | null;
  role_type: string;
  area_id: string | null;
  territory_ids: string[];
  client_ids: string[];
  photo_url: string | null;
  notes: string | null;
  active: boolean;
  is_manager: boolean;
  hierarchy_level: number;
};

type CustomerRow = {
  id: string;
  name: string;
  industry: string;
  director_responsible_id: string;
  manager_responsible_id: string | null;
  manager_responsible_ids?: string[] | null;
  territory_id: string | null;
  revenue: number | string;
  margin: number | string;
  strategic_account: boolean;
};

type SubjectRow = {
  id: string;
  customer_id: string;
  name: string;
  description: string;
  owner_person_id: string | null;
  status: string;
  strategic: boolean;
};

type AssignmentRow = {
  person_id: string;
  customer_id: string;
};

type TargetAllocationRow = {
  id: string;
  customer_id: string;
  person_id: string;
  target_type: string;
  target_year: number;
  amount: number | string;
  notes: string | null;
};

export class SupabaseDeliveryRepository implements DeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<DeliveryData> {
    return this.fetchAll();
  }

  async savePerson(person: Person) {
    const validated = validatePerson(person);
    await this.assertHunterAssignmentsAvailable(validated);
    const { error } = await this.client.from("people").upsert(toPersonRow(validated));
    if (error) throw error;
    await this.replacePersonAssignments(validated.id, validated.clientIds);
    return this.fetchAll();
  }

  async deletePerson(id: string) {
    const { error } = await this.client.from("people").delete().eq("id", id);
    if (error) throw error;
  }

  async saveCustomer(customer: Customer) {
    const validated = validateCustomer(customer);
    const { error } = await this.client.from("customers").upsert(toCustomerRow(validated));
    if (error) throw error;
    await this.replaceCustomerManagerAssignments(validated.id, validated.managerResponsibleIds);
    return this.fetchAll();
  }

  async deleteCustomer(id: string) {
    const { error } = await this.client.from("customers").delete().eq("id", id);
    if (error) throw error;
  }

  async saveSubject(subject: Subject) {
    const validated = validateSubject(subject);
    const { error } = await this.client.from("subjects").upsert(toSubjectRow(validated));
    if (error) throw error;
    return subject;
  }

  async deleteSubject(id: string) {
    const { error } = await this.client.from("subjects").delete().eq("id", id);
    if (error) throw error;
  }

  async saveTargetAllocation(allocation: TargetAllocation) {
    const validated = validateTargetAllocation(allocation);
    const { error } = await this.client.from("revenue_target_allocations").upsert(toTargetAllocationRow(validated));
    if (error) throw error;
    return validated;
  }

  async deleteTargetAllocation(id: string) {
    const { error } = await this.client.from("revenue_target_allocations").delete().eq("id", id);
    if (error) throw error;
  }

  private async fetchAll(): Promise<DeliveryData> {
    const [areasResult, peopleResult, customersResult, subjectsResult, assignmentsResult, targetAllocationsResult] = await Promise.all([
      this.client.from("areas").select("*").order("name"),
      this.client.from("people").select("*").order("hierarchy_level").order("name"),
      this.client.from("customers").select("*").order("name"),
      this.client.from("subjects").select("*").order("name"),
      this.client.from("person_customer_assignments").select("person_id, customer_id"),
      this.client.from("revenue_target_allocations").select("*").order("target_year", { ascending: false }).order("customer_id"),
    ]);

    const error = areasResult.error ?? peopleResult.error ?? customersResult.error ?? subjectsResult.error;
    if (error) throw error;

    const people = (peopleResult.data as PersonRow[]).map(fromPersonRow);
    const customers = (customersResult.data as CustomerRow[]).map(fromCustomerRow);
    const assignments = assignmentsResult.error
      ? buildAssignmentsFromCoverage(people, customers)
      : (assignmentsResult.data as AssignmentRow[]).map(fromAssignmentRow);
    const coverage = applyCoverageAssignments(people, customers, assignments);

    return {
      areas: (areasResult.data as AreaRow[]).map(fromAreaRow),
      people: coverage.people,
      customers: coverage.customers,
      subjects: (subjectsResult.data as SubjectRow[]).map(fromSubjectRow),
      targetAllocations: targetAllocationsResult.error
        ? []
        : (targetAllocationsResult.data as TargetAllocationRow[]).map(fromTargetAllocationRow),
    };
  }

  private async replacePersonAssignments(personId: string, customerIds: string[]) {
    const { error: deleteError } = await this.client
      .from("person_customer_assignments")
      .delete()
      .eq("person_id", personId);
    if (deleteError) throw deleteError;

    if (!customerIds.length) return;

    const { error: insertError } = await this.client
      .from("person_customer_assignments")
      .insert(customerIds.map((customerId) => ({ person_id: personId, customer_id: customerId })));
    if (insertError) throw insertError;
  }

  private async assertHunterAssignmentsAvailable(person: Person) {
    if (!isHunterRole(person.roleType) || !person.clientIds.length) return;

    const { data, error } = await this.client
      .from("person_customer_assignments")
      .select("customer_id, people!inner(id, name, role_type)")
      .in("customer_id", person.clientIds)
      .neq("person_id", person.id)
      .in("people.role_type", ["Hunter", "Hunter + Farmer"]);

    if (error) throw error;
    if (!data?.length) return;

    const conflictingCustomers = new Set((data as unknown as { customer_id: string }[]).map((item) => item.customer_id));
    throw new Error(`Cliente(s) já associado(s) a outro Hunter: ${Array.from(conflictingCustomers).join(", ")}.`);
  }

  private async replaceCustomerManagerAssignments(customerId: string, managerIds: string[]) {
    const { data, error: peopleError } = await this.client.from("people").select("*").eq("is_manager", true);
    if (peopleError) throw peopleError;
    const currentManagerIds = (data as PersonRow[]).map((row) => row.id);

    if (currentManagerIds.length) {
      const { error: deleteError } = await this.client
        .from("person_customer_assignments")
        .delete()
        .eq("customer_id", customerId)
        .in("person_id", currentManagerIds);
      if (deleteError) throw deleteError;
    }

    if (!managerIds.length) return;

    const { error: insertError } = await this.client
      .from("person_customer_assignments")
      .insert(managerIds.map((personId) => ({ person_id: personId, customer_id: customerId })));
    if (insertError) throw insertError;
  }

}

export function createSupabaseDeliveryRepository() {
  const client = getSupabaseBrowserClient();
  return client ? new SupabaseDeliveryRepository(client) : null;
}

function fromAreaRow(row: AreaRow): Area {
  return row;
}

function toPersonRow(person: Person): PersonRow {
  return {
    id: person.id,
    name: person.name,
    email: person.email ?? null,
    job_title: person.jobTitle,
    director_id: person.directorId ?? null,
    manager_id: person.managerId ?? null,
    role_type: person.roleType,
    area_id: person.areaId ?? null,
    territory_ids: [],
    client_ids: [],
    photo_url: person.photoUrl ?? null,
    notes: person.notes ?? null,
    active: person.active,
    is_manager: person.isManager,
    hierarchy_level: person.hierarchyLevel,
  };
}

function fromPersonRow(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    jobTitle: row.job_title,
    directorId: row.director_id ?? undefined,
    managerId: row.manager_id ?? undefined,
    roleType: row.role_type as RoleType,
    areaId: row.area_id ?? undefined,
    clientIds: row.client_ids ?? [],
    photoUrl: row.photo_url ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
    isManager: row.is_manager,
    hierarchyLevel: row.hierarchy_level as 1 | 2 | 3,
  };
}

function toCustomerRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    industry: customer.industry,
    director_responsible_id: customer.directorResponsibleId,
    manager_responsible_id: null,
    manager_responsible_ids: [],
    territory_id: null,
    revenue: customer.revenue,
    margin: customer.margin,
    strategic_account: customer.strategicAccount,
  };
}

function fromCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    directorResponsibleId: row.director_responsible_id,
    managerResponsibleIds: row.manager_responsible_ids ?? (row.manager_responsible_id ? [row.manager_responsible_id] : []),
    revenue: Number(row.revenue),
    margin: Number(row.margin),
    strategicAccount: row.strategic_account,
  };
}

function fromAssignmentRow(row: AssignmentRow): CoverageAssignment {
  return {
    personId: row.person_id,
    customerId: row.customer_id,
  };
}

function toSubjectRow(subject: Subject): SubjectRow {
  return {
    id: subject.id,
    customer_id: subject.customerId,
    name: subject.name,
    description: subject.description,
    owner_person_id: subject.ownerPersonId ?? null,
    status: subject.status,
    strategic: subject.strategic,
  };
}

function fromSubjectRow(row: SubjectRow): Subject {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    description: row.description,
    ownerPersonId: row.owner_person_id ?? undefined,
    status: row.status as SubjectStatus,
    strategic: row.strategic,
  };
}

function toTargetAllocationRow(allocation: TargetAllocation): TargetAllocationRow {
  return {
    id: allocation.id,
    customer_id: allocation.customerId,
    person_id: allocation.personId,
    target_type: allocation.type,
    target_year: allocation.year,
    amount: allocation.amount,
    notes: allocation.notes ?? null,
  };
}

function fromTargetAllocationRow(row: TargetAllocationRow): TargetAllocation {
  return {
    id: row.id,
    customerId: row.customer_id,
    personId: row.person_id,
    type: row.target_type as TargetAllocationType,
    year: row.target_year,
    amount: Number(row.amount),
    notes: row.notes ?? undefined,
  };
}
