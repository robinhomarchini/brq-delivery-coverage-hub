import type { Area, Person, RoleType, StudioTargetAllocation } from "@/data/mockData";
import { isFarmerDeliveryTargetRole } from "@/lib/roles";

export function isStudioRenewalEligibleForFarmer(
  _areaName: string,
  person?: Pick<Person, "active" | "roleType"> | { active?: boolean; roleType: RoleType },
  options: { explicitMaintenancePerson?: boolean } = {},
) {
  if (!Boolean(person?.active ?? true)) return false;
  if (options.explicitMaintenancePerson) return Boolean(person);
  return Boolean(person?.roleType && isFarmerDeliveryTargetRole(person.roleType));
}

export function getEligibleStudioRenewalAmountForPerson({
  allocations,
  areas,
  people,
  customerId,
  personId,
  year,
}: {
  allocations: Array<Pick<StudioTargetAllocation, "customerId" | "areaId" | "hunterPersonId" | "maintenancePersonId" | "year" | "maintenanceAmount">>;
  areas: Array<Pick<Area, "id" | "name">>;
  people: Array<Pick<Person, "id" | "active" | "roleType">>;
  customerId: string;
  personId: string;
  year: number;
}) {
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const person = people.find((item) => item.id === personId);
  if (!person) return 0;

  return roundCurrency(allocations
    .filter((allocation) =>
      allocation.customerId === customerId
      && getStudioMaintenancePersonId(allocation) === personId
      && allocation.year === year
      && allocation.maintenanceAmount > 0
      && isStudioRenewalEligibleForFarmer(areaNames.get(allocation.areaId) ?? allocation.areaId, person, {
        explicitMaintenancePerson: allocation.maintenancePersonId === personId,
      })
    )
    .reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
}

export function getStudioMaintenancePersonId(allocation: Pick<StudioTargetAllocation, "hunterPersonId" | "maintenancePersonId">) {
  return allocation.maintenancePersonId ?? allocation.hunterPersonId;
}

export function getTargetOwnAmount(allocation: { amount: number; ownAmount?: number } | undefined, derivedAmount: number) {
  return roundCurrency(allocation?.ownAmount ?? Math.max((allocation?.amount ?? 0) - derivedAmount, 0));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
