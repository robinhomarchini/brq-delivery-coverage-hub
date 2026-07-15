import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Area,
  type Customer,
  type CustomerTarget,
  type Person,
  type PersonCompensation,
  type RoleType,
  type SpecialistHunterStudioAssignment,
  type StudioTargetAllocation,
  type Subject,
  type SubjectStatus,
  type TargetAllocation,
  type TargetAllocationType,
} from "@/data/mockData";
import { boardTargetBaselineRows as fallbackBoardTargetBaselineRows, type BoardTargetBaselineRow } from "@/data/boardTargetBaseline";
import { getStudioBaselineSource, type StudioBaselineSnapshot, type StudioBaselineSourceCode } from "@/lib/studio-baseline-import";
import type { TargetBaselineRow, TargetBaselineSnapshot } from "@/lib/target-baseline-import";
import type { DeliveryData, DeliveryRepository } from "./types";
import type { PersonCustomerRemovalInput, PersonCustomerTargetsInput } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildAreaUsages } from "@/lib/area-usage";
import { getCustomerTotalTarget, getCustomerTotalTargetFromParts } from "@/lib/customer-target-total";
import { getFinancialCustomerMetric } from "@/lib/financial-customers";
import { normalizeLifecycleStatus } from "@/lib/lifecycle";
import { validateArea, validateCustomer, validatePerson, validatePersonCompensation, validateStudioTargetAllocation, validateSubject, validateTargetAllocation } from "@/lib/validation";
import {
  applyCoverageAssignments,
  buildAssignmentsFromCoverage,
  type CoverageAssignment,
} from "@/lib/coverage-sync";
import { isCustomerFarmerResponsibleProfile, isCustomerManagerProfile, isHunterRole, isSpecialistHunterRole, isTargetAssignableRole } from "@/lib/roles";
import { normalizeBusinessName } from "@/lib/utils";
import { OTHER_DIRECTOR_ID, OTHER_DIRECTOR_NAME } from "@/lib/director-governance";
import { getEligibleStudioRenewalAmountForPerson, getTargetOwnAmount } from "@/lib/studio-renewal-rollup";

interface SupabaseDeliveryRepositoryOptions {
  useCustomerBff?: boolean;
  usePersonCustomerTargetsBff?: boolean;
}

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
  lifecycle_status?: string | null;
  closed_at?: string | null;
  closed_reason?: string | null;
  is_manager: boolean;
  hierarchy_level: number;
};

type PersonCompensationRow = {
  person_id: string;
  annual_salary: number | string;
  currency: string;
  effective_from: string;
  notes: string | null;
  updated_at?: string | null;
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
  own_amount?: number | string | null;
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
  hunter_person_id?: string | null;
  maintenance_person_id?: string | null;
  target_year: number;
  amount?: number | string | null;
  hunter_amount?: number | string | null;
  maintenance_amount?: number | string | null;
  notes: string | null;
};

type SpecialistHunterStudioAssignmentRow = {
  id: string;
  person_id: string;
  studio_target_allocation_id: string;
  target_year: number;
  notes: string | null;
};

type TerritoryAreaRow = {
  id: string;
  area_id: string | null;
};

type BoardTargetBaselineDbRow = {
  baseline_year: number;
  customer_name: string;
  business_unit: string;
  hunter_target: number | string;
  farmer_renewal_target: number | string;
  total_target: number | string;
};

type StudioBaselineSnapshotRow = {
  id: string;
  baseline_year: number;
  source_code?: string | null;
  source_name?: string | null;
  file_name: string;
  snapshot_rows: unknown[];
  totals: Record<string, number>;
  created_at: string;
};

type TargetBaselineSnapshotRow = {
  id: string;
  baseline_year: number;
  file_name: string;
  snapshot_rows: TargetBaselineRow[];
  totals: TargetBaselineSnapshot["totals"];
  created_at: string;
};

export class SupabaseDeliveryRepository implements DeliveryRepository {
  private readonly useCustomerBff: boolean;
  private readonly usePersonCustomerTargetsBff: boolean;

  constructor(
    private readonly client: SupabaseClient,
    options: SupabaseDeliveryRepositoryOptions = {},
  ) {
    this.useCustomerBff = options.useCustomerBff ?? true;
    this.usePersonCustomerTargetsBff = options.usePersonCustomerTargetsBff ?? true;
  }

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
      const { error } = await this.client.from("people").upsert(toPersonRow(validated));
      if (error) throw error;
      await this.replacePersonAssignments(validated.id, validated.clientIds);
    }
    return this.fetchAll();
  }

  async savePersonCompensation(compensation: PersonCompensation) {
    const validated = validatePersonCompensation(compensation);
    const { error } = await this.client
      .from("person_compensations")
      .upsert(toPersonCompensationRow(validated));
    if (error) throw error;
    return this.fetchAll();
  }

  async deletePersonCompensation(personId: string) {
    const { error } = await this.client
      .from("person_compensations")
      .delete()
      .eq("person_id", personId);
    if (error) throw error;
    return this.fetchAll();
  }

  async deletePerson(id: string) {
    const { error } = await this.client.from("people").delete().eq("id", id);
    if (error) throw error;
  }

  async saveCustomer(customer: Customer, targetYear = 2026) {
    customer = { ...customer, revenue: getCustomerTarget(customer) };
    if (this.useCustomerBff) {
      return this.saveCustomerWithBff(customer, targetYear);
    }

    const validated = validateCustomer(customer);
    await this.assertUniqueCustomerName(validated);
    if (validated.directorResponsibleId === OTHER_DIRECTOR_ID) {
      await this.ensureOtherDirectorBucket();
    }
    const savedWithRpc = await this.trySaveCustomerWithRpc(validated, targetYear);
    if (!savedWithRpc) {
      const { error } = await this.client.from("customers").upsert(toCustomerRow(validated));
      if (error) throw error;
      await this.upsertCustomerTarget(validated, targetYear);
      await this.replaceCustomerManagerAssignments(validated.id, validated.managerResponsibleIds);
    }
    return this.fetchAll();
  }

  async saveCustomers(customers: Customer[], targetYear = 2026) {
    const validated = customers.map((customer) => {
      const validCustomer = validateCustomer(customer);
      return { ...validCustomer, revenue: getCustomerTarget(validCustomer) };
    });
    if (validated.some((customer) => customer.directorResponsibleId === OTHER_DIRECTOR_ID)) {
      await this.ensureOtherDirectorBucket();
    }
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
    const { data: existingById, error: existingByIdError } = await this.client
      .from("studio_target_allocations")
      .select("id, hunter_person_id, maintenance_person_id")
      .eq("id", validated.id)
      .maybeSingle();
    if (existingByIdError) throw existingByIdError;
    let lookup = this.client
      .from("studio_target_allocations")
      .select("id, hunter_person_id, maintenance_person_id")
      .eq("customer_id", validated.customerId)
      .eq("area_id", validated.areaId)
      .eq("target_year", validated.year);
    lookup = validated.hunterPersonId
      ? lookup.eq("hunter_person_id", validated.hunterPersonId)
      : lookup.is("hunter_person_id", null);
    lookup = validated.maintenancePersonId
      ? lookup.eq("maintenance_person_id", validated.maintenancePersonId)
      : lookup.is("maintenance_person_id", null);
    const { data: existingByGrain, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    const existing = existingById ?? existingByGrain;
    if (existing?.id) row.id = existing.id;

    const { error } = await this.client.from("studio_target_allocations").upsert(row);
    if (error) throw error;
    await this.syncStudioDerivedTargetsForPerson(validated.customerId, validated.hunterPersonId, validated.maintenancePersonId, validated.year);
    const previousHunterPersonId = (existing as { hunter_person_id?: string | null } | null)?.hunter_person_id ?? null;
    const previousMaintenancePersonId = (existing as { maintenance_person_id?: string | null } | null)?.maintenance_person_id ?? null;
    if (previousHunterPersonId && previousHunterPersonId !== validated.hunterPersonId) {
      await this.syncStudioDerivedTargetsForPerson(validated.customerId, previousHunterPersonId, previousMaintenancePersonId ?? undefined, validated.year);
    }
    if (previousMaintenancePersonId && previousMaintenancePersonId !== validated.maintenancePersonId) {
      await this.syncStudioDerivedTargetsForPerson(validated.customerId, previousHunterPersonId ?? undefined, previousMaintenancePersonId, validated.year);
    }
    return { ...validated, id: row.id };
  }

  async deleteStudioTargetAllocation(id: string) {
    const { data: existing, error: lookupError } = await this.client
      .from("studio_target_allocations")
      .select("customer_id, hunter_person_id, maintenance_person_id, target_year")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const { error } = await this.client.from("studio_target_allocations").delete().eq("id", id);
    if (error) throw error;
    const deleted = existing as { customer_id: string; hunter_person_id?: string | null; maintenance_person_id?: string | null; target_year: number } | null;
    if (deleted) {
      await this.syncStudioDerivedTargetsForPerson(deleted.customer_id, deleted.hunter_person_id ?? undefined, deleted.maintenance_person_id ?? undefined, deleted.target_year);
    }
  }

  async saveSpecialistHunterStudioAssignments(input: {
    personId: string;
    customerId: string;
    year: number;
    studioTargetAllocationIds: string[];
  }) {
    const { error } = await this.client.rpc("save_specialist_hunter_studio_assignments", {
      p_person_id: input.personId,
      p_customer_id: input.customerId,
      p_target_year: input.year,
      p_studio_target_allocation_ids: input.studioTargetAllocationIds,
    });
    if (error) throw error;
    return this.fetchAll();
  }

  async saveStudioBaselineSnapshot(snapshot: Omit<StudioBaselineSnapshot, "id" | "createdAt">) {
    const { data, error } = await this.client
      .from("studio_baseline_snapshots")
      .insert({
        baseline_year: snapshot.year,
        source_code: snapshot.sourceCode,
        source_name: snapshot.sourceName,
        file_name: snapshot.fileName,
        snapshot_rows: snapshot.rows,
        totals: snapshot.totals,
      })
      .select("*")
      .single();
    if (error) throw error;
    return fromStudioBaselineSnapshotRow(data as StudioBaselineSnapshotRow);
  }

  async saveTargetBaselineSnapshot(snapshot: Omit<TargetBaselineSnapshot, "id" | "createdAt">) {
    const { data, error } = await this.client
      .from("target_baseline_snapshots")
      .insert({
        baseline_year: snapshot.year,
        file_name: snapshot.fileName,
        snapshot_rows: snapshot.rows,
        totals: snapshot.totals,
      })
      .select("*")
      .single();
    if (error) throw error;
    return fromTargetBaselineSnapshotRow(data as TargetBaselineSnapshotRow);
  }

  async savePersonCustomerTargets(input: PersonCustomerTargetsInput) {
    if (this.usePersonCustomerTargetsBff) {
      return this.savePersonCustomerTargetsWithBff(input);
    }

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
    const [areasResult, peopleResult, personCompensationsResult, customersResult, customerTargetsResult, subjectsResult, assignmentsResult, targetAllocationsResult, studioTargetAllocationsResult, specialistHunterStudioAssignmentsResult, territoriesResult, boardTargetBaselinesResult, studioBaselineSnapshotsResult, targetBaselineSnapshotsResult] = await Promise.all([
      this.client.from("areas").select("*").order("name"),
      this.client.from("people").select("*").order("hierarchy_level").order("name"),
      this.client.from("person_compensations").select("*").order("person_id"),
      this.client.from("customers").select("*").order("name"),
      this.client.from("customer_target_years").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("subjects").select("*").order("name"),
      this.client.from("person_customer_assignments").select("person_id, customer_id"),
      this.client.from("revenue_target_allocations").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("studio_target_allocations").select("*").order("target_year", { ascending: false }).order("customer_id"),
      this.client.from("specialist_hunter_studio_assignments").select("*").order("target_year", { ascending: false }).order("person_id"),
      this.client.from("territories").select("id, area_id"),
      this.client.from("board_target_baselines").select("*").eq("approved", true).order("baseline_year", { ascending: false }).order("customer_name"),
      this.client.from("studio_baseline_snapshots").select("*").order("created_at", { ascending: false }).limit(20),
      this.client.from("target_baseline_snapshots").select("*").order("created_at", { ascending: false }).limit(20),
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
      personCompensations: personCompensationsResult.error
        ? []
        : (personCompensationsResult.data as PersonCompensationRow[]).map(fromPersonCompensationRow),
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
      specialistHunterStudioAssignments: specialistHunterStudioAssignmentsResult.error
        ? []
        : (specialistHunterStudioAssignmentsResult.data as SpecialistHunterStudioAssignmentRow[]).map(fromSpecialistHunterStudioAssignmentRow),
      boardTargetBaselines: boardTargetBaselinesResult.error
        ? fallbackBoardTargetBaselineRows
        : (boardTargetBaselinesResult.data as BoardTargetBaselineDbRow[]).map(fromBoardTargetBaselineDbRow),
      studioBaselineSnapshots: studioBaselineSnapshotsResult.error
        ? []
        : (studioBaselineSnapshotsResult.data as StudioBaselineSnapshotRow[]).map(fromStudioBaselineSnapshotRow),
      targetBaselineSnapshots: targetBaselineSnapshotsResult.error
        ? []
        : (targetBaselineSnapshotsResult.data as TargetBaselineSnapshotRow[]).map(fromTargetBaselineSnapshotRow),
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

    if (!error) {
      await this.updatePersonLifecycleFields(person);
      return true;
    }
    if (isMissingRpcError(error)) return false;
    throw error;
  }

  private async updatePersonLifecycleFields(person: Person) {
    const { error } = await this.client
      .from("people")
      .update({
        lifecycle_status: person.lifecycleStatus,
        closed_at: person.closedAt ?? null,
        closed_reason: person.closedReason ?? null,
      })
      .eq("id", person.id);
    if (error && !isMissingColumnError(error)) throw error;
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

  private async ensureOtherDirectorBucket() {
    const { error: areaError } = await this.client
      .from("areas")
      .upsert({
        id: "area-corporate",
        name: "Estratégia & Operações",
        description: "Gestão executiva, operações e pré-vendas.",
      });
    if (areaError) throw areaError;

    const { error } = await this.client
      .from("people")
      .upsert({
        id: OTHER_DIRECTOR_ID,
        name: OTHER_DIRECTOR_NAME,
        email: "outros@brq.com",
        job_title: "Diretoria a definir",
        director_id: null,
        manager_id: null,
        role_type: "Director",
        area_id: "area-corporate",
        client_ids: [],
        photo_url: null,
        notes: "Bucket transitório para clientes ainda sem diretoria definida. Não recebe meta direta.",
        active: true,
        is_manager: false,
        hierarchy_level: 2,
        lifecycle_status: "active",
        closed_at: null,
        closed_reason: null,
      });
    if (error) throw error;
  }

  private async replaceCustomerManagerAssignments(customerId: string, managerIds: string[]) {
    const { data, error: peopleError } = await this.client.from("people").select("*");
    if (peopleError) throw peopleError;
    const currentManagerIds = (data as PersonRow[])
      .filter((row) => isCustomerFarmerResponsibleProfile(row.role_type as RoleType, row.is_manager))
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

  private async trySaveCustomerWithRpc(customer: Customer, targetYear: number) {
    const { error } = await this.client.rpc("save_customer_with_managers_and_targets", {
      p_id: customer.id,
      p_name: customer.name,
      p_industry: customer.industry,
      p_director_responsible_id: customer.directorResponsibleId,
      p_manager_responsible_ids: customer.managerResponsibleIds,
      p_target_year: targetYear,
      p_hunter_target: customer.hunterTarget,
      p_farmer_renewal_target: customer.farmerRenewalTarget,
      p_studio_hunter_target: customer.studioHunterTarget,
      p_studio_target: customer.studioTarget,
      p_revenue: getCustomerTarget(customer),
      p_margin: customer.margin,
      p_strategic_account: customer.strategicAccount,
    });

    if (!error) return true;
    if (!isMissingRpcError(error)) throw error;

    const fallback = await this.client.rpc("save_customer_with_managers", {
      p_id: customer.id,
      p_name: customer.name,
      p_industry: customer.industry,
      p_director_responsible_id: customer.directorResponsibleId,
      p_manager_responsible_ids: customer.managerResponsibleIds,
      p_revenue: getCustomerTarget(customer),
      p_margin: customer.margin,
      p_strategic_account: customer.strategicAccount,
    });
    if (!fallback.error) {
      await this.upsertCustomerTarget(customer, targetYear);
      return true;
    }
    if (isMissingRpcError(fallback.error)) return false;
    throw fallback.error;
  }

  private async saveCustomerWithBff(customer: Customer, targetYear: number) {
    const token = await this.getCurrentAccessToken();

    const response = await fetch("/api/delivery/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ customer, targetYear }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? "Não foi possível salvar o cliente.");
    }

    return response.json() as Promise<DeliveryData>;
  }

  private async trySavePersonCustomerTargetsWithRpc(input: PersonCustomerTargetsInput) {
    void input;
    return false;
  }

  private async savePersonCustomerTargetsWithBff(input: PersonCustomerTargetsInput) {
    const token = await this.getCurrentAccessToken();

    const response = await fetch("/api/delivery/person-customer-targets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? "Não foi possível salvar as metas.");
    }

    return response.json() as Promise<DeliveryData>;
  }

  private async getCurrentAccessToken() {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Sessão expirada. Entre novamente para salvar.");
    }
    return token;
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
    const specialistAsCustomerHunter = input.allowSpecialistHunterAsCustomerHunter === true && isSpecialistHunterRole(personRole);
    if (!isTargetAssignableRole(personRole) && !specialistAsCustomerHunter) {
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
    const studioHunterAmount = await this.getStudioHunterAmount(input.customerId, input.personId, input.year);
    const nextHunterOwnAmount = sanitizeAmount(input.hunterOwnAmount ?? Math.max(input.hunterAmount - studioHunterAmount, 0));
    const nextHunterAmount = roundCurrency(nextHunterOwnAmount + studioHunterAmount);
    const studioRenewalAmount = await this.getEligibleStudioRenewalAmount(input.customerId, input.personId, input.year);
    const nextFarmerRenewalOwnAmount = sanitizeAmount(input.farmerRenewalAmount);
    const nextFarmerRenewalAmount = roundCurrency(nextFarmerRenewalOwnAmount + studioRenewalAmount);
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
    const nextCustomerRevenue = getCustomerTotalTarget({
      hunterTarget: nextHunterTarget,
      farmerRenewalTarget: nextFarmerRenewalTarget,
    });
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
          revenue: nextCustomerRevenue,
        }, input.year);
      }
    }

    if (isHunterRole(personRole) || specialistAsCustomerHunter) {
      await this.upsertPersonCustomerAssignment(input.personId, input.customerId);
    }

    await this.persistTypeTargetWithFallback(input, "hunter", nextHunterAmount, allocations, nextHunterOwnAmount);
    await this.persistTypeTargetWithFallback(input, "farmer_renewal", nextFarmerRenewalAmount, allocations, nextFarmerRenewalOwnAmount);
    await this.persistTypeTargetWithFallback(input, "studio", nextStudioAmount, allocations);

    if (isCustomerManagerProfile(personRole, true) && nextFarmerRenewalAmount > 0) {
      await this.upsertPersonCustomerAssignment(input.personId, input.customerId);
    }

    if (!isHunterRole(personRole) && !specialistAsCustomerHunter && nextFarmerRenewalAmount <= 0) {
      const { error: assignmentDeleteError } = await this.client
        .from("person_customer_assignments")
        .delete()
        .eq("person_id", input.personId)
        .eq("customer_id", input.customerId)
        .eq("source", "rpc_target_save");
      if (assignmentDeleteError) throw assignmentDeleteError;
    }
  }

  private async upsertPersonCustomerAssignment(personId: string, customerId: string) {
    const { error } = await this.client
      .from("person_customer_assignments")
      .upsert({
        person_id: personId,
        customer_id: customerId,
        source: "rpc_target_save",
      });
    if (error) throw error;
  }

  private async persistTypeTargetWithFallback(
    input: PersonCustomerTargetsInput,
    type: TargetAllocationType,
    amount: number,
    allocations: TargetAllocation[],
    ownAmount?: number,
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
      ownAmount: type === "hunter" || type === "farmer_renewal" ? ownAmount ?? amount : undefined,
      notes: input.notes ?? "Meta associada pela tela Metas por Pessoa.",
    });

    const { error } = await this.client.from("revenue_target_allocations").upsert(toTargetAllocationRow(allocation));
    if (error) throw error;
  }

  private async syncStudioDerivedTargetsForPerson(customerId: string, hunterPersonId: string | undefined, maintenancePersonId: string | undefined, year: number) {
    await this.syncHunterTargetTotalForStudio(customerId, hunterPersonId, year);
    await this.syncFarmerRenewalTargetTotalForStudio(customerId, maintenancePersonId ?? hunterPersonId, year);
  }

  private async syncHunterTargetTotalForStudio(customerId: string, hunterPersonId: string | undefined, year: number) {
    if (!hunterPersonId) return;
    const [{ data: existingData, error: existingError }, studioHunterAmount] = await Promise.all([
      this.client
        .from("revenue_target_allocations")
        .select("*")
        .eq("customer_id", customerId)
        .eq("person_id", hunterPersonId)
        .eq("target_type", "hunter")
        .eq("target_year", year)
        .maybeSingle(),
      this.getStudioHunterAmount(customerId, hunterPersonId, year),
    ]);
    if (existingError) throw existingError;

    const existing = existingData ? fromTargetAllocationRow(existingData as TargetAllocationRow) : null;
    const ownAmount = roundCurrency(Math.max((existing?.amount ?? 0) - studioHunterAmount, 0));
    const totalAmount = roundCurrency(ownAmount + studioHunterAmount);

    if (totalAmount <= 0.01) {
      if (existing?.id) {
        const { error } = await this.client.from("revenue_target_allocations").delete().eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }

    const allocation = validateTargetAllocation({
      id: existing?.id ?? `target-${customerId}-${hunterPersonId}-hunter-${year}`,
      customerId,
      personId: hunterPersonId,
      type: "hunter",
      year,
      amount: totalAmount,
      ownAmount,
      notes: existing?.notes ?? "Meta Hunter total recalculada a partir da meta própria e dos Studios.",
    });
    const { error } = await this.client.from("revenue_target_allocations").upsert(toTargetAllocationRow(allocation));
    if (error) throw error;
  }

  private async getStudioHunterAmount(customerId: string, hunterPersonId: string, year: number) {
    const { data, error } = await this.client
      .from("studio_target_allocations")
      .select("hunter_amount")
      .eq("customer_id", customerId)
      .eq("hunter_person_id", hunterPersonId)
      .eq("target_year", year);
    if (error) throw error;
    return roundCurrency((data as Array<{ hunter_amount?: number | string | null }> | null ?? [])
      .reduce((total, row) => total + Number(row.hunter_amount ?? 0), 0));
  }

  private async syncFarmerRenewalTargetTotalForStudio(customerId: string, personId: string | undefined, year: number) {
    if (!personId) return;
    const [{ data: existingData, error: existingError }, studioRenewalAmount] = await Promise.all([
      this.client
        .from("revenue_target_allocations")
        .select("*")
        .eq("customer_id", customerId)
        .eq("person_id", personId)
        .eq("target_type", "farmer_renewal")
        .eq("target_year", year)
        .maybeSingle(),
      this.getEligibleStudioRenewalAmount(customerId, personId, year),
    ]);
    if (existingError) throw existingError;

    const existing = existingData ? fromTargetAllocationRow(existingData as TargetAllocationRow) : null;
    const ownAmount = getTargetOwnAmount(existing ?? undefined, studioRenewalAmount);
    const totalAmount = roundCurrency(ownAmount + studioRenewalAmount);

    if (totalAmount <= 0.01) {
      if (existing?.id) {
        const { error } = await this.client.from("revenue_target_allocations").delete().eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }

    const allocation = validateTargetAllocation({
      id: existing?.id ?? `target-${customerId}-${personId}-farmer-renewal-${year}`,
      customerId,
      personId,
      type: "farmer_renewal",
      year,
      amount: totalAmount,
      ownAmount,
      notes: existing?.notes ?? "Meta Renovação total recalculada a partir da meta própria e dos Studios elegíveis.",
    });
    const { error } = await this.client.from("revenue_target_allocations").upsert(toTargetAllocationRow(allocation));
    if (error) throw error;
  }

  private async getEligibleStudioRenewalAmount(customerId: string, personId: string, year: number) {
    const [personResult, studioResult] = await Promise.all([
      this.client.from("people").select("id, role_type, active").eq("id", personId).maybeSingle(),
      this.client
        .from("studio_target_allocations")
        .select("customer_id, area_id, hunter_person_id, maintenance_person_id, target_year, maintenance_amount")
        .eq("customer_id", customerId)
        .eq("target_year", year),
    ]);
    if (personResult.error) throw personResult.error;
    if (studioResult.error) throw studioResult.error;

    const rows = studioResult.data as Array<{
      customer_id: string;
      area_id: string;
      hunter_person_id?: string | null;
      maintenance_person_id?: string | null;
      target_year: number;
      maintenance_amount?: number | string | null;
    }> | null;
    const areaIds = Array.from(new Set((rows ?? []).map((row) => row.area_id)));
    const areasResult = areaIds.length
      ? await this.client.from("areas").select("id, name").in("id", areaIds)
      : { data: [], error: null };
    if (areasResult.error) throw areasResult.error;

    const person = personResult.data as { id: string; role_type: RoleType; active: boolean } | null;
    return getEligibleStudioRenewalAmountForPerson({
      allocations: (rows ?? []).map((row) => ({
        customerId: row.customer_id,
        areaId: row.area_id,
        hunterPersonId: row.hunter_person_id ?? undefined,
        maintenancePersonId: row.maintenance_person_id ?? undefined,
        year: row.target_year,
        maintenanceAmount: Number(row.maintenance_amount ?? 0),
      })).filter((allocation) => (allocation.maintenancePersonId ?? allocation.hunterPersonId) === personId),
      areas: (areasResult.data as AreaRow[] | null ?? []).map((area) => ({ id: area.id, name: area.name })),
      people: person ? [{ id: person.id, active: person.active, roleType: person.role_type }] : [],
      customerId,
      personId,
      year,
    });
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
    lifecycle_status: person.lifecycleStatus,
    closed_at: person.closedAt ?? null,
    closed_reason: person.closedReason ?? null,
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
    lifecycleStatus: normalizeLifecycleStatus(row.lifecycle_status, row.active),
    closedAt: row.closed_at ?? undefined,
    closedReason: row.closed_reason ?? undefined,
    isManager: row.is_manager,
    hierarchyLevel: row.hierarchy_level as 1 | 2 | 3,
  };
}

function toPersonCompensationRow(compensation: PersonCompensation): PersonCompensationRow {
  const row: PersonCompensationRow = {
    person_id: compensation.personId,
    annual_salary: compensation.annualSalary,
    currency: compensation.currency,
    effective_from: compensation.effectiveFrom,
    notes: compensation.notes ?? null,
  };
  if (compensation.updatedAt) row.updated_at = compensation.updatedAt;
  return row;
}

function fromPersonCompensationRow(row: PersonCompensationRow): PersonCompensation {
  return {
    personId: row.person_id,
    annualSalary: Number(row.annual_salary),
    currency: row.currency === "BRL" ? "BRL" : "BRL",
    effectiveFrom: row.effective_from,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function toCustomerRow(customer: Customer): CustomerRow {
  const revenue = getCustomerTarget(customer);
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
    revenue,
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
    revenue: getCustomerTotalTargetFromParts(hunterTarget, farmerRenewalTarget),
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
    revenue: getCustomerTotalTargetFromParts(hunterTarget, farmerRenewalTarget),
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
      revenue: getCustomerTotalTargetFromParts(target.hunterTarget, target.farmerRenewalTarget),
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
  return getCustomerTotalTarget(customer);
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
    own_amount: allocation.type === "hunter" || allocation.type === "farmer_renewal" ? allocation.ownAmount ?? allocation.amount : null,
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
    ownAmount: row.own_amount == null ? undefined : Number(row.own_amount),
    notes: row.notes ?? undefined,
  };
}

function toStudioTargetAllocationRow(allocation: StudioTargetAllocation): StudioTargetAllocationRow {
  return {
    id: allocation.id,
    customer_id: allocation.customerId,
    area_id: allocation.areaId,
    hunter_person_id: allocation.hunterPersonId ?? null,
    maintenance_person_id: allocation.maintenancePersonId ?? null,
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
    hunterPersonId: row.hunter_person_id ?? undefined,
    maintenancePersonId: row.maintenance_person_id ?? undefined,
    year: row.target_year,
    hunterAmount: legacyAmountIsUnsplitHunter ? legacyAmount : hunterAmount,
    maintenanceAmount,
    notes: row.notes ?? undefined,
  };
}

function fromSpecialistHunterStudioAssignmentRow(row: SpecialistHunterStudioAssignmentRow): SpecialistHunterStudioAssignment {
  return {
    id: row.id,
    personId: row.person_id,
    studioTargetAllocationId: row.studio_target_allocation_id,
    year: row.target_year,
    notes: row.notes ?? undefined,
  };
}

function fromBoardTargetBaselineDbRow(row: BoardTargetBaselineDbRow): BoardTargetBaselineRow {
  return {
    year: row.baseline_year,
    customerName: row.customer_name,
    businessUnit: row.business_unit,
    hunterTarget: Number(row.hunter_target),
    farmerRenewalTarget: Number(row.farmer_renewal_target),
    totalTarget: Number(row.total_target),
  };
}

function fromStudioBaselineSnapshotRow(row: StudioBaselineSnapshotRow): StudioBaselineSnapshot {
  const source = getStudioBaselineSource(row.source_code ?? "studio_general");
  return {
    id: row.id,
    year: row.baseline_year,
    sourceCode: source.code as StudioBaselineSourceCode,
    sourceName: row.source_name ?? source.name,
    fileName: row.file_name,
    rows: row.snapshot_rows,
    totals: row.totals,
    createdAt: row.created_at,
  };
}

function fromTargetBaselineSnapshotRow(row: TargetBaselineSnapshotRow): TargetBaselineSnapshot {
  return {
    id: row.id,
    year: row.baseline_year,
    fileName: row.file_name,
    rows: row.snapshot_rows,
    totals: row.totals,
    createdAt: row.created_at,
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

function isMissingColumnError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || (message.includes("column") && message.includes("does not exist"));
}

function sanitizeAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
