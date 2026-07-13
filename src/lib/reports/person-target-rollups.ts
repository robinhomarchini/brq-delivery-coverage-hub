import type { RoleType } from "@/data/mockData";
import { isHunterRole } from "@/lib/roles";
import { getStudioMaintenancePersonId, getTargetOwnAmount, isStudioRenewalEligibleForFarmer } from "@/lib/studio-renewal-rollup";

export function buildStudioHunterTotalsByHunterCustomer(
  studioAllocations: Array<{ customerId: string; hunterPersonId?: string; year: number; hunterAmount: number }>,
  year: number,
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
) {
  const totals = new Map<string, number>();
  studioAllocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount > 0)
    .forEach((allocation) => {
      const effectiveHunterPersonId = getEffectiveStudioHunterPersonId(allocation, people, targetAllocations);
      if (!effectiveHunterPersonId) return;
      const key = `${effectiveHunterPersonId}:${allocation.customerId}`;
      totals.set(key, (totals.get(key) ?? 0) + allocation.hunterAmount);
    });
  return totals;
}

export function buildStudioRenewalTotalsByPersonCustomer(
  studioAllocations: Array<{ customerId: string; areaId: string; hunterPersonId?: string; maintenancePersonId?: string; year: number; maintenanceAmount: number }>,
  year: number,
  people: Array<{ id: string; roleType: RoleType; active: boolean }>,
  areaNames: Map<string, string>,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const totals = new Map<string, number>();
  studioAllocations
    .filter((allocation) => allocation.year === year && getStudioMaintenancePersonId(allocation) && allocation.maintenanceAmount > 0)
    .forEach((allocation) => {
      const maintenancePersonId = getStudioMaintenancePersonId(allocation);
      const person = maintenancePersonId ? peopleById.get(maintenancePersonId) : undefined;
      const areaName = areaNames.get(allocation.areaId) ?? allocation.areaId;
      if (!maintenancePersonId || !isStudioRenewalEligibleForFarmer(areaName, person, {
        explicitMaintenancePerson: Boolean(allocation.maintenancePersonId),
      })) return;
      const key = `${maintenancePersonId}:${allocation.customerId}`;
      totals.set(key, (totals.get(key) ?? 0) + allocation.maintenanceAmount);
    });
  return totals;
}

export function getTargetOwnAmountFromAllocations(
  allocations: Array<{ amount: number; ownAmount?: number }>,
  derivedAmount: number,
) {
  if (!allocations.length) return 0;
  const amount = allocations.reduce((total, allocation) => total + allocation.amount, 0);
  const ownAmount = allocations.some((allocation) => allocation.ownAmount !== undefined)
    ? allocations.reduce((total, allocation) => total + (allocation.ownAmount ?? 0), 0)
    : undefined;
  return getTargetOwnAmount({ amount, ownAmount }, derivedAmount);
}

export function getHunterOwnAmount(
  allocation: { amount: number; ownAmount?: number },
  studioHunterAmount: number,
) {
  return Math.max(allocation.ownAmount ?? allocation.amount - studioHunterAmount, 0);
}

export function getEffectiveStudioHunterPersonId(
  allocation: { customerId: string; hunterPersonId?: string; year: number },
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
) {
  return allocation.hunterPersonId
    ?? getDefaultHunterPersonIdForCustomer(people, targetAllocations, allocation.customerId, allocation.year);
}

function getDefaultHunterPersonIdForCustomer(
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
  customerId: string,
  year: number,
) {
  const directHunterTarget = targetAllocations.find((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
    && allocation.type === "hunter"
    && people.some((person) => person.id === allocation.personId && person.active && isHunterRole(person.roleType))
  );
  if (directHunterTarget) return directHunterTarget.personId;

  return people.find((person) =>
    person.active
    && isHunterRole(person.roleType)
    && person.clientIds.includes(customerId)
  )?.id;
}
