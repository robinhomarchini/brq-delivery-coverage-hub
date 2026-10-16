import type { Customer, Person } from "@/data/mockData";
import type { ReportColumn } from "@/lib/report-export";
import { isCustomerFarmerResponsibleProfile, isHunterSelectionRole } from "@/lib/roles";
import { normalizeBusinessName } from "@/lib/utils";

export interface CustomerResponsibilityRow {
  customerId: string;
  customerName: string;
  hunterIds: string[];
  deliveryManagerIds: string[];
  huntersText: string;
  deliveryManagersText: string;
  hasPending: boolean;
  coverageLabel: string;
}

export type CustomerResponsibilitySortKey = "customerName" | "huntersText" | "deliveryManagersText" | "coverageLabel";

export function buildCustomerResponsibilityRows(
  customers: Pick<Customer, "id" | "name" | "managerResponsibleIds">[],
  people: Pick<Person, "id" | "name" | "active" | "roleType" | "isManager" | "clientIds">[],
): CustomerResponsibilityRow[] {
  const activePeopleById = new Map(people.filter((person) => person.active).map((person) => [person.id, person]));
  const assignedPeopleByCustomer = new Map<string, Set<string>>();
  for (const person of activePeopleById.values()) {
    for (const customerId of person.clientIds) {
      const assigned = assignedPeopleByCustomer.get(customerId) ?? new Set<string>();
      assigned.add(person.id);
      assignedPeopleByCustomer.set(customerId, assigned);
    }
  }

  return customers.map((customer) => {
    const assignedIds = assignedPeopleByCustomer.get(customer.id) ?? new Set<string>();
    const managerIds = new Set(customer.managerResponsibleIds);
    const hunters: string[] = [];
    const deliveryManagers: string[] = [];
    const hunterIds: string[] = [];
    const deliveryManagerIds: string[] = [];
    for (const personId of new Set([...assignedIds, ...managerIds])) {
      const person = activePeopleById.get(personId);
      if (!person) continue;
      if (assignedIds.has(personId) && isHunterSelectionRole(person.roleType)) {
        hunters.push(person.name);
        hunterIds.push(personId);
      }
      if (managerIds.has(personId) || assignedIds.has(personId) && isCustomerFarmerResponsibleProfile(person.roleType, person.isManager)) {
        deliveryManagers.push(person.name);
        deliveryManagerIds.push(personId);
      }
    }
    const hasHunter = hunters.length > 0;
    const hasDelivery = deliveryManagers.length > 0;
    const compareNames = (first: string, second: string) => first.localeCompare(second, "pt-BR");
    return {
      customerId: customer.id,
      customerName: customer.name,
      hunterIds,
      deliveryManagerIds,
      huntersText: hunters.sort(compareNames).join(", ") || "Não informado",
      deliveryManagersText: deliveryManagers.sort(compareNames).join(", ") || "Não informado",
      hasPending: !hasHunter || !hasDelivery,
      coverageLabel: hasHunter && hasDelivery ? "Completo"
        : !hasHunter && !hasDelivery ? "Sem responsáveis"
          : !hasHunter ? "Sem Hunter" : "Sem Delivery/Farmer",
    };
  }).sort((first, second) => first.customerName.localeCompare(second.customerName, "pt-BR"));
}

export interface CustomerResponsibilityFilters {
  search?: string;
  hunterId?: string;
  deliveryManagerId?: string;
  coverage?: "all" | "pending" | "complete";
}

export function filterCustomerResponsibilityRows(rows: CustomerResponsibilityRow[], filters: CustomerResponsibilityFilters) {
  const query = normalizeBusinessName(filters.search ?? "");
  return rows.filter((row) =>
    (!query || normalizeBusinessName(`${row.customerName} ${row.huntersText} ${row.deliveryManagersText}`).includes(query))
    && (!filters.hunterId || row.hunterIds.includes(filters.hunterId))
    && (!filters.deliveryManagerId || row.deliveryManagerIds.includes(filters.deliveryManagerId))
    && (filters.coverage !== "pending" || row.hasPending)
    && (filters.coverage !== "complete" || !row.hasPending),
  );
}

export const customerResponsibilityColumns: (ReportColumn<CustomerResponsibilityRow> & { key: CustomerResponsibilitySortKey })[] = [
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "huntersText", label: "Hunters", value: (row) => row.huntersText },
  { key: "deliveryManagersText", label: "Delivery Managers / Farmers", value: (row) => row.deliveryManagersText },
  { key: "coverageLabel", label: "Responsáveis", value: (row) => row.coverageLabel },
];
