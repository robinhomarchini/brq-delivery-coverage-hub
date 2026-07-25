import type { RoleType } from "@/data/mockData";
import { isCustomerFarmerResponsibleProfile, isHunterRole, isSpecialistHunterRole } from "@/lib/roles";
import { getStudioMaintenancePersonId } from "@/lib/studio-renewal-rollup";
import type { ReportColumn } from "@/components/shared/report-export-actions";
import { buildStudioHunterTotalsByHunterCustomer, buildStudioRenewalTotalsByPersonCustomer, getEffectiveStudioHunterPersonId, getTargetOwnAmountFromAllocations } from "@/lib/reports/person-target-rollups";
import { getCustomerTotalTarget } from "@/lib/customer-target-total";

export type ClientCoveragePerson = {
  personId: string;
  personName: string;
  roleType: RoleType | string;
  amount: number;
};

export type ClientCoverageRow = {
  customerId: string;
  customerName: string;
  hunters: ClientCoveragePerson[];
  deliveryManagers: ClientCoveragePerson[];
  specialistHunters: ClientCoveragePerson[];
  studios: string[];
  participantCount: number;
  customerTargetTotal: number;
  totalLinkedTarget: number;
  coverageDelta: number;
  huntersText: string;
  deliveryManagersText: string;
  specialistHuntersText: string;
  studiosText: string;
};

export function buildClientCoverageRows({
  customers,
  people,
  allocations,
  studioAllocations,
  specialistAssignments,
  areaNames,
  year,
}: {
  customers: Array<{
    id: string;
    name: string;
    managerResponsibleIds: string[];
    hunterTarget: number;
    farmerRenewalTarget: number;
    studioTarget: number;
    revenue: number;
  }>;
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[]; isManager: boolean }>;
  allocations: Array<{ id: string; customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>;
  studioAllocations: Array<{ id: string; customerId: string; areaId: string; hunterPersonId?: string; maintenancePersonId?: string; year: number; hunterAmount: number; maintenanceAmount: number }>;
  specialistAssignments: Array<{ personId: string; studioTargetAllocationId: string; year: number; assignedAmount?: number }>;
  areaNames: Map<string, string>;
  year: number;
}): ClientCoverageRow[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const studioById = new Map(studioAllocations.map((allocation) => [allocation.id, allocation]));
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  const studioRenewalByPersonCustomer = buildStudioRenewalTotalsByPersonCustomer(studioAllocations, year, people, areaNames);
  const specialistRowsByCustomer = new Map<string, ClientCoveragePerson[]>();

  specialistAssignments
    .filter((assignment) => assignment.year === year)
    .forEach((assignment) => {
      const person = peopleById.get(assignment.personId);
      const allocation = studioById.get(assignment.studioTargetAllocationId);
      if (!person?.active || !isSpecialistHunterRole(person.roleType) || !allocation || allocation.year !== year) return;
      const amount = assignment.assignedAmount ?? allocation.hunterAmount + allocation.maintenanceAmount;
      if (amount <= 0.01) return;
      addClientCoveragePerson(specialistRowsByCustomer, allocation.customerId, {
        personId: person.id,
        personName: person.name,
        roleType: person.roleType,
        amount,
      });
    });

  return customers
    .map((customer) => {
      const customerAllocations = allocations.filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type !== "studio");
      const customerStudioAllocations = studioAllocations.filter((allocation) => allocation.customerId === customer.id && allocation.year === year);
      const hunterPersonIds = new Set<string>();
      const deliveryPersonIds = new Set<string>(customer.managerResponsibleIds);
      const studioNames = new Set<string>();

      people.forEach((person) => {
        if (person.clientIds.includes(customer.id)) {
          if (isHunterRole(person.roleType)) hunterPersonIds.add(person.id);
          if (isCustomerFarmerResponsibleProfile(person.roleType, person.isManager)) deliveryPersonIds.add(person.id);
        }
      });

      customerAllocations.forEach((allocation) => {
        const person = peopleById.get(allocation.personId);
        if (allocation.type === "hunter" || person && isHunterRole(person.roleType)) hunterPersonIds.add(allocation.personId);
        if (allocation.type === "farmer_renewal" || person && isCustomerFarmerResponsibleProfile(person.roleType, person.isManager)) deliveryPersonIds.add(allocation.personId);
      });

      customerStudioAllocations.forEach((allocation) => {
        studioNames.add(areaNames.get(allocation.areaId) ?? allocation.areaId);
        const effectiveHunterId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
        if (effectiveHunterId) hunterPersonIds.add(effectiveHunterId);
        const maintenancePersonId = getStudioMaintenancePersonId(allocation);
        if (maintenancePersonId) deliveryPersonIds.add(maintenancePersonId);
      });

      const primaryHunterId = getPrimaryClientCoverageHunterId(customer.id, people);
      const hunterCandidates = Array.from(hunterPersonIds).map((personId) => {
        const person = peopleById.get(personId);
        const directHunter = customerAllocations
          .filter((allocation) => allocation.personId === personId && allocation.type === "hunter")
          .reduce((total, allocation) => total + allocation.amount, 0);
        const studioHunter = studioByHunterCustomer.get(`${personId}:${customer.id}`) ?? 0;
        return {
          personId,
          personName: person?.name ?? personId,
          roleType: person?.roleType ?? "Hunter",
          amount: Math.max(directHunter, studioHunter),
        };
      });
      const hasHunterWithValue = hunterCandidates.some((person) => person.amount > 0.01);
      const hunters = hunterCandidates.filter((person) =>
        person.amount > 0.01 || (!hasHunterWithValue && person.personId === primaryHunterId)
      );

      const deliveryManagers = Array.from(deliveryPersonIds).map((personId) => {
        const person = peopleById.get(personId);
        const renewalAllocations = customerAllocations.filter((allocation) => allocation.personId === personId && allocation.type === "farmer_renewal");
        const studioRenewal = studioRenewalByPersonCustomer.get(`${personId}:${customer.id}`) ?? 0;
        const ownRenewal = getTargetOwnAmountFromAllocations(renewalAllocations, studioRenewal);
        return {
          personId,
          personName: person?.name ?? personId,
          roleType: person?.roleType ?? "Farmer + Delivery",
          amount: ownRenewal + studioRenewal,
        };
      }).filter((person) => person.amount > 0.01 || customer.managerResponsibleIds.includes(person.personId));

      const specialistHunters = specialistRowsByCustomer.get(customer.id) ?? [];
      const customerTargetTotal = getCustomerTotalTarget(customer);
      const totalLinkedTarget = hunters.reduce((total, person) => total + person.amount, 0)
        + deliveryManagers.reduce((total, person) => total + person.amount, 0);
      const participantIds = new Set([
        ...hunters.map((person) => person.personId),
        ...deliveryManagers.map((person) => person.personId),
        ...specialistHunters.map((person) => person.personId),
      ]);

      return {
        customerId: customer.id,
        customerName: customer.name,
        hunters: sortClientCoveragePeople(hunters),
        deliveryManagers: sortClientCoveragePeople(deliveryManagers),
        specialistHunters: sortClientCoveragePeople(specialistHunters),
        studios: Array.from(studioNames).sort((first, second) => first.localeCompare(second, "pt-BR")),
        participantCount: participantIds.size,
        customerTargetTotal,
        totalLinkedTarget,
        coverageDelta: totalLinkedTarget - customerTargetTotal,
        huntersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(hunters)),
        deliveryManagersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(deliveryManagers)),
        specialistHuntersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(specialistHunters)),
        studiosText: Array.from(studioNames).sort((first, second) => first.localeCompare(second, "pt-BR")).join(", "),
      };
    })
    .filter((row) =>
      row.hunters.length
      || row.deliveryManagers.length
      || row.specialistHunters.length
      || row.studios.length
    )
    .sort((first, second) => first.customerName.localeCompare(second.customerName, "pt-BR"));
}

export function addClientCoveragePerson(
  rowsByCustomer: Map<string, ClientCoveragePerson[]>,
  customerId: string,
  person: ClientCoveragePerson,
) {
  const rows = rowsByCustomer.get(customerId) ?? [];
  const existing = rows.find((row) => row.personId === person.personId);
  if (existing) {
    existing.amount += person.amount;
  } else {
    rows.push({ ...person });
  }
  rowsByCustomer.set(customerId, rows);
}

export function sortClientCoveragePeople(people: ClientCoveragePerson[]) {
  return [...people].sort((first, second) =>
    second.amount - first.amount || first.personName.localeCompare(second.personName, "pt-BR")
  );
}

export function formatClientCoveragePeopleNames(people: ClientCoveragePerson[]) {
  return people.map((person) => person.personName).join(", ");
}

export function getPrimaryClientCoverageHunterId(
  customerId: string,
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
) {
  return people
    .filter((person) => person.active && isHunterRole(person.roleType) && person.clientIds.includes(customerId))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"))[0]?.id ?? "";
}

export function getContainedHunterTotal(ownTotal: number, studioHunterTotal: number) {
  return ownTotal + studioHunterTotal;
}

export function sumClientCoverageTarget(rows: ClientCoverageRow[]) {
  return rows.reduce((total, row) => total + row.totalLinkedTarget, 0);
}

export function sumClientCoverageCustomerTarget(rows: ClientCoverageRow[]) {
  return rows.reduce((total, row) => total + row.customerTargetTotal, 0);
}

export function sumClientCoverageDelta(rows: ClientCoverageRow[]) {
  return rows.reduce((total, row) => total + row.coverageDelta, 0);
}

export function getClientCoverageReportColumns(showValues: boolean): ReportColumn<ClientCoverageRow>[] {
  const columns: ReportColumn<ClientCoverageRow>[] = [
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "huntersText", label: "Hunters", value: (row) => row.huntersText },
    { key: "deliveryManagersText", label: "Delivery / Farmers", value: (row) => row.deliveryManagersText },
    { key: "specialistHuntersText", label: "Hunters Especializados", value: (row) => row.specialistHuntersText },
    { key: "studiosText", label: "Studios", value: (row) => row.studiosText },
    { key: "participantCount", label: "Participantes", value: (row) => row.participantCount, format: "number", align: "right" },
  ];

  if (!showValues) return columns;

  return [
    ...columns,
    { key: "customerTargetTotal", label: "Meta do cliente", value: (row) => row.customerTargetTotal, format: "currency", align: "right" },
    { key: "totalLinkedTarget", label: "Meta ligada", value: (row) => row.totalLinkedTarget, format: "currency", align: "right" },
    { key: "coverageDelta", label: "Diferença", value: (row) => row.coverageDelta, format: "currency", align: "right" },
  ];
}
