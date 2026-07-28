/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const accessAuditMigrationPath = path.join(root, "supabase", "migrations", "20260728113530_add_app_access_domain_audit.sql");
const personTargetAuditMigrationPath = path.join(root, "supabase", "migrations", "20260728120500_add_person_target_domain_audit.sql");
const repositoryPath = path.join(root, "src", "lib", "repositories", "supabaseDeliveryRepository.ts");
const routePath = path.join(root, "src", "app", "api", "delivery", "person-customer-targets", "route.ts");

const accessAuditMigration = read(accessAuditMigrationPath);
const personTargetAuditMigration = read(personTargetAuditMigrationPath);
const repository = read(repositoryPath);
const route = read(routePath);

const actionConstraintBlock = blockBetween(
  personTargetAuditMigration,
  "add constraint domain_audit_events_action_check check",
  "create or replace function public.person_target_audit_payload",
);
const payloadFunction = blockBetween(
  personTargetAuditMigration,
  "create or replace function public.person_target_audit_payload",
  "create or replace function public.audit_person_target_change()",
);
const triggerFunction = blockBetween(
  personTargetAuditMigration,
  "create or replace function public.audit_person_target_change()",
  "drop trigger if exists revenue_target_allocations_domain_audit",
);
const removeRpc = blockBetween(
  personTargetAuditMigration,
  "create or replace function public.remove_person_customer_targets",
  "grant execute on function public.remove_person_customer_targets",
);

assertIncludes(accessAuditMigration, "create table if not exists public.domain_audit_events", "Person target audit must reuse the domain audit event table.");
assertIncludes(personTargetAuditMigration, "requires public.domain_audit_events", "Person target audit migration must fail clearly if the audit event table is missing.");

for (const action of ["person_target.created", "person_target.updated", "person_target.deleted"]) {
  assertIncludes(actionConstraintBlock, action, `Domain audit action constraint must allow ${action}.`);
}
for (const action of ["app_access.user.updated", "app_access.invite.updated"]) {
  assertIncludes(actionConstraintBlock, action, `Extending the action constraint must preserve existing ${action} events.`);
}

for (const field of ["id", "customer_id", "person_id", "target_type", "target_year", "amount", "own_amount"]) {
  assertIncludes(payloadFunction, `'${field}'`, `Person target audit payload must include ${field}.`);
}
assertNotIncludes(payloadFunction, "customer_name", "Person target audit must not denormalize customer names.");
assertNotIncludes(payloadFunction, "person_name", "Person target audit must not denormalize person names.");
assertNotIncludes(payloadFunction, "email", "Person target audit must not store person email in target payload.");

assertIncludes(triggerFunction, "security definer", "Person target audit trigger must be backend-enforced.");
assertIncludes(triggerFunction, "set search_path = public", "SECURITY DEFINER trigger must pin search_path.");
assertIncludes(triggerFunction, "auth.uid()", "Person target audit must derive actor from auth.uid().");
assertIncludes(triggerFunction, "public.current_actor_person_id()", "Person target audit must derive actor person from backend identity.");
assertIncludes(triggerFunction, "jsonb_object_keys", "Person target audit must compute changed fields deterministically.");
assertIncludes(triggerFunction, "if tg_op = 'UPDATE' and coalesce(array_length(v_changed_fields, 1), 0) = 0 then", "No-op updates must not create misleading target audit events.");
assertIncludes(triggerFunction, "current_setting('app.audit_source', true)", "Person target audit must capture source flow when available.");
assertIncludes(triggerFunction, "insert into public.domain_audit_events", "Person target trigger must append domain audit events.");
assertIncludes(triggerFunction, "'person_target'", "Person target events must use the person_target entity type.");

assertIncludes(personTargetAuditMigration, "create trigger revenue_target_allocations_domain_audit", "Revenue target allocation changes must be covered by a domain audit trigger.");
assertIncludes(personTargetAuditMigration, "after insert or update or delete on public.revenue_target_allocations", "Person target audit must cover insert, update and delete.");
assertIncludes(personTargetAuditMigration, "person_target.updated", "Migration smoke assertion must verify the extended action constraint.");
assertIncludes(removeRpc, "perform set_config('app.audit_source', 'rpc.remove_person_customer_targets', true)", "Removal RPC must mark audit source.");
assertIncludes(removeRpc, "delete from public.revenue_target_allocations", "Removal RPC must preserve target deletion behavior.");
assertIncludes(removeRpc, "delete from public.person_customer_assignments", "Removal RPC must preserve assignment deletion behavior.");

assertIncludes(route, "createDeliveryCommandClient(request, { allowHunterScopedWrite: true })", "Person target saves must stay behind the authenticated BFF route.");
assertIncludes(route, "personCustomerTargetsCommandSchema.safeParse", "Person target saves must keep server-side payload validation.");
assertIncludes(route, "usePersonCustomerTargetsBff: false", "BFF must avoid recursive calls when using the repository.");
assertIncludes(repository, "savePersonCustomerTargetsWithBff", "Browser repository must keep using the BFF boundary for person target saves.");
assertIncludes(repository, "removePersonCustomerTargets", "Repository must expose person/customer target removal.");

console.log("Person target audit checks passed.");

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${path.relative(root, filePath)}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) {
    throw new Error(`Start marker not found: ${start}`);
  }
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) {
    throw new Error(`End marker not found after ${start}: ${end}`);
  }
  return source.slice(startIndex, endIndex);
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message);
  }
}

function assertNotIncludes(source, token, message) {
  if (source.includes(token)) {
    throw new Error(message);
  }
}
