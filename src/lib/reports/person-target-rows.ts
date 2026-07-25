import type { RoleType } from "@/data/mockData";
import {
  buildStudioHunterTotalsByHunterCustomer,
  buildStudioRenewalTotalsByPersonCustomer,
  getContainedOwnAmount,
  getTargetOwnAmountFromAllocations,
} from "@/lib/reports/person-target-rollups";

export type PeopleRow = {
  personId: string;
  personName: string;
  email?: string;
  roleType: RoleType;
  directorId?: string;
  customerCount: number;
  customerNames: string[];
  hunter: number;
  farmerRenewal: number;
  total: number;
  customerBreakdown: Array<{
    customerId: string;
    customerName: string;
    hunter: number;
    farmerRenewal: number;
    total: number;
  }>;
};

export function buildPeopleRows(
  people: Array<{ id: string; name: string; email?: string; roleType: RoleType; directorId?: string; active: boolean; clientIds: string[] }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>,
  studioAllocations: Array<{ customerId: string; areaId: string; hunterPersonId?: string; maintenancePersonId?: string; year: number; hunterAmount: number; maintenanceAmount: number }>,
  customerNames: Map<string, string>,
  areaNames: Map<string, string>,
  year: number,
): PeopleRow[] {
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  const studioRenewalByPersonCustomer = buildStudioRenewalTotalsByPersonCustomer(studioAllocations, year, people, areaNames);
  return people.map((person) => {
    const personAllocations = allocations.filter((allocation) =>
      allocation.personId === person.id
      && allocation.year === year
      && allocation.type !== "studio"
    );
    const directHunter = personAllocations
      .filter((allocation) => allocation.type === "hunter")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const studioCustomerIds = Array.from(studioByHunterCustomer.keys())
      .filter((key) => key.startsWith(`${person.id}:`))
      .map((key) => key.slice(person.id.length + 1));
    const studioRenewalCustomerIds = Array.from(studioRenewalByPersonCustomer.keys())
      .filter((key) => key.startsWith(`${person.id}:`))
      .map((key) => key.slice(person.id.length + 1));
    const customerIds = Array.from(new Set([
      ...personAllocations.map((allocation) => allocation.customerId),
      ...studioCustomerIds,
      ...studioRenewalCustomerIds,
    ]));
    const customerBreakdown = customerIds
      .map((customerId) => {
        const customerAllocations = personAllocations.filter((allocation) => allocation.customerId === customerId);
        const directCustomerHunter = customerAllocations
          .filter((allocation) => allocation.type === "hunter")
          .reduce((total, allocation) => total + allocation.amount, 0);
        const studioRenewal = studioRenewalByPersonCustomer.get(`${person.id}:${customerId}`) ?? 0;
        const customerFarmerRenewal = getTargetOwnAmountFromAllocations(
          customerAllocations.filter((allocation) => allocation.type === "farmer_renewal"),
          studioRenewal,
        ) + studioRenewal;
        const studioHunter = studioByHunterCustomer.get(`${person.id}:${customerId}`) ?? 0;
        const customerHunter = Math.max(directCustomerHunter, studioHunter);

        return {
          customerId,
          customerName: customerNames.get(customerId) ?? customerId,
          hunter: customerHunter,
          farmerRenewal: customerFarmerRenewal,
          total: customerHunter + customerFarmerRenewal,
        };
      })
      .sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName, "pt-BR"));
    const names = customerBreakdown
      .filter((item) => item.total > 0)
      .map((item) => item.customerName)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const hunter = Math.max(
      directHunter,
      customerBreakdown.reduce((total, item) => total + item.hunter, 0),
    );
    const farmerRenewal = customerBreakdown.reduce((total, item) => total + item.farmerRenewal, 0);

    return {
      personId: person.id,
      personName: person.name,
      email: person.email,
      roleType: person.roleType,
      directorId: person.directorId,
      customerCount: names.length,
      customerNames: names,
      hunter,
      farmerRenewal,
      total: hunter + farmerRenewal,
      customerBreakdown,
    };
  });
}
