import type { StudioTargetAllocation, TargetAllocation } from "@/data/mockData";

export interface ContainedHunterAllocationInput {
  customerId: string;
  year: number;
  targetAllocations: TargetAllocation[];
  studioTargetAllocations: StudioTargetAllocation[];
}

export interface ContainedHunterAllocation {
  directHunter: number;
  studioHunter: number;
  containedHunter: number;
}

export function getContainedHunterAllocation({
  customerId,
  year,
  targetAllocations,
  studioTargetAllocations,
}: ContainedHunterAllocationInput): ContainedHunterAllocation {
  const directByPerson = new Map<string, number>();
  const studioByPerson = new Map<string, number>();

  for (const allocation of targetAllocations) {
    if (allocation.customerId !== customerId || allocation.year !== year || allocation.type !== "hunter") continue;
    directByPerson.set(allocation.personId, roundCurrency((directByPerson.get(allocation.personId) ?? 0) + allocation.amount));
  }

  for (const allocation of studioTargetAllocations) {
    if (allocation.customerId !== customerId || allocation.year !== year || allocation.hunterAmount <= 0) continue;
    const key = allocation.hunterPersonId || `unassigned:${allocation.id}`;
    studioByPerson.set(key, roundCurrency((studioByPerson.get(key) ?? 0) + allocation.hunterAmount));
  }

  const personIds = new Set([...directByPerson.keys(), ...studioByPerson.keys()]);
  const containedHunter = Array.from(personIds).reduce((total, personId) => {
    const direct = directByPerson.get(personId) ?? 0;
    const studio = studioByPerson.get(personId) ?? 0;
    return total + Math.max(direct, studio);
  }, 0);

  return {
    directHunter: roundCurrency(sumValues(directByPerson)),
    studioHunter: roundCurrency(sumValues(studioByPerson)),
    containedHunter: roundCurrency(containedHunter),
  };
}

function sumValues(values: Map<string, number>) {
  return Array.from(values.values()).reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
