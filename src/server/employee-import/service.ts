import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmployeeImportApplyResult,
  EmployeeImportManagerGroup,
  EmployeeImportManagerTotal,
  EmployeeImportManualMappings,
  EmployeeImportPreview,
  EmployeeImportUnmatchedPerson,
} from "@/lib/employee-import/types";
import {
  normalizeEmployeeName,
  parseEmployeeImportWorkbook,
  type ParsedEmployeeImportRow,
} from "@/server/employee-import/parser";

type PersonRow = {
  id: string;
  name: string;
  active: boolean;
  is_manager: boolean;
};

type CompensationRow = {
  person_id: string;
  annual_salary: number | string;
};

type ManagerMappingRow = {
  source_key: string;
  source_manager_name: string;
  manager_person_id: string;
};

export async function buildEmployeeImportPreview(input: {
  client: SupabaseClient;
  buffer: Buffer;
  fileName: string;
  manualMappings?: EmployeeImportManualMappings;
}): Promise<EmployeeImportPreview> {
  const parsed = await parseEmployeeImportWorkbook(input.buffer);
  const [peopleResult, compensationResult, mappingsResult] = await Promise.all([
    input.client.from("people").select("id,name,active,is_manager").order("name").limit(5000),
    input.client.from("person_compensations").select("person_id,annual_salary").limit(5000),
    input.client.from("employee_import_manager_mappings")
      .select("source_key,source_manager_name,manager_person_id")
      .limit(500),
  ]);

  if (peopleResult.error) throw new Error("Não foi possível consultar as pessoas do sistema.");
  if (compensationResult.error) throw new Error("Não foi possível consultar os salários atuais.");
  if (mappingsResult.error) throw new Error("Não foi possível consultar os de-paras de gestores.");

  const people = (peopleResult.data ?? []) as PersonRow[];
  const compensations = (compensationResult.data ?? []) as CompensationRow[];
  const savedMappings = (mappingsResult.data ?? []) as ManagerMappingRow[];
  const peopleByName = groupPeopleByNormalizedName(people);
  const compensationByPerson = new Map(
    compensations.map((row) => [row.person_id, Number(row.annual_salary)]),
  );
  const duplicateSourceNames = findDuplicateSourceNames(parsed.rows);
  const matchedPeople: EmployeeImportPreview["matchedPeople"] = [];
  const unmatchedPeople: EmployeeImportUnmatchedPerson[] = [];

  for (const row of parsed.rows) {
    if (row.salary === null) {
      unmatchedPeople.push({ sourceName: row.name, reason: "invalid_salary" });
      continue;
    }
    const matches = peopleByName.get(row.normalizedName) ?? [];
    if (duplicateSourceNames.has(row.normalizedName) || matches.length > 1) {
      unmatchedPeople.push({ sourceName: row.name, reason: "ambiguous" });
      continue;
    }
    const person = matches[0];
    if (!person) {
      unmatchedPeople.push({ sourceName: row.name, reason: "not_found" });
      continue;
    }
    const currentSalary = compensationByPerson.get(person.id) ?? null;
    matchedPeople.push({
      sourceName: row.name,
      personId: person.id,
      personName: person.name,
      currentSalary,
      proposedSalary: row.salary,
      status: currentSalary !== null && cents(currentSalary) === cents(row.salary)
        ? "unchanged"
        : "change",
    });
  }

  const availableManagers = people
    .filter((person) => person.active && person.is_manager)
    .map((person) => ({ id: person.id, name: person.name }))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  const managerById = new Map(availableManagers.map((manager) => [manager.id, manager]));
  const managersByName = groupPeopleByNormalizedName(
    people.filter((person) => person.active && person.is_manager),
  );
  const savedMappingByKey = new Map(savedMappings.map((mapping) => [mapping.source_key, mapping]));
  const managerCounts = countSourceManagers(parsed.rows);
  const managers: EmployeeImportManagerGroup[] = [];

  for (const [sourceKey, group] of managerCounts) {
    const manualManagerId = input.manualMappings?.[sourceKey];
    const manualManager = manualManagerId ? managerById.get(manualManagerId) : undefined;
    const savedMapping = savedMappingByKey.get(sourceKey);
    const savedManager = savedMapping ? managerById.get(savedMapping.manager_person_id) : undefined;
    const exactMatches = managersByName.get(sourceKey) ?? [];
    const exactManager = exactMatches.length === 1 ? exactMatches[0] : undefined;
    const resolved = manualManager ?? savedManager ?? exactManager;
    managers.push({
      sourceKey,
      sourceName: group.sourceName,
      employeeCount: group.employeeCount,
      resolvedManagerId: resolved?.id ?? null,
      resolvedManagerName: resolved?.name ?? null,
      resolution: manualManager
        ? "manual"
        : savedManager
          ? "saved"
          : exactManager
            ? "exact"
            : "unmatched",
    });
  }
  managers.sort((first, second) =>
    second.employeeCount - first.employeeCount
    || first.sourceName.localeCompare(second.sourceName, "pt-BR")
  );

  const managerTotals = buildManagerTotals(managers);
  const rowsWithoutManager = parsed.rows.filter((row) => !row.managerKey).length;
  return {
    sourceFileName: input.fileName,
    sourceRowCount: parsed.rows.length,
    matchedPeople,
    unmatchedPeople,
    managers,
    managerTotals,
    availableManagers,
    rowsWithoutManager,
    summary: {
      salaryChanges: matchedPeople.filter((person) => person.status === "change").length,
      salariesUnchanged: matchedPeople.filter((person) => person.status === "unchanged").length,
      peopleNotFound: unmatchedPeople.filter((person) => person.reason !== "invalid_salary").length,
      invalidSalaryRows: unmatchedPeople.filter((person) => person.reason === "invalid_salary").length,
      unresolvedManagers: managers.filter((manager) => manager.resolution === "unmatched").length,
    },
  };
}

export async function applyEmployeeImport(input: {
  client: SupabaseClient;
  buffer: Buffer;
  fileName: string;
  manualMappings: EmployeeImportManualMappings;
}): Promise<EmployeeImportApplyResult> {
  const preview = await buildEmployeeImportPreview(input);
  if (preview.summary.unresolvedManagers > 0) {
    throw new Error("Resolva todos os gestores sem correspondência antes de confirmar a importação.");
  }

  const salaryRows = preview.matchedPeople.map((person) => ({
    person_id: person.personId,
    salary: person.proposedSalary,
    source_name: person.sourceName,
  }));
  const managerMappings = preview.managers.map((manager) => ({
    source_key: manager.sourceKey,
    source_name: manager.sourceName,
    manager_person_id: manager.resolvedManagerId,
  }));
  const { data, error } = await input.client.rpc("apply_employee_salary_import", {
    p_salary_rows: salaryRows,
    p_manager_mappings: managerMappings,
    p_effective_from: new Date().toISOString().slice(0, 10),
    p_source_file_name: sanitizeFileName(input.fileName),
  });
  if (error) throw new Error("Não foi possível aplicar a importação de funcionários.");

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    salariesChanged: Number(result.salaries_changed ?? 0),
    salariesUnchanged: Number(result.salaries_unchanged ?? 0),
    managerMappingsSaved: Number(result.manager_mappings_saved ?? 0),
    ignoredPeople: preview.unmatchedPeople.length,
  };
}

function groupPeopleByNormalizedName(people: PersonRow[]) {
  const grouped = new Map<string, PersonRow[]>();
  for (const person of people) {
    const key = normalizeEmployeeName(person.name);
    grouped.set(key, [...(grouped.get(key) ?? []), person]);
  }
  return grouped;
}

function findDuplicateSourceNames(rows: ParsedEmployeeImportRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.normalizedName, (counts.get(row.normalizedName) ?? 0) + 1);
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function countSourceManagers(rows: ParsedEmployeeImportRow[]) {
  const counts = new Map<string, { sourceName: string; employeeCount: number }>();
  for (const row of rows) {
    if (!row.managerKey) continue;
    const current = counts.get(row.managerKey);
    counts.set(row.managerKey, {
      sourceName: current?.sourceName ?? row.managerName,
      employeeCount: (current?.employeeCount ?? 0) + 1,
    });
  }
  return counts;
}

function buildManagerTotals(managers: EmployeeImportManagerGroup[]): EmployeeImportManagerTotal[] {
  const totals = new Map<string, EmployeeImportManagerTotal>();
  for (const manager of managers) {
    if (!manager.resolvedManagerId || !manager.resolvedManagerName) continue;
    const current = totals.get(manager.resolvedManagerId);
    totals.set(manager.resolvedManagerId, {
      managerId: manager.resolvedManagerId,
      managerName: manager.resolvedManagerName,
      employeeCount: (current?.employeeCount ?? 0) + manager.employeeCount,
      sourceManagers: [...(current?.sourceManagers ?? []), manager.sourceName],
    });
  }
  return [...totals.values()].sort((first, second) =>
    second.employeeCount - first.employeeCount
    || first.managerName.localeCompare(second.managerName, "pt-BR")
  );
}

function cents(value: number) {
  return Math.round(value * 100);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 180) || "importacao.xlsx";
}
