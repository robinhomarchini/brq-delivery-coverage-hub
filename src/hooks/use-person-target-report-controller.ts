"use client";

import { useMemo, useState } from "react";
import { useSetSelection } from "@/hooks/use-set-selection";
import { isTargetAssignableRole } from "@/lib/roles";
import { buildDeliveryIndexes } from "@/lib/reports/person-target-indexes";
import { buildPeopleRows, type PeopleRow } from "@/lib/reports/person-target-rows";
import type { SortState } from "@/components/shared/sortable-table-head";
import type { PeopleSortKey, AreaSortKey } from "@/components/reports/views/person-target-view-types";
import type { Customer, Person, RoleType, Area, StudioTargetAllocation } from "@/data/mockData";

type PeopleClientSortKey = "person" | "role" | "customer" | "relationship" | "hunter" | "renewal" | "total";
type HunterSortKey = "hunter" | "role" | "ownHunter" | "studioHunter" | "totalHunter" | "studios";

export interface UsePersonTargetReportControllerParams {
  people: Person[];
  customers: Customer[];
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>;
  studioTargetAllocations: StudioTargetAllocation[];
  areas: Area[];
}

export function usePersonTargetReportController({
  people,
  customers,
  targetAllocations,
  studioTargetAllocations,
  areas,
}: UsePersonTargetReportControllerParams) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("2026");
  const [roleType, setRoleType] = useState("");
  const [view, setView] = useState<"people" | "peopleClients" | "clients" | "areas" | "hunters" | "hunterClients" | "specialistHunters" | "directors">("people");
  const [selectedDirectorId, setSelectedDirectorId] = useState("");
  const [selectedHunterClientId, setSelectedHunterClientId] = useState("");
  const [selectedPeopleClientPersonId, setSelectedPeopleClientPersonId] = useState("");
  const selectedHunterIds = useSetSelection();
  const selectedAreaIds = useSetSelection();
  const selectedPersonIds = useSetSelection();
  const [peopleSort, setPeopleSort] = useState<SortState<PeopleSortKey>>({ key: "total", direction: "desc" });
  const [peopleClientSort, setPeopleClientSort] = useState<SortState<PeopleClientSortKey>>({ key: "customer", direction: "asc" });
  const [areaSort, setAreaSort] = useState<SortState<AreaSortKey>>({ key: "total", direction: "desc" });
  const [hunterSort, setHunterSort] = useState<SortState<HunterSortKey>>({ key: "totalHunter", direction: "desc" });
  const [showClientCoverageValues, setShowClientCoverageValues] = useState(true);
  const [includeNewLogos, setIncludeNewLogos] = useState(false);

  const assignablePeople = useMemo(() => people.filter((person) => person.active && isTargetAssignableRole(person.roleType)), [people]);
  const reportTargetAllocations = useMemo(() => targetAllocations.filter((allocation) => customers.some((customer) => customer.id === allocation.customerId)), [customers, targetAllocations]);
  const reportStudioTargetAllocations = useMemo(() => studioTargetAllocations.filter((allocation) => customers.some((customer) => customer.id === allocation.customerId)), [customers, studioTargetAllocations]);
  const deliveryIndexes = useMemo(() => buildDeliveryIndexes({ customers, areas, people, studioTargetAllocations: reportStudioTargetAllocations, }), [areas, people, customers, reportStudioTargetAllocations]);
  const customerNames = deliveryIndexes.customerNames;
  const areaNames = deliveryIndexes.areaNames;
  const selectedYear = Number(year) || 2026;

  const peopleRows = useMemo(() => buildPeopleRows(assignablePeople, reportTargetAllocations, reportStudioTargetAllocations, customerNames, areaNames, selectedYear), [areaNames, assignablePeople, customerNames, selectedYear, reportStudioTargetAllocations, reportTargetAllocations]);

  function sortPeopleRows(rows: PeopleRow[], sortState: SortState<PeopleSortKey>) {
    if (!sortState) return rows;
    const direction = sortState.direction;
    return [...rows].sort((first, second) => {
      if (sortState.key === "person") return first.personName.localeCompare(second.personName, "pt-BR", { sensitivity: "base", numeric: true });
      if (sortState.key === "role") return first.roleType.localeCompare(second.roleType, "pt-BR", { sensitivity: "base", numeric: true });
      if (sortState.key === "clients") return first.customerNames.length - second.customerNames.length;
      if (sortState.key === "hunter") return first.hunter - second.hunter;
      if (sortState.key === "renewal") return first.farmerRenewal - second.farmerRenewal;
      if (sortState.key === "status") return (first.total > 0 ? 1 : 0) - (second.total > 0 ? 1 : 0);
      return first.total - second.total;
    });
  }

  const filteredPeopleRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortPeopleRows(peopleRows.filter((row) =>
      (!query || `${row.personName} ${row.roleType} ${row.customerNames.join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType)
    ), peopleSort);
  }, [peopleRows, peopleSort, roleType, search]);

  return {
    search, setSearch, year, setYear, roleType, setRoleType, view, setView,
    selectedDirectorId, setSelectedDirectorId, selectedHunterClientId, setSelectedHunterClientId,
    selectedPeopleClientPersonId, setSelectedPeopleClientPersonId,
    selectedHunterIds, selectedAreaIds, selectedPersonIds,
    peopleSort, setPeopleSort, peopleClientSort, setPeopleClientSort, areaSort, setAreaSort, hunterSort, setHunterSort,
    showClientCoverageValues, setShowClientCoverageValues, includeNewLogos, setIncludeNewLogos,
    peopleRows,
    filteredPeopleRows,
  };
}
