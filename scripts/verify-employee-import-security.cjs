/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), "utf8");

const previewRoute = read("src", "app", "api", "admin", "employee-import", "preview", "route.ts");
const applyRoute = read("src", "app", "api", "admin", "employee-import", "apply", "route.ts");
const access = read("src", "server", "auth", "employee-import-access.ts");
const service = read("src", "server", "employee-import", "service.ts");
const migration = read("supabase", "migrations", "20260728210000_employee_salary_import.sql");
const page = read("src", "app", "importacao-funcionarios", "page.tsx");

assertIncludes(previewRoute, "createEmployeeImportClient(request)", "Preview must enforce employee-import authorization.");
assertIncludes(applyRoute, "createEmployeeImportClient(request)", "Apply must enforce employee-import authorization.");
assertIncludes(access, "can_manage_person_compensation", "Backend must enforce compensation authorization.");
assertIncludes(service, "apply_employee_salary_import", "Apply must use the transactional RPC.");
assertIncludes(service, "parseEmployeeImportWorkbook", "Apply must reparse the workbook server-side.");
assertIncludes(migration, "security invoker", "Import RPC must preserve caller/RLS context.");
assertIncludes(migration, "if not public.can_manage_person_compensation()", "Import RPC must enforce authorization.");
assertIncludes(migration, "employee_import_manager_mappings_audit", "Manager mappings must be audited.");
assertIncludes(migration, "person_compensations", "Salary import must update the canonical compensation table.");
assertIncludes(migration, "on conflict (person_id) do update", "Salary import must be idempotent by person.");
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
