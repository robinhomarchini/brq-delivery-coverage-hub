import type { Person } from "@/data/mockData";
import type { AreaUsage } from "@/lib/repositories";

export interface AreaReference {
  areaId?: string | null;
}

export function buildAreaUsages(people: Person[], territories: AreaReference[] = []): AreaUsage[] {
  const usageByArea = new Map<string, AreaUsage>();

  for (const person of people) {
    if (!person.areaId) continue;
    const usage = getOrCreateUsage(usageByArea, person.areaId);
    usage.peopleCount += 1;
  }

  for (const territory of territories) {
    if (!territory.areaId) continue;
    const usage = getOrCreateUsage(usageByArea, territory.areaId);
    usage.territoryCount += 1;
  }

  return Array.from(usageByArea.values()).sort((first, second) => first.areaId.localeCompare(second.areaId));
}

export function getAreaUsage(usages: AreaUsage[], areaId: string): AreaUsage {
  return usages.find((usage) => usage.areaId === areaId) ?? {
    areaId,
    peopleCount: 0,
    territoryCount: 0,
  };
}

export function getAreaUsageTotal(usage: AreaUsage) {
  return usage.peopleCount + usage.territoryCount;
}

function getOrCreateUsage(usages: Map<string, AreaUsage>, areaId: string) {
  const current = usages.get(areaId);
  if (current) return current;

  const next = { areaId, peopleCount: 0, territoryCount: 0 };
  usages.set(areaId, next);
  return next;
}
