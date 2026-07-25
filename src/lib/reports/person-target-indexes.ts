import type { Area, Customer, Person, StudioTargetAllocation } from "@/data/mockData";

export interface DeliveryIndexes {
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  peopleNames: Map<string, string>;
  customerIds: Set<string>;
  studioTargetAllocationIds: Set<string>;
}

export function buildDeliveryIndexes({
  customers,
  areas,
  people,
  studioTargetAllocations,
}: {
  customers: Customer[];
  areas: Area[];
  people: Person[];
  studioTargetAllocations: StudioTargetAllocation[];
}): DeliveryIndexes {
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const peopleNames = new Map(people.map((person) => [person.id, person.name]));

  const customerIds = new Set(customers.map((customer) => customer.id));
  const studioTargetAllocationIds = new Set(studioTargetAllocations.map((allocation) => allocation.id));

  return {
    customerNames,
    areaNames,
    peopleNames,
    customerIds,
    studioTargetAllocationIds,
  };
}
