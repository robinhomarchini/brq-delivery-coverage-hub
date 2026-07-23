import type { Area, Customer, Person, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import { getStudioMaintenancePersonId, isStudioRenewalEligibleForFarmer } from "@/lib/studio-renewal-rollup";

export type TargetAllocationDuplicateItem = {
  id: string;
  amount: number;
  ownAmount?: number;
  notes?: string;
  recommendedAction: "keep" | "review_remove" | "review_create";
  reason: string;
};

export type TargetAllocationContainedStudioItem = {
  id?: string;
  areaId: string;
  areaName: string;
  amount: number;
  hunterAmount: number;
  maintenanceAmount: number;
};

export type TargetAllocationDuplicateGroup = {
  issueType: "duplicate_key" | "contained_studio_review" | "studio_without_person_total";
  key: string;
  customerId: string;
  customerName: string;
  personId: string;
  personName: string;
  targetType: TargetAllocation["type"];
  year: number;
  totalAmount: number;
  suggestedAmount: number;
  duplicateAmount: number;
  containedStudioAmount?: number;
  currentAmount?: number;
  currentOwnAmount?: number;
  items: TargetAllocationDuplicateItem[];
  containedStudioItems?: TargetAllocationContainedStudioItem[];
};

export function findTargetAllocationDuplicates({
  allocations,
  customers,
  people,
  studioAllocations = [],
  areas = [],
}: {
  allocations: TargetAllocation[];
  customers: Customer[];
  people: Person[];
  studioAllocations?: StudioTargetAllocation[];
  areas?: Area[];
}): TargetAllocationDuplicateGroup[] {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const groups = new Map<string, TargetAllocation[]>();

  allocations
    .filter((allocation) => allocation.type === "hunter" || allocation.type === "farmer_renewal")
    .forEach((allocation) => {
      const key = getTargetAllocationDuplicateKey(allocation);
      groups.set(key, [...(groups.get(key) ?? []), allocation]);
    });

  const duplicateGroups = Array.from(groups.entries())
    .filter(([, groupAllocations]) => groupAllocations.length > 1)
    .map(([key, groupAllocations]) => buildDuplicateGroup(key, groupAllocations, customersById, peopleById));
  const containedStudioReviewGroups = Array.from(groups.values())
    .map((groupAllocations) => buildContainedStudioReviewGroup({
      allocation: selectContainedStudioReviewAllocation(groupAllocations),
      customersById,
      peopleById,
      areasById,
      studioAllocations,
    }))
    .filter((group): group is TargetAllocationDuplicateGroup => Boolean(group));
  const studioWithoutPersonTotalGroups = buildStudioWithoutPersonTotalGroups({
    studioAllocations,
    groups,
    customersById,
    peopleById,
    areasById,
  });

  return [...duplicateGroups, ...containedStudioReviewGroups, ...studioWithoutPersonTotalGroups]
    .sort((first, second) =>
      first.customerName.localeCompare(second.customerName, "pt-BR")
      || first.personName.localeCompare(second.personName, "pt-BR")
      || first.targetType.localeCompare(second.targetType, "pt-BR")
      || first.year - second.year
    );
}

function buildStudioWithoutPersonTotalGroups({
  studioAllocations,
  groups,
  customersById,
  peopleById,
  areasById,
}: {
  studioAllocations: StudioTargetAllocation[];
  groups: Map<string, TargetAllocation[]>;
  customersById: Map<string, Customer>;
  peopleById: Map<string, Person>;
  areasById: Map<string, Area>;
}) {
  return studioAllocations.flatMap((studio) => {
    const rows: TargetAllocationDuplicateGroup[] = [];
    const areaName = areasById.get(studio.areaId)?.name ?? studio.areaId;
    if (studio.hunterPersonId && studio.hunterAmount > 0.01) {
      const key = getTargetAllocationKey({
        customerId: studio.customerId,
        personId: studio.hunterPersonId,
        type: "hunter",
        year: studio.year,
      });
      if (!groups.has(key)) {
        rows.push(buildMissingTargetForStudioGroup({
          studio,
          personId: studio.hunterPersonId,
          targetType: "hunter",
          amount: studio.hunterAmount,
          areaName,
          customersById,
          peopleById,
        }));
      }
    }

    const maintenancePersonId = getStudioMaintenancePersonId(studio);
    if (maintenancePersonId && studio.maintenanceAmount > 0.01) {
      const key = getTargetAllocationKey({
        customerId: studio.customerId,
        personId: maintenancePersonId,
        type: "farmer_renewal",
        year: studio.year,
      });
      if (!groups.has(key)) {
        rows.push(buildMissingTargetForStudioGroup({
          studio,
          personId: maintenancePersonId,
          targetType: "farmer_renewal",
          amount: studio.maintenanceAmount,
          areaName,
          customersById,
          peopleById,
        }));
      }
    }
    return rows;
  });
}

function buildMissingTargetForStudioGroup({
  studio,
  personId,
  targetType,
  amount,
  areaName,
  customersById,
  peopleById,
}: {
  studio: StudioTargetAllocation;
  personId: string;
  targetType: TargetAllocation["type"];
  amount: number;
  areaName: string;
  customersById: Map<string, Customer>;
  peopleById: Map<string, Person>;
}): TargetAllocationDuplicateGroup {
  const customer = customersById.get(studio.customerId);
  const person = peopleById.get(personId);
  const containedStudioItem = makeContainedStudioItem(studio, new Map([[studio.areaId, { id: studio.areaId, name: areaName, description: "" }]]), amount);
  return {
    issueType: "studio_without_person_total",
    key: `${getTargetAllocationKey({
      customerId: studio.customerId,
      personId,
      type: targetType,
      year: studio.year,
    })}::studio-without-person-total::${studio.id ?? studio.areaId}`,
    customerId: studio.customerId,
    customerName: customer?.name ?? studio.customerId,
    personId,
    personName: person?.name ?? personId,
    targetType,
    year: studio.year,
    totalAmount: 0,
    suggestedAmount: amount,
    duplicateAmount: amount,
    containedStudioAmount: amount,
    currentAmount: 0,
    currentOwnAmount: 0,
    containedStudioItems: [containedStudioItem],
    items: [{
      id: `sem-meta-total:${studio.id ?? studio.areaId}`,
      amount: 0,
      ownAmount: 0,
      recommendedAction: "review_create",
      reason: "Existe registro de Studio com valor para esta pessoa, mas não há meta total correspondente em Metas por Pessoa.",
    }],
  };
}

function buildDuplicateGroup(
  key: string,
  allocations: TargetAllocation[],
  customersById: Map<string, Customer>,
  peopleById: Map<string, Person>,
): TargetAllocationDuplicateGroup {
  const sortedAllocations = [...allocations].sort((first, second) =>
    second.amount - first.amount
    || getOwnAmountOrZero(second) - getOwnAmountOrZero(first)
    || first.id.localeCompare(second.id, "pt-BR")
  );
  const canonical = sortedAllocations[0] as TargetAllocation;
  const customer = customersById.get(canonical.customerId);
  const person = peopleById.get(canonical.personId);
  const totalAmount = allocations.reduce((total, allocation) => total + allocation.amount, 0);
  const suggestedAmount = canonical.amount;

  return {
    issueType: "duplicate_key",
    key,
    customerId: canonical.customerId,
    customerName: customer?.name ?? canonical.customerId,
    personId: canonical.personId,
    personName: person?.name ?? canonical.personId,
    targetType: canonical.type,
    year: canonical.year,
    totalAmount,
    suggestedAmount,
    duplicateAmount: Math.max(totalAmount - suggestedAmount, 0),
    items: sortedAllocations.map((allocation, index) => ({
      id: allocation.id,
      amount: allocation.amount,
      ownAmount: allocation.ownAmount,
      notes: allocation.notes,
      recommendedAction: index === 0 ? "keep" : "review_remove",
      reason: index === 0
        ? "Maior valor atual encontrado para esta chave."
        : "Mesmo cliente, pessoa, tipo e ano; provável duplicata a remover após confirmação.",
    })),
  };
}

function buildContainedStudioReviewGroup({
  allocation,
  customersById,
  peopleById,
  areasById,
  studioAllocations,
}: {
  allocation: TargetAllocation;
  customersById: Map<string, Customer>;
  peopleById: Map<string, Person>;
  areasById: Map<string, Area>;
  studioAllocations: StudioTargetAllocation[];
}): TargetAllocationDuplicateGroup | null {
  const person = peopleById.get(allocation.personId);
  const containedStudioItems = getContainedStudioItemsForAllocation({
    allocation,
    person,
    areasById,
    studioAllocations,
  });
  const containedStudioAmount = containedStudioItems.reduce((total, item) => total + item.amount, 0);
  const currentOwnAmount = allocation.ownAmount ?? Math.max(allocation.amount - containedStudioAmount, 0);
  if (containedStudioAmount <= 0.01 || currentOwnAmount <= containedStudioAmount + 0.01) return null;

  const customer = customersById.get(allocation.customerId);
  const suggestedAmount = Math.max(currentOwnAmount - containedStudioAmount, 0);
  return {
    issueType: "contained_studio_review" as const,
    key: `${getTargetAllocationDuplicateKey(allocation)}::contained-studio-review`,
    customerId: allocation.customerId,
    customerName: customer?.name ?? allocation.customerId,
    personId: allocation.personId,
    personName: person?.name ?? allocation.personId,
    targetType: allocation.type,
    year: allocation.year,
    totalAmount: allocation.amount,
    suggestedAmount,
    duplicateAmount: containedStudioAmount,
    containedStudioAmount,
    currentAmount: allocation.amount,
    currentOwnAmount,
    containedStudioItems,
    items: [{
      id: allocation.id,
      amount: allocation.amount,
      ownAmount: allocation.ownAmount,
      notes: allocation.notes,
      recommendedAction: "review_remove",
      reason: "Há Studio contido para a mesma pessoa/cliente. Revise se a Meta Squads/Times já inclui esse Studio.",
    }],
  };
}

function selectContainedStudioReviewAllocation(allocations: TargetAllocation[]) {
  return [...allocations].sort((first, second) =>
    second.amount - first.amount
    || getOwnAmountOrZero(second) - getOwnAmountOrZero(first)
    || first.id.localeCompare(second.id, "pt-BR")
  )[0] as TargetAllocation;
}

function getContainedStudioItemsForAllocation({
  allocation,
  person,
  areasById,
  studioAllocations,
}: {
  allocation: TargetAllocation;
  person?: Person;
  areasById: Map<string, Area>;
  studioAllocations: StudioTargetAllocation[];
}) {
  if (allocation.type === "hunter") {
    return studioAllocations
      .filter((studio) =>
        studio.customerId === allocation.customerId
        && studio.year === allocation.year
        && studio.hunterPersonId === allocation.personId
        && studio.hunterAmount > 0.01
      )
      .map((studio) => makeContainedStudioItem(studio, areasById, studio.hunterAmount));
  }

  if (allocation.type === "farmer_renewal") {
    return studioAllocations
      .filter((studio) => {
        const maintenancePersonId = getStudioMaintenancePersonId(studio);
        const areaName = areasById.get(studio.areaId)?.name ?? studio.areaId;
        return studio.customerId === allocation.customerId
          && studio.year === allocation.year
          && maintenancePersonId === allocation.personId
          && isStudioRenewalEligibleForFarmer(areaName, person, {
            explicitMaintenancePerson: studio.maintenancePersonId === allocation.personId,
          });
      })
      .filter((studio) => studio.maintenanceAmount > 0.01)
      .map((studio) => makeContainedStudioItem(studio, areasById, studio.maintenanceAmount));
  }

  return [];
}

function makeContainedStudioItem(
  studio: StudioTargetAllocation,
  areasById: Map<string, Area>,
  amount: number,
): TargetAllocationContainedStudioItem {
  return {
    id: studio.id,
    areaId: studio.areaId,
    areaName: areasById.get(studio.areaId)?.name ?? studio.areaId,
    amount,
    hunterAmount: studio.hunterAmount,
    maintenanceAmount: studio.maintenanceAmount,
  };
}

function getTargetAllocationDuplicateKey(allocation: TargetAllocation) {
  return getTargetAllocationKey(allocation);
}

function getTargetAllocationKey(allocation: Pick<TargetAllocation, "customerId" | "personId" | "type" | "year">) {
  return [
    allocation.customerId,
    allocation.personId,
    allocation.type,
    allocation.year,
  ].join("::");
}

function getOwnAmountOrZero(allocation: TargetAllocation) {
  return allocation.ownAmount ?? 0;
}
