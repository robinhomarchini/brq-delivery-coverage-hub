/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), "utf8");

const previewRoute = read("src", "app", "api", "admin", "employee-import", "preview", "route.ts");
const applyRoute = read("src", "app", "api", "admin", "employee-import", "apply", "route.ts");
const headcountRoute = read("src", "app", "api", "admin", "employee-import", "headcount", "route.ts");
const historyRoute = read("src", "app", "api", "admin", "employee-import", "history", "route.ts");
const access = read("src", "server", "auth", "employee-import-access.ts");
const service = read("src", "server", "employee-import", "service.ts");
const migration = read("supabase", "migrations", "20260728210000_employee_salary_import.sql");
const batchMigration = read("supabase", "migrations", "20260728223000_employee_import_batches_and_headcount.sql");
const page = read("src", "app", "importacao-funcionarios", "page.tsx");

assertIncludes(previewRoute, "createEmployeeImportClient(request)", "Preview must enforce employee-import authorization.");
assertIncludes(applyRoute, "createEmployeeImportClient(request)", "Apply must enforce employee-import authorization.");
assertIncludes(headcountRoute, "createEmployeeImportClient(request)", "Headcount confirmation must enforce authorization.");
assertIncludes(historyRoute, "source_row_count:preview_snapshot->>sourceRowCount", "Import history must derive the row count from the persisted snapshot.");
assertNotIncludes(historyRoute, '.select("id,source_file_name,source_row_count,status,created_at")', "Import history must not query a nonexistent source_row_count column.");
assertIncludes(access, "can_manage_person_compensation", "Backend must enforce compensation authorization.");
assertIncludes(service, "create_employee_import_batch", "Batch creation must use a transactional RPC.");
assertIncludes(service, "sanitizeStorageFileName", "Storage keys must normalize accented workbook names.");
assertIncludes(service, "apply_employee_import_salary_item", "Salary action must use its transactional RPC.");
assertIncludes(service, "confirm_employee_import_headcount", "Headcount confirmation must use its transactional RPC.");
assertIncludes(service, "parseEmployeeImportWorkbook", "Upload must be parsed server-side.");
assertIncludes(migration, "security invoker", "Import RPC must preserve caller/RLS context.");
assertIncludes(migration, "if not public.can_manage_person_compensation()", "Import RPC must enforce authorization.");
assertIncludes(migration, "employee_import_manager_mappings_audit", "Manager mappings must be audited.");
assertIncludes(migration, "person_compensations", "Salary import must update the canonical compensation table.");
assertIncludes(migration, "on conflict (person_id) do update", "Salary import must be idempotent by person.");
assertIncludes(batchMigration, "employee_import_batches", "Import batches must be persisted.");
assertIncludes(batchMigration, "employee_import_salary_items", "Salary action states must be persisted.");
assertIncludes(batchMigration, "public.can_manage_person_compensation()", "New import operations must enforce authorization.");
assertIncludes(batchMigration, "bucket_id = 'employee-imports'", "Raw workbooks must stay in the private import bucket.");
assertIncludes(batchMigration, "imported_direct_headcount", "Approved direct HC must have source fields on people.");
assertIncludes(page, "createAuthServiceSelection", "UI must use the authentication boundary.");
assertNotIncludes(page, "getSupabaseBrowserClient", "UI must not create a direct Supabase client.");
assertNotIncludes(previewRoute, "console.log", "Preview must not log workbook contents.");
assertNotIncludes(applyRoute, "console.log", "Apply must not log workbook contents.");

console.log("Employee import security and persistence checks passed.");

function assertIncludes(source, token, message) {
  if (!source.includes(token)) throw new Error(message);
}

function assertNotIncludes(source, token, message) {
  if (source.includes(token)) throw new Error(message);
}
