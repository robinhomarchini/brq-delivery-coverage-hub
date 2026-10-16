import assert from "node:assert/strict";
import { buildCustomerResponsibilityRows, filterCustomerResponsibilityRows, customerResponsibilityColumns } from "../src/lib/reports/customer-responsibility";

type ReportPerson = Parameters<typeof buildCustomerResponsibilityRows>[1][number];
const person = (id: string, roleType: ReportPerson["roleType"], overrides: Partial<ReportPerson> = {}): ReportPerson => ({
  id, name: id, active: true, roleType, isManager: false, clientIds: ["client"], ...overrides,
});
const customers = [
  { id: "empty", name: "A sem vínculos", managerResponsibleIds: [] },
  { id: "client", name: "B com vínculos", managerResponsibleIds: ["manager", "manager", "inactive", "unknown-id"] },
];
const people = [
  person("hunter", "Hunter", { clientIds: ["client", "client"] }),
  person("specialist", "Hunter Especializado"),
  person("hybrid", "Hunter + Farmer"),
  person("delivery", "Delivery"),
  person("farmer", "Farmer"),
  person("manager", "Farmer + Delivery", { isManager: true, clientIds: [] }),
  person("inactive", "Hunter", { active: false }),
  person("staff", "Staff"),
  person("unassigned", "Hunter", { clientIds: [] }),
];
const rows = buildCustomerResponsibilityRows(customers, people);
assert.equal(rows.length, 2, "Keep clients without assignments");
assert.equal(rows[0].coverageLabel, "Sem responsáveis");
assert.equal(rows[0].huntersText, "Não informado");
assert.equal(rows[1].huntersText, "hunter, hybrid, specialist", "All directly assigned Hunters count, without financial targets or duplicates");
assert.equal(rows[1].deliveryManagersText, "delivery, farmer, hybrid, manager", "Include Farmers, hybrid roles and explicit managers");
assert.equal(rows[1].hasPending, false);
assert.equal(JSON.stringify(rows).includes("unknown-id"), false, "Do not expose unresolved IDs as names");
assert.equal(JSON.stringify(rows).includes("inactive"), false, "Do not report inactive people as current owners");
const removed = buildCustomerResponsibilityRows(customers, people.map((item) => ({ ...item, clientIds: [] })));
assert.equal(removed[1].huntersText, "Não informado", "Removed assignments must disappear");
assert.equal(removed[1].deliveryManagersText, "manager", "Keep only remaining explicit responsibility");
assert.equal(removed[1].coverageLabel, "Sem Hunter");
const huntersOnly = buildCustomerResponsibilityRows([{ ...customers[1], managerResponsibleIds: [] }], [person("hunter", "Hunter")]);
assert.equal(huntersOnly[0].coverageLabel, "Sem Delivery/Farmer");
const sameNames = buildCustomerResponsibilityRows(customers, [person("one", "Hunter", { name: "Mesmo nome" }), person("two", "Hunter", { name: "Mesmo nome" })]);
assert.equal(sameNames[1].huntersText, "Mesmo nome, Mesmo nome", "Do not merge distinct people by name");
assert.deepEqual(customerResponsibilityColumns.map((column) => column.value(rows[1])), [
  rows[1].customerName, rows[1].huntersText, rows[1].deliveryManagersText, rows[1].coverageLabel,
], "Export columns must match the displayed responsibility data");
assert.deepEqual(buildCustomerResponsibilityRows([], people), []);
assert.deepEqual(filterCustomerResponsibilityRows(rows, { hunterId: "hunter", deliveryManagerId: "manager", coverage: "complete" }), [rows[1]]);
assert.deepEqual(filterCustomerResponsibilityRows(rows, { hunterId: "hunter", coverage: "pending" }), []);
assert.deepEqual(filterCustomerResponsibilityRows(rows, { coverage: "pending" }), [rows[0]]);
assert.deepEqual(filterCustomerResponsibilityRows(rows, {}), rows, "Cleared filters restore all rows");
const accented = buildCustomerResponsibilityRows([{ ...customers[1], name: "FUNDAÇÃO ITAÚ" }], [person("accent", "Hunter", { name: "José" })]);
assert.equal(filterCustomerResponsibilityRows(accented, { search: "  fundacao   itau " }).length, 1);
assert.equal(filterCustomerResponsibilityRows(accented, { search: "JOSE" }).length, 1);
const homonyms = buildCustomerResponsibilityRows(customers, [
  person("one", "Hunter", { name: "Mesmo nome", clientIds: ["empty"] }),
  person("two", "Hunter", { name: "Mesmo nome" }),
]);
assert.deepEqual(filterCustomerResponsibilityRows(homonyms, { hunterId: "one" }).map((row) => row.customerId), ["empty"], "Filter by ID, never by a homonym's name");
assert.deepEqual(filterCustomerResponsibilityRows(removed, { hunterId: "hunter" }), [], "A removed relationship cannot match an old selection");
console.log("Customer responsibility report checks passed.");
