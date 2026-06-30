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
import type { PersonCustomerTargetsInput } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateCustomer, validatePerson, validateSubject, validateTargetAllocation } from "@/lib/validation";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isCustomerManagerProfile, isHunterRole, isTargetAssignableRole } from "@/lib/roles";

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
    const savedWithRpc = await this.trySavePersonWithRpc(validated);
    if (!savedWithRpc) {
      await this.assertHunterAssignmentsAvailable(validated);
      const { error } = await this.client.from("people").upsert(toPersonRow(validated));
      if (error) throw error;
      await this.replacePersonAssignments(validated.id, validated.clientIds);
    }
    return this.fetchAll();
  }

  async deletePerson(id: string) {
    const { error } = await this.client.from("people").delete().eq("id", id);
    if (error) throw error;
  }

  async saveCustomer(customer: Customer) {
    const validated = validateCustomer(customer);
    const savedWithRpc = await this.trySaveCustomerWithRpc(validated);
    if (!savedWithRpc) {
      const { error } = await this.client.from("customers").upsert(toCustomerRow(validated));
      if (error) throw error;
      await this.replaceCustomerManagerAssignments(validated.id, validated.managerResponsibleIds);
    }
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

  async savePersonCustomerTargets(input: PersonCustomerTargetsInput) {
    const savedWithRpc = await this.trySavePersonCustomerTargetsWithRpc(input);
    if (!savedWithRpc) {
      await this.savePersonCustomerTargetsWithFallback(input);
    }
    return this.fetchAll();
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

  private async trySavePersonWithRpc(person: Person) {
    const { error } = await this.client.rpc("save_person_with_assignments", {
      p_id: person.id,
      p_name: person.name,
      p_email: person.email ?? null,
      p_job_title: person.jobTitle,
      p_director_id: person.directorId ?? null,
      p_manager_id: person.managerId ?? null,
      p_role_type: person.roleType,
      p_area_id: person.areaId ?? null,
      p_photo_url: person.photoUrl ?? null,
      p_notes: person.notes ?? null,
      p_active: person.active,
      p_is_manager: person.isManager,
      p_hierarchy_level: person.hierarchyLevel,
      p_customer_ids: person.clientIds,
    });

    if (!error) return true;
    if (isMissingRpcError(error)) return false;
    throw error;
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
    const currentManagerIds = (data as PersonRow[])
      .filter((row) => isCustomerManagerProfile(row.role_type as RoleType, row.is_manager))
      .map((row) => row.id);

    if (currentManagerIds.length) {
      const nextManagerIds = new Set(managerIds);
      const removedManagerIds = currentManagerIds.filter((personId) => !nextManagerIds.has(personId));

      if (removedManagerIds.length) {
        const { error: deleteTargetError } = await this.client
          .from("revenue_target_allocations")
          .delete()
          .eq("customer_id", customerId)
          .eq("target_type", "farmer_renewal")
          .in("person_id", removedManagerIds);
        if (deleteTargetError) throw deleteTargetError;
      }

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

  private async trySaveCustomerWithRpc(customer: Customer) {
    const { error } = await this.client.rpc("save_customer_with_managers", {
      p_id: customer.id,
      p_name: customer.name,
      p_industry: customer.industry,
      p_director_responsible_id: customer.directorResponsibleId,
      p_manager_responsible_ids: customer.managerResponsibleIds,
      p_revenue: customer.revenue,
      p_margin: customer.margin,
      p_strategic_account: customer.strategicAccount,
    });

    if (!error) return true;
    if (isMissingRpcError(error)) return false;
    throw error;
  }

  private async trySavePersonCustomerTargetsWithRpc(input: PersonCustomerTargetsInput) {
    const { error } = await this.client.rpc("save_person_customer_targets", {
      p_customer_id: input.customerId,
      p_person_id: input.personId,
      p_target_year: input.year,
      p_hunter_amount: sanitizeAmount(input.hunterAmount),
      p_farmer_renewal_amount: sanitizeAmount(input.farmerRenewalAmount),
      p_increase_customer_target: input.increaseCustomerTarget,
      p_notes: input.notes ?? "Meta associada pela tela Metas por Pessoa.",
    });

    if (!error) return true;
    if (isMissingRpcError(error)) return false;
    throw error;
  }

  private async savePersonCustomerTargetsWithFallback(input: PersonCustomerTargetsInput) {
    const [customerResult, allocationsResult, personResult] = await Promise.all([
      this.client.from("customers").select("*").eq("id", input.customerId).single(),
      this.client.from("revenue_target_allocations").select("*").eq("customer_id", input.customerId).eq("target_year", input.year),
      this.client.from("people").select("id, role_type").eq("id", input.personId).single(),
    ]);

    const error = customerResult.error ?? allocationsResult.error ?? personResult.error;
    if (error) throw error;

    const personRole = (personResult.data as { role_type: RoleType }).role_type;
    if (!isTargetAssignableRole(personRole)) {
      throw new Error("Executivo, Diretor e Staff não recebem meta direta.");
    }

    const customer = fromCustomerRow(customerResult.data as CustomerRow);
    const allocations = (allocationsResult.data as TargetAllocationRow[]).map(fromTargetAllocationRow);
    const nextHunterAmount = sanitizeAmount(input.hunterAmount);
    const nextFarmerRenewalAmount = sanitizeAmount(input.farmerRenewalAmount);
    const otherPeopleTotal = allocations
      .filter((allocation) => allocation.personId !== input.personId)
      .reduce((total, allocation) => total + allocation.amount, 0);
    const nextCustomerTotal = otherPeopleTotal + nextHunterAmount + nextFarmerRenewalAmount;

    if (customer.revenue > 0 && nextCustomerTotal > customer.revenue + 0.01) {
      if (!input.increaseCustomerTarget) {
        throw new Error(`A soma das metas das pessoas ultrapassa a meta total do cliente (${customer.revenue}).`);
      }
      const { error: customerError } = await this.client
        .from("customers")
        .update({ revenue: nextCustomerTotal })
        .eq("id", input.customerId);
      if (customerError) throw customerError;
    }

    await this.persistTypeTargetWithFallback(input, "hunter", nextHunterAmount, allocations);
    await this.persistTypeTargetWithFallback(input, "farmer_renewal", nextFarmerRenewalAmount, allocations);

    if (isCustomerManagerProfile(personRole, true) && nextFarmerRenewalAmount > 0) {
      const { error: assignmentError } = await this.client
        .from("person_customer_assignments")
        .upsert({
          person_id: input.personId,
          customer_id: input.customerId,
          source: "rpc_target_save",
        });
      if (assignmentError) throw assignmentError;
    }

    if (nextFarmerRenewalAmount <= 0) {
      const { error: assignmentDeleteError } = await this.client
        .from("person_customer_assignments")
        .delete()
        .eq("person_id", input.personId)
        .eq("customer_id", input.customerId)
        .eq("source", "rpc_target_save");
      if (assignmentDeleteError) throw assignmentDeleteError;
    }
  }

  private async persistTypeTargetWithFallback(
    input: PersonCustomerTargetsInput,
    type: TargetAllocationType,
    amount: number,
    allocations: TargetAllocation[],
  ) {
    const existing = allocations.find((allocation) =>
      allocation.customerId === input.customerId
      && allocation.personId === input.personId
      && allocation.type === type
      && allocation.year === input.year
    );

    if (amount <= 0) {
      if (existing) {
        const { error } = await this.client.from("revenue_target_allocations").delete().eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }

    const allocation = validateTargetAllocation({
      id: existing?.id ?? `target-${input.customerId}-${input.personId}-${type.replace("_", "-")}-${input.year}`,
      customerId: input.customerId,
      personId: input.personId,
      type,
      year: input.year,
      amount,
      notes: input.notes ?? "Meta associada pela tela Metas por Pessoa.",
    });

    const { error } = await this.client.from("revenue_target_allocations").upsert(toTargetAllocationRow(allocation));
    if (error) throw error;
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

function isMissingRpcError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST202"
    || error.code === "42883"
    || message.includes("could not find the function")
    || message.includes("function public.")
    || message.includes("does not exist");
}

function sanitizeAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
