import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type {
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

type ImportBatchRow = {
  id: string;
  source_file_name: string;
  preview_snapshot: EmployeeImportPreview;
  status: "reconciling" | "hc_confirmed";
};

type SalaryItemRow = {
  person_id: string;
  status: "pending" | "unchanged" | "updated";
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
    .map((person) => ({ id: person.id, name: person.name }))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  const managerById = new Map(availableManagers.map((manager) => [manager.id, manager]));
  const managersByName = groupPeopleByNormalizedName(
    people,
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

export async function saveEmployeeImportBatch(input: {
  client: SupabaseClient;
  buffer: Buffer;
  fileName: string;
}): Promise<EmployeeImportPreview> {
  const preview = await buildEmployeeImportPreview(input);
  const batchId = randomUUID();
  const storagePath = `${batchId}/${sanitizeStorageFileName(input.fileName)}`;
  const { error: storageError } = await input.client.storage
    .from("employee-imports")
    .upload(storagePath, input.buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
  if (storageError) {
    console.warn("[employee-import] Private workbook upload failed.", {
      errorName: storageError.name,
      statusCode: "statusCode" in storageError ? storageError.statusCode : undefined,
    });
    throw new Error("Não foi possível armazenar a planilha no repositório privado.");
  }

  const items = preview.matchedPeople.map((person) => ({
    person_id: person.personId,
    source_name: person.sourceName,
    proposed_salary: person.proposedSalary,
    status: person.status === "unchanged" ? "unchanged" : "pending",
  }));
  const { error: batchError } = await input.client.rpc("create_employee_import_batch", {
    p_batch_id: batchId,
    p_source_file_name: sanitizeFileName(input.fileName),
    p_storage_path: storagePath,
    p_preview_snapshot: preview,
    p_salary_items: items,
  });
  if (batchError) {
    await input.client.storage.from("employee-imports").remove([storagePath]);
    throw new Error("Não foi possível salvar o lote da planilha.");
  }
  return { ...preview, batchId, batchStatus: "reconciling" };
}

export async function getLatestEmployeeImportBatch(client: SupabaseClient) {
  const { data, error } = await client
    .from("employee_import_batches")
    .select("id,source_file_name,preview_snapshot,status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar o último lote de importação.");
  if (!data) return null;
  const batch = data as ImportBatchRow;
  const { data: salaryItems, error: salaryError } = await client
    .from("employee_import_salary_items")
    .select("person_id,status")
    .eq("batch_id", batch.id);
  if (salaryError) throw new Error("Não foi possível consultar os estados salariais do lote.");
  const statusByPerson = new Map(
    ((salaryItems ?? []) as SalaryItemRow[]).map((item) => [item.person_id, item.status]),
  );
  const peopleResult = await client.from("people").select("id,name").order("name").limit(5000);
  if (peopleResult.error) throw new Error("Não foi possível consultar as pessoas do sistema.");
  return {
    ...batch.preview_snapshot,
    sourceFileName: batch.source_file_name,
    batchId: batch.id,
    batchStatus: batch.status,
    availableManagers: (peopleResult.data ?? []).map((person) => ({
      id: String(person.id),
      name: String(person.name),
    })),
    matchedPeople: batch.preview_snapshot.matchedPeople.map((person) => ({
      ...person,
      status: statusByPerson.get(person.personId) === "updated" ? "updated" as const : person.status,
    })),
  } satisfies EmployeeImportPreview;
}

export async function applyEmployeeImportSalaryItem(input: {
  client: SupabaseClient;
  batchId: string;
  personId: string;
}) {
  const { data, error } = await input.client.rpc("apply_employee_import_salary_item", {
    p_batch_id: input.batchId,
    p_person_id: input.personId,
  });
  if (error) throw new Error("Não foi possível atualizar o salário selecionado.");
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    personId: String(result.person_id ?? input.personId),
    status: "updated" as const,
    updatedAt: String(result.updated_at ?? new Date().toISOString()),
  };
}

export async function confirmEmployeeImportHeadcount(input: {
  client: SupabaseClient;
  batchId: string;
  mappings: Array<{ sourceKey: string; sourceName: string; personId: string; employeeCount: number }>;
}) {
  const { data, error } = await input.client.rpc("confirm_employee_import_headcount", {
    p_batch_id: input.batchId,
    p_manager_mappings: input.mappings.map((mapping) => ({
      source_key: mapping.sourceKey,
      source_name: mapping.sourceName,
      person_id: mapping.personId,
      employee_count: mapping.employeeCount,
    })),
  });
  if (error) throw new Error("Não foi possível confirmar o HC direto.");
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    headcountsUpdated: Number(result.headcounts_updated ?? 0),
    status: "hc_confirmed" as const,
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

function sanitizeStorageFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
  return normalized.toLowerCase().endsWith(".xlsx")
    ? normalized
    : `${normalized || "importacao"}.xlsx`;
}
