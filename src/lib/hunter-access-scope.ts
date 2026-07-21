import type { AccessUser } from "@/lib/access-control";
import { isHunterConsultAccess, normalizeAccessEmail } from "@/lib/access-control";
import type { Customer, Person, SpecialistHunterStudioAssignment, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import { isHunterSelectionRole } from "@/lib/roles";

export interface HunterAccessScope {
  enabled: boolean;
  person: Person | null;
  customerIds: Set<string>;
}

export function buildHunterAccessScope({
  accessUser,
  people,
  customers,
  targetAllocations,
  studioTargetAllocations,
  specialistHunterStudioAssignments = [],
}: {
  accessUser: AccessUser | null | undefined;
  people: Person[];
  customers: Customer[];
  targetAllocations: TargetAllocation[];
  studioTargetAllocations: StudioTargetAllocation[];
  specialistHunterStudioAssignments?: SpecialistHunterStudioAssignment[];
}): HunterAccessScope {
  if (!isHunterConsultAccess(accessUser)) {
    return { enabled: false, person: null, customerIds: new Set(customers.map((customer) => customer.id)) };
  }

  const email = normalizeAccessEmail(accessUser?.email ?? "");
  const person = people.find((item) =>
    item.email
    && normalizeAccessEmail(item.email) === email
    && isHunterSelectionRole(item.roleType)
  ) ?? null;

  if (!person) {
    return { enabled: true, person: null, customerIds: new Set() };
  }

  const studioAllocationById = new Map(studioTargetAllocations.map((allocation) => [allocation.id, allocation]));
  const customerIds = new Set<string>(person.clientIds);

  for (const allocation of targetAllocations) {
    if (allocation.personId === person.id) customerIds.add(allocation.customerId);
  }

  for (const allocation of studioTargetAllocations) {
    if (allocation.hunterPersonId === person.id || allocation.maintenancePersonId === person.id) {
      customerIds.add(allocation.customerId);
    }
  }

  for (const assignment of specialistHunterStudioAssignments) {
    if (assignment.personId !== person.id) continue;
    const allocation = studioAllocationById.get(assignment.studioTargetAllocationId);
    if (allocation) customerIds.add(allocation.customerId);
  }

  return { enabled: true, person, customerIds };
}

export function isCustomerInHunterScope(scope: HunterAccessScope, customerId: string) {
  return !scope.enabled || scope.customerIds.has(customerId);
}

export function canEditStudioAllocationInHunterScope(scope: HunterAccessScope, allocation: Pick<StudioTargetAllocation, "hunterPersonId" | "maintenancePersonId"> | null | undefined) {
  if (!scope.enabled) return true;
  if (!scope.person || !allocation) return false;
  return allocation.hunterPersonId === scope.person.id || allocation.maintenancePersonId === scope.person.id;
}
