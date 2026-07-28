/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const migrationPath = path.join(root, "supabase", "migrations", "20260728111436_harden_hunter_scoped_customer_create.sql");
const customersRoutePath = path.join(root, "src", "app", "api", "delivery", "customers", "route.ts");
const commandAccessPath = path.join(root, "src", "server", "auth", "delivery-command-access.ts");
const repositoryPath = path.join(root, "src", "lib", "repositories", "supabaseDeliveryRepository.ts");

const migration = read(migrationPath);
const customersRoute = read(customersRoutePath);
const commandAccess = read(commandAccessPath);
const repository = read(repositoryPath);

const helper = blockBetween(
  migration,
  "create or replace function public.can_hunter_scope_create_customer",
  "grant execute on function public.can_hunter_scope_create_customer",
);
const customerRpc = blockBetween(
  migration,
  "create or replace function public.save_customer_with_managers_and_targets",
  "grant execute on function public.save_customer_with_managers_and_targets",
);
const hunterRouteGuard = blockBetween(
  customersRoute,
  "if (isHunterScopedWrite) {",
  "const customer = {",
);

assertIncludes(helper, "public.current_hunter_access_person_id() is not null", "Hunter customer-create helper must require a resolved Hunter scoped identity.");
assertIncludes(helper, "not exists", "Hunter customer-create helper must deny existing customers.");
assertIncludes(helper, "from public.customers", "Hunter customer-create helper must verify customer existence at the database boundary.");
assertIncludes(helper, "array_length(p_manager_responsible_ids, 1)", "Hunter customer-create helper must reject Farmer/Delivery manager assignment.");
assertIncludes(helper, "security definer", "Hunter customer-create helper must execute under the database authorization boundary.");
assertIncludes(helper, "set search_path = public", "Security definer helper must pin search_path.");

assertIncludes(customerRpc, "v_hunter_scoped_create boolean", "Customer RPC must carry an explicit Hunter scoped create decision.");
assertIncludes(customerRpc, "public.can_hunter_scope_create_customer(p_id, p_manager_responsible_ids)", "Customer RPC must call the database authorization helper.");
assertOrder(customerRpc, "v_hunter_scoped_create := public.can_hunter_scope_create_customer", "insert into public.customers", "Customer RPC must authorize Hunter scoped creation before writing customer rows.");
assertIncludes(customerRpc, "if v_existing_customer then", "Customer RPC must keep the existing-customer denial branch.");
assertIncludes(customerRpc, "Consulta Hunter só pode criar novos clientes", "Customer RPC must keep the user-safe denial for existing customers.");
assertIncludes(customerRpc, "Consulta Hunter não pode definir Farmers/Delivery", "Customer RPC must keep the user-safe denial for manager assignment.");
assertAtLeast(customerRpc, "where v_can_edit;", 2, "Customer RPC upsert conflicts must update rows only for editor/admin access.");
assertAtLeast(customerRpc, "if not found then", 2, "Customer RPC must fail Hunter scoped conflicting writes instead of silently skipping them.");
assertIncludes(customerRpc, "if v_hunter_scoped_create then", "Customer RPC must add the Hunter/customer relationship only after the helper authorizes the create.");
assertIncludes(customerRpc, "rpc_hunter_customer_create", "Customer RPC must preserve the audit source for Hunter-created customer relationships.");

assertIncludes(commandAccess, "options.allowHunterScopedWrite && accessUser.role === \"hunter_viewer\"", "BFF auth must require explicit route opt-in for Hunter scoped writes.");
assertIncludes(customersRoute, "createDeliveryCommandClient(request, { allowHunterScopedWrite: true })", "Customer route must opt in explicitly to Hunter scoped writes.");
assertIncludes(hunterRouteGuard, "repository.findCustomerById(parsed.data.customer.id)", "Customer route must reject Hunter edits of existing customers before calling the RPC.");
assertIncludes(hunterRouteGuard, "Consulta Hunter pode criar novos clientes, mas não editar clientes existentes.", "Customer route must return a safe, specific denial message.");
assertNotIncludes(customersRoute, ".from(\"customers\")", "Customer route must not bypass the repository boundary for customer existence checks.");
assertIncludes(repository, "\"/api/delivery/customers\"", "Supabase repository must send customer writes through the BFF by default.");
assertIncludes(customersRoute, "useCustomerBff: false", "BFF repository instance must disable recursive customer BFF calls.");

console.log("Hunter scoped customer-create security checks passed.");

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

function assertOrder(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex > secondIndex) {
    throw new Error(message);
  }
}

function assertAtLeast(source, token, count, message) {
  const actual = source.split(token).length - 1;
  if (actual < count) {
    throw new Error(`${message} Found ${actual}, expected at least ${count}.`);
  }
}
