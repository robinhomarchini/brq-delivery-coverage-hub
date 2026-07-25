/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Module = require("node:module");
const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

require("sucrase/register");

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getCustomerCoverageAllocatedTotal,
  getCustomerAllocationComposition,
  getCustomerTargetBreakdown,
} = require("@/lib/customers/customer-coverage-view-model.ts");

const { buildOfficialRowsForView } = require("@/components/reports/person-target-report.tsx");

const year = 2026;

const customer = {
  id: "customer-specialist-qa",
  name: "Cliente Specialist QA",
  industry: "Banking",
  directorResponsibleId: "director-qa",
  managerResponsibleIds: [],
  hunterTarget: 1000,
  farmerRenewalTarget: 500,
  studioHunterTarget: 200,
  studioTarget: 300,
  revenue: 1500,
  margin: 50,
  strategicAccount: false,
  countsTowardTarget: true,
  targetExclusionReason: undefined,
  active: true,
  lifecycleStatus: "active",
};

const people = [
  {
    id: "specialist-hunter-qa",
    name: "Hunter Especializado QA",
    email: "specialist.qa@brq.com",
    jobTitle: "Hunter Especializado",
    roleType: "Hunter Especializado",
    active: true,
    clientIds: ["customer-specialist-qa"],
  },
  {
    id: "standard-hunter-qa",
    name: "Hunter Padrão QA",
    email: "hunter.qa@brq.com",
    jobTitle: "Hunter",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-specialist-qa"],
  },
  {
    id: "inactive-hunter-qa",
    name: "Hunter Inativo QA",
    email: "inactive.hunter.qa@brq.com",
    jobTitle: "Hunter",
    roleType: "Hunter",
    active: false,
    clientIds: ["customer-specialist-qa"],
  },
  {
    id: "executive-qa",
    name: "Executive QA",
    email: "executive.qa@brq.com",
    jobTitle: "Executive",
    roleType: "Executive",
    active: true,
    clientIds: ["customer-specialist-qa"],
  },
];

const allocations = [
  {
    id: "target-specialist-hunter-qa",
    customerId: "customer-specialist-qa",
    personId: "specialist-hunter-qa",
    type: "hunter",
    year,
    amount: 400,
  },
  {
    id: "target-standard-hunter-qa",
    customerId: "customer-specialist-qa",
    personId: "standard-hunter-qa",
    type: "hunter",
    year,
    amount: 600,
  },
  {
    id: "target-inactive-hunter-qa",
    customerId: "customer-specialist-qa",
    personId: "inactive-hunter-qa",
    type: "hunter",
    year,
    amount: 150,
  },
  {
    id: "target-executive-qa",
    customerId: "customer-specialist-qa",
    personId: "executive-qa",
    type: "hunter",
    year,
    amount: 200,
  },
];

const studioAllocations = [
  {
    id: "studio-specialist-hunter-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-specialist-qa",
    hunterPersonId: "specialist-hunter-qa",
    year,
    hunterAmount: 300,
    maintenanceAmount: 0,
  },
  {
    id: "studio-standard-hunter-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-standard-qa",
    hunterPersonId: "standard-hunter-qa",
    year,
    hunterAmount: 200,
    maintenanceAmount: 0,
  },
  {
    id: "studio-inactive-hunter-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-inactive-qa",
    hunterPersonId: "inactive-hunter-qa",
    year,
    hunterAmount: 100,
    maintenanceAmount: 0,
  },
  {
    id: "studio-executive-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-executive-qa",
    hunterPersonId: "executive-qa",
    year,
    hunterAmount: 250,
    maintenanceAmount: 0,
  },
];

const areas = [
  { id: "studio-specialist-qa", name: "Studio Specialist QA" },
  { id: "studio-standard-qa", name: "Studio Standard QA" },
  { id: "studio-inactive-qa", name: "Studio Inativo QA" },
  { id: "studio-executive-qa", name: "Studio Executive QA" },
];

const customerNames = new Map([["customer-specialist-qa", "Cliente Specialist QA"]]);
const areaNames = new Map([
  ["studio-specialist-qa", "Studio Specialist QA"],
  ["studio-standard-qa", "Studio Standard QA"],
  ["studio-inactive-qa", "Studio Inativo QA"],
  ["studio-executive-qa", "Studio Executive QA"],
]);

function buildPeopleRows() {
  return [
    {
      personId: "specialist-hunter-qa",
      personName: "Hunter Especializado QA",
      email: "specialist.qa@brq.com",
      roleType: "Hunter Especializado",
      customerCount: 1,
      customerNames: ["Cliente Specialist QA"],
      hunter: 400,
      farmerRenewal: 0,
      total: 400,
      customerBreakdown: [],
    },
    {
      personId: "standard-hunter-qa",
      personName: "Hunter Padrão QA",
      email: "hunter.qa@brq.com",
      roleType: "Hunter",
      customerCount: 1,
      customerNames: ["Cliente Specialist QA"],
      hunter: 600,
      farmerRenewal: 0,
      total: 600,
      customerBreakdown: [],
    },
    {
      personId: "inactive-hunter-qa",
      personName: "Hunter Inativo QA",
      email: "inactive.hunter.qa@brq.com",
      roleType: "Hunter",
      customerCount: 1,
      customerNames: ["Cliente Specialist QA"],
      hunter: 150,
      farmerRenewal: 0,
      total: 150,
      customerBreakdown: [],
    },
    {
      personId: "executive-qa",
      personName: "Executive QA",
      email: "executive.qa@brq.com",
      roleType: "Executive",
      customerCount: 1,
      customerNames: ["Cliente Specialist QA"],
      hunter: 200,
      farmerRenewal: 0,
      total: 200,
      customerBreakdown: [],
    },
  ];
}

function assertEqual(actual, expected, message) {
  if (Math.abs(actual - expected) > 0.01) {
    console.error(`FAIL: ${message} expected=${expected} actual=${actual}`);
    process.exit(1);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const allocatedTotal = getCustomerCoverageAllocatedTotal(customer, people, allocations, studioAllocations, areas, year);
const composition = getCustomerAllocationComposition(customer, people, allocations, studioAllocations, areas, year, getCustomerTargetBreakdown(customer));

assertEqual(allocatedTotal, 600, "Canonical allocatedTotal must equal 600");
assertEqual(composition.allocatedTotal, 600, "Canonical composition.allocatedTotal must equal 600");

const eligibleRows = composition.rows.filter((row) => row.hunter > 0 || row.farmerRenewal > 0);
assertEqual(eligibleRows.length, 1, "Only one eligible person should contribute to official totals");
assertEqual(eligibleRows[0]?.personName, "Hunter Padrão QA", "Eligible person must be standard Hunter");
assertEqual(eligibleRows[0]?.hunter, 600, "Eligible standard Hunter hunter total must be 600");

const officialPeopleRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: buildPeopleRows(),
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  year,
});

const nonTotalRows = officialPeopleRows.filter((row) => row.rowStyle !== "subtotal" && row.rowStyle !== "total");
assertTrue(
  !nonTotalRows.some((row) => row.executive === "Hunter Especializado QA"),
  "Hunter Especializado must be excluded from official people rows"
);
assertTrue(
  !nonTotalRows.some((row) => row.executive === "Hunter Inativo QA"),
  "Inactive Hunter must be excluded from official people rows"
);
assertTrue(
  !nonTotalRows.some((row) => row.executive === "Executive QA"),
  "Executive must be excluded from official people rows"
);
assertTrue(
  nonTotalRows.some((row) => row.executive === "Hunter Padrão QA"),
  "Standard Hunter must be present in official people rows"
);

const standardHunterNonTotal = nonTotalRows.filter((row) => row.executive === "Hunter Padrão QA");
assertEqual(
  standardHunterNonTotal.reduce((sum, row) => sum + row.hunter, 0),
  600,
  "Standard Hunter official hunter total must be 600"
);

const totalRow = officialPeopleRows.find((row) => row.executive === "TOTAL GERAL (na meta)");
assertTrue(Boolean(totalRow), "Official people rows must include TOTAL GERAL");
assertEqual(totalRow.hunter, 600, "TOTAL GERAL hunter must equal canonical official total");

const specialistManagerialRows = officialPeopleRows.filter((row) => row.executive === "Hunter Especializado QA");
assertTrue(
  specialistManagerialRows.length === 0,
  "Hunter Especializado must not appear even in managerial official rows"
);

console.log("PASS: Hunter Especializado regression checks passed.");
