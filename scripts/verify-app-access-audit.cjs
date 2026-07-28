/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const migrationPath = path.join(root, "supabase", "migrations", "20260728113530_add_app_access_domain_audit.sql");
const accessRepositoryPath = path.join(root, "src", "lib", "repositories", "accessRepository.ts");
const settingsPagePath = path.join(root, "src", "app", "configuracoes", "page.tsx");

const migration = read(migrationPath);
const accessRepository = read(accessRepositoryPath);
const settingsPage = read(settingsPagePath);

const tableBlock = blockBetween(
  migration,
  "create table if not exists public.domain_audit_events",
  "create index if not exists domain_audit_events_entity_idx",
);
const auditTriggerFunction = blockBetween(
  migration,
  "create or replace function public.audit_app_access_profile_change()",
  "drop trigger if exists app_users_domain_audit",
);
const upsertRpc = blockBetween(
  migration,
  "create or replace function public.upsert_app_access",
  "create or replace function public.delete_app_access",
);
const deleteRpc = blockBetween(
  migration,
  "create or replace function public.delete_app_access",
  "grant execute on function public.upsert_app_access",
);
const rlsBlock = blockBetween(
  migration,
  "alter table public.domain_audit_events enable row level security;",
  "create or replace function public.current_actor_person_id()",
);

assertIncludes(tableBlock, "actor_user_id uuid references auth.users(id)", "Audit event must store backend-derived auth actor.");
assertIncludes(tableBlock, "actor_person_id text references public.people(id)", "Audit event must optionally map actor to a person.");
assertIncludes(tableBlock, "entity_type text not null", "Audit event must store entity type.");
assertIncludes(tableBlock, "entity_id text not null", "Audit event must store entity id.");
assertIncludes(tableBlock, "previous_values jsonb", "Audit event must store previous business values.");
assertIncludes(tableBlock, "new_values jsonb", "Audit event must store new business values.");
assertIncludes(tableBlock, "changed_fields text[] not null", "Audit event must store deterministic changed fields.");
assertIncludes(tableBlock, "source text not null", "Audit event must identify source flow.");
assertIncludes(tableBlock, "status text not null default 'succeeded'", "Audit event must store operation status.");
assertIncludes(tableBlock, "error_category text", "Audit event model must reserve error category without inventing failures.");
assertIncludes(tableBlock, "app_access.user.updated", "Audit actions must be controlled for app users.");
assertIncludes(tableBlock, "app_access.invite.updated", "Audit actions must be controlled for access invites.");

assertIncludes(rlsBlock, "revoke all on public.domain_audit_events from anon", "Audit events must not be exposed to anon.");
assertIncludes(rlsBlock, "revoke all on public.domain_audit_events from authenticated", "Authenticated users must not get write grants on audit events.");
assertIncludes(rlsBlock, "grant select on public.domain_audit_events to authenticated", "Read access must be explicit.");
assertIncludes(rlsBlock, "using (public.is_delivery_admin())", "Only admins may read domain audit events.");
assertNotIncludes(rlsBlock, "grant insert", "Audit event inserts must not be granted to application users.");
assertNotIncludes(rlsBlock, "grant update", "Audit event updates must not be granted to application users.");
assertNotIncludes(rlsBlock, "grant delete", "Audit event deletes must not be granted to application users.");

assertIncludes(auditTriggerFunction, "security definer", "Audit trigger must be backend-enforced.");
assertIncludes(auditTriggerFunction, "set search_path = public", "Audit trigger SECURITY DEFINER must pin search_path.");
assertIncludes(auditTriggerFunction, "auth.uid()", "Audit trigger must derive actor from auth.uid().");
assertIncludes(auditTriggerFunction, "public.current_actor_person_id()", "Audit trigger must derive actor person from backend identity.");
assertIncludes(auditTriggerFunction, "public.app_access_audit_payload", "Audit trigger must store only the selected access-profile fields.");
assertIncludes(auditTriggerFunction, "jsonb_object_keys", "Audit trigger must compute changed fields deterministically.");
assertIncludes(auditTriggerFunction, "if tg_op = 'UPDATE' and coalesce(array_length(v_changed_fields, 1), 0) = 0 then", "No-op updates must not create misleading audit events.");
assertIncludes(auditTriggerFunction, "current_setting('app.audit_source', true)", "Audit trigger must capture source flow from backend context.");
assertIncludes(auditTriggerFunction, "insert into public.domain_audit_events", "Audit trigger must append audit events in the same transaction.");

assertIncludes(migration, "create trigger app_users_domain_audit", "App user changes must be covered by an audit trigger.");
assertIncludes(migration, "create trigger app_access_invites_domain_audit", "Access invite changes must be covered by an audit trigger.");
assertIncludes(migration, "select count(*)", "Migration smoke assertion must verify both triggers.");
assertIncludes(migration, "privilege_type in ('INSERT', 'UPDATE', 'DELETE')", "Migration smoke assertion must verify append-only grants.");

assertIncludes(upsertRpc, "perform set_config('app.audit_source', 'rpc.upsert_app_access', true)", "Access upsert RPC must mark audit source.");
assertIncludes(deleteRpc, "perform set_config('app.audit_source', 'rpc.delete_app_access', true)", "Access delete RPC must mark audit source.");
assertIncludes(upsertRpc, "if not public.is_delivery_admin()", "Access upsert RPC must preserve admin authorization.");
assertIncludes(deleteRpc, "if not public.is_delivery_admin()", "Access delete RPC must preserve admin authorization.");
assertIncludes(upsertRpc, "Mantenha ao menos um administrador ativo.", "Access upsert RPC must preserve last-admin protection.");
assertIncludes(deleteRpc, "Mantenha ao menos um administrador ativo.", "Access delete RPC must preserve last-admin protection.");

assertIncludes(accessRepository, ".rpc(\"upsert_app_access\"", "Access repository must use the audited access upsert RPC.");
assertIncludes(accessRepository, ".rpc(\"delete_app_access\"", "Access repository must use the audited access delete RPC.");
assertNotIncludes(accessRepository, ".from(\"app_users\")", "Access repository must not write app_users directly.");
assertNotIncludes(accessRepository, ".from(\"app_access_invites\")", "Access repository must not write app_access_invites directly.");
assertIncludes(settingsPage, "createAccessRepositorySelection", "Settings page must go through the access repository boundary.");
assertNotIncludes(settingsPage, ".rpc(", "Settings page must not bypass the access repository for admin access mutations.");

console.log("App access audit checks passed.");

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
