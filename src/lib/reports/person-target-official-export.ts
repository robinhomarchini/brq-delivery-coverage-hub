import type { RoleType } from "@/data/mockData";
import { isHunterRole } from "@/lib/roles";
import { getStudioMaintenancePersonId, getTargetOwnAmount, isStudioRenewalEligibleForFarmer } from "@/lib/studio-renewal-rollup";
import { toFileSlug } from "@/lib/utils";

export type ReportView = "people" | "clients" | "areas" | "hunters" | "hunterClients" | "specialistHunters" | "directors";

export type OfficialTargetRow = {
  businessUnitArea: string;
  executive: string;
  customerName: string;
  billingCustomer: string;
  businessUnit: string;
  totalTarget: number;
  farmerRenewal: number;
  hunter: number;
  hunterShare: number;
  rowStyle: "regular" | "subtotal" | "total";
};

export type OfficialTargetItem = {
  executive: string;
  customerName: string;
  billingCustomer?: string;
  businessUnit?: string;
  farmerRenewal: number;
  hunter: number;
};

export type OfficialPeopleRow = {
  personId: string;
  personName: string;
};

export type OfficialHunterRow = {
  hunterName: string;
  totalHunter: number;
};

export type OfficialHunterDetailRow = {
  hunterName: string;
  customerName: string;
  segment: string;
  areaName: string;
  amount: number;
};

export type OfficialDirectorDetailRow = {
  personName: string;
  customerName: string;
  segment: string;
  areaName: string;
  amount: number;
};

export type OfficialAreaRow = {
  areaName: string;
  clients: Array<{ customerName: string; maintenance: number; hunter: number }>;
};

export type OfficialAreaDetailRow = {
  areaName: string;
  customerName: string;
  segment: "Studio Hunter" | "Studio Manutenção";
  amount: number;
};

export type OfficialHunterClientRow = {
  hunterName: string;
  customerName: string;
  detailName: string;
  segment: string;
  hunterAmount: number;
  maintenanceAmount: number;
};

export type OfficialPerson = {
  id: string;
  name: string;
  roleType: RoleType;
  active: boolean;
  clientIds: string[];
};

export type OfficialTargetAllocation = {
  id: string;
  customerId: string;
  personId: string;
  type: string;
  year: number;
  amount: number;
  ownAmount?: number;
};

export type OfficialStudioAllocation = {
  id?: string;
  customerId: string;
  areaId: string;
  hunterPersonId?: string;
  maintenancePersonId?: string;
  year: number;
  hunterAmount: number;
  maintenanceAmount: number;
};

const hunterOwnTotalLabel = "Meta Hunter atual";
export const officialBusinessUnitArea = "Financial";
export const officialDefaultBillingCustomer = "";
export const officialDefaultBusinessUnit = "Financial";

export function buildOfficialRowsForView({
  view,
  peopleRows,
  hunterRows,
  hunterDetailRows,
  directorDetailRows,
  areaRows,
  areaDetailRows,
  hunterClientRows,
  selectedHunterNames,
  selectedAreaNames,
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  year,
}: {
  view: ReportView;
  peopleRows: OfficialPeopleRow[];
  hunterRows: OfficialHunterRow[];
  hunterDetailRows: OfficialHunterDetailRow[];
  directorDetailRows: OfficialDirectorDetailRow[];
  areaRows: OfficialAreaRow[];
  areaDetailRows: OfficialAreaDetailRow[];
  hunterClientRows: OfficialHunterClientRow[];
  selectedHunterNames: string[];
  selectedAreaNames: string[];
  people: OfficialPerson[];
  allocations: OfficialTargetAllocation[];
  studioAllocations: OfficialStudioAllocation[];
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  year: number;
}) {
  if (view === "hunters") {
    if (selectedHunterNames.length) {
      return buildOfficialGroupedRows(buildOfficialHunterItemsFromDetails(hunterDetailRows));
    }
    return buildOfficialGroupedRows(hunterRows.map((row) => ({
      executive: row.hunterName,
      customerName: hunterOwnTotalLabel,
      farmerRenewal: 0,
      hunter: row.totalHunter,
    })));
  }

  if (view === "hunterClients") {
    return buildOfficialGroupedRows(hunterClientRows.map((row) => ({
      executive: row.hunterName,
      customerName: row.customerName,
      billingCustomer: getOfficialBillingCustomerForSegment(row.segment, row.detailName),
      farmerRenewal: row.maintenanceAmount,
      hunter: row.hunterAmount,
    })));
  }

  if (view === "directors") {
    return buildOfficialGroupedRows(directorDetailRows.map((row) => ({
      executive: row.personName,
      customerName: row.customerName,
      billingCustomer: getOfficialBillingCustomerForSegment(row.segment, row.areaName),
      farmerRenewal: row.segment === "Renovação + Ampliação" || row.segment === "Studio Manutenção" ? row.amount : 0,
      hunter: row.segment === "Meta Hunter" || row.segment === "Studio Hunter" ? row.amount : 0,
    })));
  }

  if (view === "areas") {
    if (selectedAreaNames.length) {
      return buildOfficialGroupedRows(areaDetailRows.map((row) => ({
        executive: row.areaName,
        customerName: row.customerName,
        billingCustomer: row.areaName,
        farmerRenewal: row.segment === "Studio Manutenção" ? row.amount : 0,
        hunter: row.segment === "Studio Hunter" ? row.amount : 0,
      })));
    }
    return buildOfficialGroupedRows(areaRows.flatMap((row) => row.clients.map((client) => ({
      executive: row.areaName,
      customerName: client.customerName,
      billingCustomer: row.areaName,
      farmerRenewal: client.maintenance,
      hunter: client.hunter,
    }))));
  }

  return buildOfficialPeopleRowsFromSources({
    peopleRows,
    people,
    allocations,
    studioAllocations,
    customerNames,
    areaNames,
    year,
  });
}

function buildOfficialGroupedRows(items: OfficialTargetItem[]) {
  const byExecutive = new Map<string, Map<string, OfficialTargetItem>>();
  items
    .filter((item) => item.farmerRenewal + item.hunter > 0)
    .forEach((item) => {
      const customerMap = byExecutive.get(item.executive) ?? new Map<string, OfficialTargetItem>();
      const itemKey = [
        item.customerName,
        item.billingCustomer ?? officialDefaultBillingCustomer,
        item.businessUnit ?? officialDefaultBusinessUnit,
      ].join("\u0000");
      const current = customerMap.get(itemKey) ?? {
        executive: item.executive,
        customerName: item.customerName,
        billingCustomer: item.billingCustomer ?? officialDefaultBillingCustomer,
        businessUnit: item.businessUnit ?? officialDefaultBusinessUnit,
        farmerRenewal: 0,
        hunter: 0,
      };
      current.farmerRenewal += item.farmerRenewal;
      current.hunter += item.hunter;
      customerMap.set(itemKey, current);
      byExecutive.set(item.executive, customerMap);
    });

  const rows: OfficialTargetRow[] = [];
  Array.from(byExecutive.entries())
    .sort(([first], [second]) => first.localeCompare(second, "pt-BR"))
    .forEach(([executive, customerMap]) => {
      let executiveFarmer = 0;
      let executiveHunter = 0;
      Array.from(customerMap.values())
        .sort((first, second) =>
          first.customerName.localeCompare(second.customerName, "pt-BR")
          || (first.billingCustomer ?? "").localeCompare(second.billingCustomer ?? "", "pt-BR")
        )
        .forEach((amounts) => {
          executiveFarmer += amounts.farmerRenewal;
          executiveHunter += amounts.hunter;
          rows.push(makeOfficialRow({
            executive,
            customerName: amounts.customerName,
            billingCustomer: amounts.billingCustomer ?? officialDefaultBillingCustomer,
            businessUnit: amounts.businessUnit ?? officialDefaultBusinessUnit,
            farmerRenewal: amounts.farmerRenewal,
            hunter: amounts.hunter,
            rowStyle: "regular",
          }));
        });
      rows.push(makeOfficialRow({
        executive,
        customerName: "Subtotal (na meta)",
        billingCustomer: getSubtotalBillingCustomer(customerMap),
        farmerRenewal: executiveFarmer,
        hunter: executiveHunter,
        rowStyle: "subtotal",
      }));
    });

  const totalFarmer = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.farmerRenewal, 0);
  const totalHunter = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.hunter, 0);
  if (rows.length) {
    rows.push(makeOfficialRow({
      executive: "TOTAL GERAL (na meta)",
      customerName: "",
      billingCustomer: officialDefaultBillingCustomer,
      farmerRenewal: totalFarmer,
      hunter: totalHunter,
      rowStyle: "total",
    }));
  }
  return rows;
}

function buildOfficialHunterItemsFromDetails(rows: OfficialHunterDetailRow[]) {
  return rows
    .filter((row) => row.amount > 0)
    .map((row) => ({
      executive: row.hunterName,
      customerName: row.customerName,
      billingCustomer: getOfficialBillingCustomerForSegment(row.segment, row.areaName),
      farmerRenewal: 0,
      hunter: row.amount,
    }));
}

function getOfficialBillingCustomerForSegment(segment: string, studioName: string) {
  return segment.includes("Studio") ? studioName : officialDefaultBillingCustomer;
}

function getSubtotalBillingCustomer(customerMap: Map<string, OfficialTargetItem>) {
  const billingCustomers = Array.from(customerMap.values())
    .map((item) => item.billingCustomer ?? officialDefaultBillingCustomer)
    .filter((billingCustomer) => billingCustomer.length > 0);
  const uniqueBillingCustomers = new Set(billingCustomers);
  return uniqueBillingCustomers.size === 1 ? billingCustomers[0] ?? officialDefaultBillingCustomer : officialDefaultBillingCustomer;
}

function buildOfficialPeopleRowsFromSources({
  peopleRows,
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  year,
}: {
  peopleRows: OfficialPeopleRow[];
  people: OfficialPerson[];
  allocations: OfficialTargetAllocation[];
  studioAllocations: OfficialStudioAllocation[];
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  year: number;
}) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  const studioRenewalByPersonCustomer = buildStudioRenewalTotalsByPersonCustomer(studioAllocations, year, people, areaNames);
  const customerIdsInScope = new Set<string>();
  const rows: OfficialTargetRow[] = [];

  peopleRows.forEach((personRow) => {
    const person = peopleById.get(personRow.personId);
    if (!person) return;

    const personAllocations = allocations.filter((allocation) =>
      allocation.year === year
      && allocation.personId === personRow.personId
      && allocation.type !== "studio"
      && allocation.amount > 0
    );
    const personStudioHunterAllocations = studioAllocations.filter((allocation) =>
      allocation.year === year
      && allocation.hunterAmount > 0
      && getEffectiveStudioHunterPersonId(allocation, people, allocations) === personRow.personId
    );
    const personStudioRenewalCustomerIds = Array.from(studioRenewalByPersonCustomer.keys())
      .filter((key) => key.startsWith(`${personRow.personId}:`))
      .map((key) => key.slice(personRow.personId.length + 1));
    const customerIds = Array.from(new Set([
      ...personAllocations.map((allocation) => allocation.customerId),
      ...personStudioHunterAllocations.map((allocation) => allocation.customerId),
      ...personStudioRenewalCustomerIds,
    ])).sort((first, second) =>
      (customerNames.get(first) ?? first).localeCompare(customerNames.get(second) ?? second, "pt-BR")
    );

    let personFarmer = 0;
    let personHunter = 0;

    customerIds.forEach((customerId) => {
      customerIdsInScope.add(customerId);
      const customerName = customerNames.get(customerId) ?? customerId;
      const directHunterOwn = personAllocations
        .filter((allocation) => allocation.customerId === customerId && allocation.type === "hunter")
        .reduce((total, allocation) => {
          const studioHunterForCustomer = studioByHunterCustomer.get(`${personRow.personId}:${customerId}`) ?? 0;
          return total + getHunterOwnAmount(allocation, studioHunterForCustomer);
        }, 0);
      const studioRenewalForCustomer = studioRenewalByPersonCustomer.get(`${personRow.personId}:${customerId}`) ?? 0;
      const farmerRenewalOwn = getTargetOwnAmountFromAllocations(
        personAllocations.filter((allocation) => allocation.customerId === customerId && allocation.type === "farmer_renewal"),
        studioRenewalForCustomer,
      );

      if (directHunterOwn > 0.01 || farmerRenewalOwn > 0.01) {
        rows.push(makeOfficialRow({
          executive: personRow.personName,
          customerName,
          billingCustomer: officialDefaultBillingCustomer,
          farmerRenewal: farmerRenewalOwn,
          hunter: directHunterOwn,
          rowStyle: "regular",
        }));
        personFarmer += farmerRenewalOwn;
        personHunter += directHunterOwn;
      }

      personStudioHunterAllocations
        .filter((allocation) => allocation.customerId === customerId)
        .sort((first, second) =>
          (areaNames.get(first.areaId) ?? first.areaId).localeCompare(areaNames.get(second.areaId) ?? second.areaId, "pt-BR")
        )
        .forEach((allocation) => {
          const studioName = areaNames.get(allocation.areaId) ?? allocation.areaId;
          rows.push(makeOfficialRow({
            executive: personRow.personName,
            customerName,
            billingCustomer: studioName,
            farmerRenewal: 0,
            hunter: allocation.hunterAmount,
            rowStyle: "regular",
          }));
          personHunter += allocation.hunterAmount;
        });

      studioAllocations
        .filter((allocation) => {
          const maintenancePersonId = getStudioMaintenancePersonId(allocation);
          return allocation.year === year
            && allocation.customerId === customerId
            && maintenancePersonId === personRow.personId
            && allocation.maintenanceAmount > 0
            && isStudioRenewalEligibleForFarmer(areaNames.get(allocation.areaId) ?? allocation.areaId, person, {
              explicitMaintenancePerson: allocation.maintenancePersonId === personRow.personId,
            });
        })
        .sort((first, second) =>
          (areaNames.get(first.areaId) ?? first.areaId).localeCompare(areaNames.get(second.areaId) ?? second.areaId, "pt-BR")
        )
        .forEach((allocation) => {
          const studioName = areaNames.get(allocation.areaId) ?? allocation.areaId;
          rows.push(makeOfficialRow({
            executive: personRow.personName,
            customerName,
            billingCustomer: studioName,
            farmerRenewal: allocation.maintenanceAmount,
            hunter: 0,
            rowStyle: "regular",
          }));
          personFarmer += allocation.maintenanceAmount;
        });
    });

    if (personFarmer > 0.01 || personHunter > 0.01) {
      rows.push(makeOfficialRow({
        executive: personRow.personName,
        customerName: "Subtotal (na meta)",
        billingCustomer: officialDefaultBillingCustomer,
        farmerRenewal: personFarmer,
        hunter: personHunter,
        rowStyle: "subtotal",
      }));
    }
  });

  const maintenanceRows = buildOfficialStudioMaintenanceRows({
    studioAllocations,
    people,
    customerNames,
    areaNames,
    year,
    customerIdsInScope,
  });
  const totalFarmer = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.farmerRenewal, 0)
    + maintenanceRows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.farmerRenewal, 0);
  const totalHunter = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.hunter, 0);
  const allRows = [...rows, ...maintenanceRows];

  if (allRows.length) {
    allRows.push(makeOfficialRow({
      executive: "TOTAL GERAL (na meta)",
      customerName: "",
      billingCustomer: officialDefaultBillingCustomer,
      farmerRenewal: totalFarmer,
      hunter: totalHunter,
      rowStyle: "total",
    }));
  }

  return allRows;
}

function buildOfficialStudioMaintenanceRows({
  studioAllocations,
  people,
  customerNames,
  areaNames,
  year,
  customerIdsInScope,
}: {
  studioAllocations: OfficialStudioAllocation[];
  people: Array<{ id: string; roleType: RoleType; active: boolean }>;
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  year: number;
  customerIdsInScope: Set<string>;
}) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rows: OfficialTargetRow[] = [];
  const maintenanceItems = studioAllocations
    .filter((allocation) =>
      allocation.year === year
      && allocation.maintenanceAmount > 0
      && (!customerIdsInScope.size || customerIdsInScope.has(allocation.customerId))
      && !isStudioRenewalEligibleForFarmer(areaNames.get(allocation.areaId) ?? allocation.areaId, getStudioMaintenancePersonId(allocation) ? peopleById.get(getStudioMaintenancePersonId(allocation) as string) : undefined, {
        explicitMaintenancePerson: Boolean(allocation.maintenancePersonId),
      })
    )
    .map((allocation) => ({
      studioName: areaNames.get(allocation.areaId) ?? allocation.areaId,
      customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
      maintenanceAmount: allocation.maintenanceAmount,
    }))
    .sort((first, second) =>
      first.studioName.localeCompare(second.studioName, "pt-BR")
      || first.customerName.localeCompare(second.customerName, "pt-BR")
    );

  let maintenanceTotal = 0;
  maintenanceItems.forEach((item) => {
    maintenanceTotal += item.maintenanceAmount;
    rows.push(makeOfficialRow({
      executive: item.studioName,
      customerName: item.customerName,
      billingCustomer: item.studioName,
      farmerRenewal: item.maintenanceAmount,
      hunter: 0,
      rowStyle: "regular",
    }));
  });

  if (maintenanceTotal > 0.01) {
    rows.push(makeOfficialRow({
      executive: "Studio Manutenção",
      customerName: "Subtotal (na meta)",
      billingCustomer: officialDefaultBillingCustomer,
      farmerRenewal: maintenanceTotal,
      hunter: 0,
      rowStyle: "subtotal",
    }));
  }

  return rows;
}

function makeOfficialRow({
  executive,
  customerName,
  billingCustomer,
  businessUnit = officialDefaultBusinessUnit,
  farmerRenewal,
  hunter,
  rowStyle,
}: {
  executive: string;
  customerName: string;
  billingCustomer: string;
  businessUnit?: string;
  farmerRenewal: number;
  hunter: number;
  rowStyle: "regular" | "subtotal" | "total";
}): OfficialTargetRow {
  const totalTarget = farmerRenewal + hunter;
  return {
    businessUnitArea: officialBusinessUnitArea,
    executive,
    customerName,
    billingCustomer,
    businessUnit,
    totalTarget,
    farmerRenewal,
    hunter,
    hunterShare: totalTarget > 0 ? hunter / totalTarget : 0,
    rowStyle,
  };
}

export function getOfficialFilenameSuffix({
  view,
  peopleRows,
  selectedHunterNames,
  selectedAreaNames,
  selectedHunterClientName,
  selectedDirectorName,
}: {
  view: ReportView;
  peopleRows: OfficialPeopleRow[];
  selectedHunterNames: string[];
  selectedAreaNames: string[];
  selectedHunterClientName: string;
  selectedDirectorName: string;
}) {
  if (view === "people" && peopleRows.length === 1) return `-${toFileSlug(peopleRows[0].personName)}`;
  if (view === "hunters" && selectedHunterNames.length === 1) return `-${toFileSlug(selectedHunterNames[0])}`;
  if (view === "hunters" && selectedHunterNames.length > 1) return "-selecao";
  if (view === "hunterClients" && selectedHunterClientName) return `-${toFileSlug(selectedHunterClientName)}`;
  if (view === "areas" && selectedAreaNames.length === 1) return `-${toFileSlug(selectedAreaNames[0])}`;
  if (view === "areas" && selectedAreaNames.length > 1) return "-selecao";
  if (view === "directors" && selectedDirectorName) return `-${toFileSlug(selectedDirectorName)}`;
  return "";
}

function buildStudioHunterTotalsByHunterCustomer(
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

function buildStudioRenewalTotalsByPersonCustomer(
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

function getTargetOwnAmountFromAllocations(
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

function getHunterOwnAmount(
  allocation: { amount: number; ownAmount?: number },
  studioHunterAmount: number,
) {
  return Math.max(allocation.ownAmount ?? allocation.amount - studioHunterAmount, 0);
}

function getEffectiveStudioHunterPersonId(
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
