import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Area,
  type Customer,
  type CustomerTarget,
  type Person,
  type RoleType,
  type StudioTargetAllocation,
  type Subject,
  type SubjectStatus,
  type TargetAllocation,
  type TargetAllocationType,
} from "@/data/mockData";
import type { DeliveryData, DeliveryRepository } from "./types";
import type { PersonCustomerRemovalInput, PersonCustomerTargetsInput } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildAreaUsages } from "@/lib/area-usage";
import { getFinancialCustomerMetric } from "@/lib/financial-customers";
import { validateArea, validateCustomer, validatePerson, validateStudioTargetAllocation, validateSubject, validateTargetAllocation } from "@/lib/validation";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isCustomerManagerProfile, isHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { normalizeBusinessName } from "@/lib/utils";

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
  hunter_target?: number | string | null;
  farmer_renewal_target?: number | string | null;
  studio_hunter_target?: number | string | null;
  studio_target?: number | string | null;
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

type CustomerTargetRow = {
  customer_id: string;
  target_year: number;
  hunter_target: number | string;
  farmer_renewal_target: number | string;
  studio_hunter_target?: number | string | null;
  studio_target?: number | string | null;
  revenue: number | string;
};

type StudioTargetAllocationRow = {
  id: string;
  customer_id: string;
  area_id: string;
  target_year: number;
  amount?: number | string | null;
  hunter_amount?: number | string | null;
  maintenance_amount?: number | string | null;
  notes: string | null;
};

type TerritoryAreaRow = {
  id: string;
  area_id: string | null;
};

export class SupabaseDeliveryRepository implements DeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<DeliveryData> {
    return this.fetchAll();
  }

  async saveArea(area: Area) {
    const validated = validateArea(area);
    const { error } = await this.client.from("areas").upsert(toAreaRow(validated));
    if (error) throw error;
    return this.fetchAll();
  }

  async deleteArea(id: string) {
    const { error: studioTargetError } = await this.client
      .from("studio_target_allocations")
      .delete()
      .eq("area_id", id);
    if (studioTargetError && !isMissingTableError(studioTargetError)) throw studioTargetError;

    const { error: territoryError } = await this.client
      .from("territories")
      .update({ area_id: null })
      .eq("area_id", id);
    if (territoryError && !isMissingTableError(territoryError)) throw territoryError;

    const { error } = await this.client.from("areas").delete().eq("id", id);
    if (error) throw error;
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

  async saveCustomer(customer: Customer, targetYear = 2026) {
    const validated = validateCustomer(customer);
    await this.assertUniqueCustomerName(validated);
    const { error } = await this.client.from("customers").upsert(toCustomerRow(validated));
    if (error) throw error;
    await this.upsertCustomerTarget(validated, targetYear);
    await this.replaceCustomerManagerAssignments(validated.id, validated.managerResponsibleIds);
    return this.fetchAll();
  }

  async saveCustomers(customers: Customer[], targetYear = 2026) {
    const validated = customers.map(validateCustomer);
    await Promise.all(validated.map((customer) => this.updateCustomerTargets(customer, targetYear)));
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

  async saveStudioTargetAllocation(allocation: StudioTargetAllocation) {
    const validated = validateStudioTargetAllocation(allocation);
    const row = toStudioTargetAllocationRow(validated);
    const { data: existing, error: lookupError } = await this.client
      .from("studio_target_allocations")
      .select("id")
      .eq("customer_id", validated.customerId)
      .eq("area_id", validated.areaId)
      .eq("target_year", validated.year)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.id) row.id = existing.id;

    const { error } = await this.client.from("studio_target_allocations").upsert(row);
    if (error) throw error;
    return { ...validated, id: row.id };
  }

  async deleteStudioTargetAllocation(id: string) {
    const { error } = await this.client.from("studio_target_allocations").delete().eq("id", id);
    if (error) throw error;
  }

  async savePersonCustomerTargets(input: PersonCustomerTargetsInput) {
    const savedWithRpc = await this.trySavePersonCustomerTargetsWithRpc(input);
    if (!savedWithRpc) {
      await this.savePersonCustomerTargetsWithFallback(input);
    }
    return this.fetchAll();
  }

  async removePersonCustomerTargets(input: PersonCustomerRemovalInput) {
    const removedWithRpc = await this.tryRemovePersonCustomerTargetsWithRpc(input);
    if (!removedWithRpc) {
      await this.removePersonCustomerTargetsWithFallback(input);
    }
    return this.fetchAll();
  }

  private async fetchAll(): Promise<DeliveryData> {
    const [areasResult, peopleResult, customersResult, customerTargetsResult, subjectsResult, assignmentsResult, targetAllocationsResult, studioTargetAllocationsResult, territoriesResult] = await Promise.all([
      this.client.from("areas").select("*").order("name"),
      this.client.from("people").select("*").order("hierarchy_level").order("name"),
      this.client.from("customers").select("*").order("name"),
      this.client.from("customer_target_years").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("subjects").select("*").order("name"),
      this.client.from("person_customer_assignments").select("person_id, customer_id"),
      this.client.from("revenue_target_allocations").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("studio_target_allocations").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("territories").select("id, area_id"),
    ]);

    const error = areasResult.error ?? peopleResult.error ?? customersResult.error ?? subjectsResult.error;
    if (error) throw error;

    const people = (peopleResult.data as PersonRow[]).map(fromPersonRow);
    const customerTargets = customerTargetsResult.error
      ? (customersResult.data as CustomerRow[]).map(fromLegacyCustomerTargetRow)
      : (customerTargetsResult.data as CustomerTargetRow[]).map(fromCustomerTargetRow);
    const customers = applyCustomerTargetsForYear((customersResult.data as CustomerRow[]).map(fromCustomerRow), customerTargets, 2026);
    const assignments = assignmentsResult.error
      ? buildAssignmentsFromCoverage(people, customers)
      : (assignmentsResult.data as AssignmentRow[]).map(fromAssignmentRow);
    const coverage = applyCoverageAssignments(people, customers, assignments);
    const territoryRefs = territoriesResult.error
      ? []
      : (territoriesResult.data as TerritoryAreaRow[]).map((row) => ({ areaId: row.area_id }));

    return {
      areas: (areasResult.data as AreaRow[]).map(fromAreaRow),
      people: coverage.people,
      customers: coverage.customers,
      customerTargets,
      subjects: (subjectsResult.data as SubjectRow[]).map(fromSubjectRow),
      areaUsages: buildAreaUsages(coverage.people, territoryRefs),
      targetAllocations: targetAllocationsResult.error
        ? []
        : (targetAllocationsResult.data as TargetAllocationRow[]).map(fromTargetAllocationRow),
      studioTargetAllocations: studioTargetAllocationsResult.error
        ? []
        : (studioTargetAllocationsResult.data as StudioTargetAllocationRow[]).map(fromStudioTargetAllocationRow),
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

  private async updateCustomerTargets(customer: Customer, targetYear: number) {
    await this.upsertCustomerTarget(customer, targetYear);
  }

  private async upsertCustomerTarget(customer: Customer, targetYear: number) {
    const nextRevenue = getCustomerTarget(customer);
    const { error } = await this.client
      .from("customer_target_years")
      .upsert({
        customer_id: customer.id,
        target_year: targetYear,
        hunter_target: customer.hunterTarget,
        farmer_renewal_target: customer.farmerRenewalTarget,
        studio_hunter_target: customer.studioHunterTarget,
        studio_target: customer.studioTarget,
      });
    if (error) throw error;

    const { error: legacyError } = await this.client
      .from("customers")
      .update({
        hunter_target: customer.hunterTarget,
        farmer_renewal_target: customer.farmerRenewalTarget,
        studio_hunter_target: customer.studioHunterTarget,
        studio_target: customer.studioTarget,
        revenue: nextRevenue,
      })
      .eq("id", customer.id);
    if (legacyError) throw legacyError;
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
      .select("customer_id, people!inner(id, name, role_type, active)")
      .in("customer_id", person.clientIds)
      .neq("person_id", person.id)
      .eq("people.active", true)
      .in("people.role_type", ["Hunter", "Hunter + Farmer"]);

    if (error) throw error;
    if (!data?.length) return;

    const conflictingCustomers = new Set((data as unknown as { customer_id: string }[]).map((item) => item.customer_id));
    throw new Error(`Cliente(s) já associado(s) a outro Hunter: ${Array.from(conflictingCustomers).join(", ")}.`);
  }

  private async assertUniqueCustomerName(customer: Customer) {
    const { data, error } = await this.client.from("customers").select("id, name");
    if (error) throw error;
    const normalized = normalizeBusinessName(customer.name);
    const duplicate = (data as Pick<CustomerRow, "id" | "name">[] | null)?.find((item) =>
      item.id !== customer.id && normalizeBusinessName(item.name) === normalized
    );
    if (duplicate) {
      throw new Error(`Já existe um cliente cadastrado com este nome: ${duplicate.name}.`);
    }
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
    void input;
    return false;
  }

  private async tryRemovePersonCustomerTargetsWithRpc(input: PersonCustomerRemovalInput) {
    const { error } = await this.client.rpc("remove_person_customer_targets", {
      p_customer_id: input.customerId,
      p_person_id: input.personId,
    });

    if (!error) return true;
    if (isMissingRpcError(error)) return false;
    throw error;
  }

  private async removePersonCustomerTargetsWithFallback(input: PersonCustomerRemovalInput) {
    const { error: targetError } = await this.client
      .from("revenue_target_allocations")
      .delete()
      .eq("customer_id", input.customerId)
      .eq("person_id", input.personId);
    if (targetError) throw targetError;

    const { error: assignmentError } = await this.client
      .from("person_customer_assignments")
      .delete()
      .eq("customer_id", input.customerId)
      .eq("person_id", input.personId);
    if (assignmentError) throw assignmentError;
  }

  private async savePersonCustomerTargetsWithFallback(input: PersonCustomerTargetsInput) {
    const [customerResult, customerTargetResult, allocationsResult, personResult] = await Promise.all([
      this.client.from("customers").select("*").eq("id", input.customerId).single(),
      this.client.from("customer_target_years").select("*").eq("customer_id", input.customerId).eq("target_year", input.year).maybeSingle(),
      this.client.from("revenue_target_allocations").select("*").eq("customer_id", input.customerId).eq("target_year", input.year),
      this.client.from("people").select("id, role_type").eq("id", input.personId).single(),
    ]);

    const error = customerResult.error ?? allocationsResult.error ?? personResult.error;
    if (error) throw error;

    const personRole = (personResult.data as { role_type: RoleType }).role_type;
    if (!isTargetAssignableRole(personRole)) {
      throw new Error("Executivo, Diretor e Staff não recebem meta direta.");
    }

    const legacyCustomer = fromCustomerRow(customerResult.data as CustomerRow);
    const customerTarget = customerTargetResult.data
      ? fromCustomerTargetRow(customerTargetResult.data as CustomerTargetRow)
      : fromLegacyCustomerTargetRow(customerResult.data as CustomerRow);
    const customer = {
      ...legacyCustomer,
      hunterTarget: customerTarget.hunterTarget,
      farmerRenewalTarget: customerTarget.farmerRenewalTarget,
      studioHunterTarget: customerTarget.studioHunterTarget,
      studioTarget: customerTarget.studioTarget,
      revenue: customerTarget.revenue,
    };
    const allocations = (allocationsResult.data as TargetAllocationRow[]).map(fromTargetAllocationRow);
    const nextHunterAmount = sanitizeAmount(input.hunterAmount);
    const nextFarmerRenewalAmount = sanitizeAmount(input.farmerRenewalAmount);
    const nextStudioAmount = 0;
    const otherHunterTotal = allocations
      .filter((allocation) => allocation.personId !== input.personId && allocation.type === "hunter")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const otherFarmerRenewalTotal = allocations
      .filter((allocation) => allocation.personId !== input.personId && allocation.type === "farmer_renewal")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const nextHunterTotal = otherHunterTotal + nextHunterAmount;
    const nextFarmerRenewalTotal = otherFarmerRenewalTotal + nextFarmerRenewalAmount;
    const nextHunterTarget = Math.max(customer.hunterTarget, nextHunterTotal);
    const nextFarmerRenewalTarget = Math.max(customer.farmerRenewalTarget, nextFarmerRenewalTotal);
    const nextStudioTarget = customer.studioTarget;
    const targetIncreaseRequired = nextHunterTotal > customer.hunterTarget + 0.01
      || nextFarmerRenewalTotal > customer.farmerRenewalTarget + 0.01;

    if (targetIncreaseRequired) {
      if (input.increaseCustomerTarget) {
        await this.upsertCustomerTarget({
          ...customer,
          hunterTarget: nextHunterTarget,
          farmerRenewalTarget: nextFarmerRenewalTarget,
          studioHunterTarget: customer.studioHunterTarget,
          studioTarget: nextStudioTarget,
          revenue: nextHunterTarget + nextFarmerRenewalTarget + nextStudioTarget,
        }, input.year);
      }
    }

    await this.persistTypeTargetWithFallback(input, "hunter", nextHunterAmount, allocations);
    await this.persistTypeTargetWithFallback(input, "farmer_renewal", nextFarmerRenewalAmount, allocations);
    await this.persistTypeTargetWithFallback(input, "studio", nextStudioAmount, allocations);

    if (isHunterRole(personRole)) {
      const { error: assignmentError } = await this.client
        .from("person_customer_assignments")
        .upsert({
          person_id: input.personId,
          customer_id: input.customerId,
          source: "rpc_target_save",
        });
      if (assignmentError) throw assignmentError;
    }

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

    if (!isHunterRole(personRole) && nextFarmerRenewalAmount <= 0) {
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

function toAreaRow(area: Area): AreaRow {
  return area;
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
    lifecycleStatus: row.active ? "active" : "inactive",
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
    manager_responsible_id: customer.managerResponsibleIds[0] ?? null,
    manager_responsible_ids: customer.managerResponsibleIds,
      territory_id: null,
      hunter_target: customer.hunterTarget,
      farmer_renewal_target: customer.farmerRenewalTarget,
      studio_hunter_target: customer.studioHunterTarget,
      studio_target: customer.studioTarget,
    revenue: customer.revenue,
    margin: customer.margin,
    strategic_account: customer.strategicAccount,
  };
}

function fromCustomerRow(row: CustomerRow): Customer {
  const revenue = Number(row.revenue);
  const targetDefaults = getCustomerTargetDefaults(row.name, revenue);
  const hunterTarget = row.hunter_target == null ? targetDefaults.hunter : Number(row.hunter_target);
  const farmerRenewalTarget = row.farmer_renewal_target == null ? targetDefaults.farmerRenewal : Number(row.farmer_renewal_target);
  const studioHunterTarget = row.studio_hunter_target == null ? targetDefaults.studioHunter : Number(row.studio_hunter_target);
  const studioTarget = row.studio_target == null ? targetDefaults.studio : Number(row.studio_target);

  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    directorResponsibleId: row.director_responsible_id,
    managerResponsibleIds: row.manager_responsible_ids ?? (row.manager_responsible_id ? [row.manager_responsible_id] : []),
    hunterTarget,
    farmerRenewalTarget,
    studioHunterTarget,
    studioTarget,
    revenue: roundCurrency(hunterTarget + farmerRenewalTarget + studioTarget),
    margin: Number(row.margin),
    strategicAccount: row.strategic_account,
    lifecycleStatus: "active",
  };
}

function fromCustomerTargetRow(row: CustomerTargetRow): CustomerTarget {
  const hunterTarget = Number(row.hunter_target);
  const farmerRenewalTarget = Number(row.farmer_renewal_target);
  const studioHunterTarget = Number(row.studio_hunter_target ?? 0);
  const studioTarget = Number(row.studio_target ?? 0);
  return {
    customerId: row.customer_id,
    year: row.target_year,
    hunterTarget,
    farmerRenewalTarget,
    studioHunterTarget,
    studioTarget,
    revenue: Number(row.revenue) || roundCurrency(hunterTarget + farmerRenewalTarget + studioTarget),
  };
}

function fromLegacyCustomerTargetRow(row: CustomerRow): CustomerTarget {
  const customer = fromCustomerRow(row);
  return {
    customerId: customer.id,
    year: 2026,
    hunterTarget: customer.hunterTarget,
    farmerRenewalTarget: customer.farmerRenewalTarget,
    studioHunterTarget: customer.studioHunterTarget,
    studioTarget: customer.studioTarget,
    revenue: customer.revenue,
  };
}

function applyCustomerTargetsForYear(customers: Customer[], targets: CustomerTarget[], year: number) {
  const targetsByCustomer = new Map(targets
    .filter((target) => target.year === year)
    .map((target) => [target.customerId, target]));
  return customers.map((customer) => {
    const target = targetsByCustomer.get(customer.id);
    if (!target) return customer;
    return {
      ...customer,
      hunterTarget: target.hunterTarget,
      farmerRenewalTarget: target.farmerRenewalTarget,
      studioHunterTarget: target.studioHunterTarget,
      studioTarget: target.studioTarget,
      revenue: target.revenue,
    };
  });
}

function getCustomerTargetDefaults(name: string, revenue: number) {
  const importedHunter = getFinancialCustomerMetric(name, "hunterRevenue");
  const importedFarmerRenewal = getFinancialCustomerMetric(name, "deliveryFarmerRevenue");
  const importedTotal = importedHunter + importedFarmerRenewal;
  if (revenue <= 0) return { hunter: 0, farmerRenewal: 0, studioHunter: 0, studio: 0 };
  if (importedTotal <= 0) return { hunter: 0, farmerRenewal: revenue, studioHunter: 0, studio: 0 };
  const hunter = roundCurrency(revenue * (importedHunter / importedTotal));
  return { hunter, farmerRenewal: roundCurrency(revenue - hunter), studioHunter: 0, studio: 0 };
}

function getCustomerTarget(customer: Customer) {
  return roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isMissingTableError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "42P01";
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

function toStudioTargetAllocationRow(allocation: StudioTargetAllocation): StudioTargetAllocationRow {
  return {
    id: allocation.id,
    customer_id: allocation.customerId,
    area_id: allocation.areaId,
    target_year: allocation.year,
    amount: allocation.maintenanceAmount,
    hunter_amount: allocation.hunterAmount,
    maintenance_amount: allocation.maintenanceAmount,
    notes: allocation.notes ?? null,
  };
}

function fromStudioTargetAllocationRow(row: StudioTargetAllocationRow): StudioTargetAllocation {
  const hunterAmount = Number(row.hunter_amount ?? 0);
  const maintenanceAmount = Number(row.maintenance_amount ?? 0);
  const legacyAmount = Number(row.amount ?? 0);
  const legacyAmountIsUnsplitHunter = hunterAmount <= 0 && maintenanceAmount <= 0 && legacyAmount > 0;

  return {
    id: row.id,
    customerId: row.customer_id,
    areaId: row.area_id,
    year: row.target_year,
    hunterAmount: legacyAmountIsUnsplitHunter ? legacyAmount : hunterAmount,
    maintenanceAmount,
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
