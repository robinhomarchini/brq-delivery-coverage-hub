import type { Customer, Person, TargetAllocation } from "@/data/mockData";

export type TargetAllocationDuplicateItem = {
  id: string;
  amount: number;
  ownAmount?: number;
  notes?: string;
  recommendedAction: "keep" | "review_remove";
  reason: string;
};

export type TargetAllocationDuplicateGroup = {
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
  items: TargetAllocationDuplicateItem[];
};

export function findTargetAllocationDuplicates({
  allocations,
  customers,
  people,
}: {
  allocations: TargetAllocation[];
  customers: Customer[];
  people: Person[];
}) {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const groups = new Map<string, TargetAllocation[]>();

  allocations
    .filter((allocation) => allocation.type === "hunter" || allocation.type === "farmer_renewal")
    .forEach((allocation) => {
      const key = getTargetAllocationDuplicateKey(allocation);
      groups.set(key, [...(groups.get(key) ?? []), allocation]);
    });

  return Array.from(groups.entries())
    .filter(([, groupAllocations]) => groupAllocations.length > 1)
    .map(([key, groupAllocations]) => buildDuplicateGroup(key, groupAllocations, customersById, peopleById))
    .sort((first, second) =>
      first.customerName.localeCompare(second.customerName, "pt-BR")
      || first.personName.localeCompare(second.personName, "pt-BR")
      || first.targetType.localeCompare(second.targetType, "pt-BR")
      || first.year - second.year
    );
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

function getTargetAllocationDuplicateKey(allocation: TargetAllocation) {
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
