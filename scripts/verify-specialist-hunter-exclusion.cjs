/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Module = require("node:module");
const originalResolveFilename = Module._resolveFilename;

require("sucrase/register");

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(process.cwd(), "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getCustomerCoverageAllocatedTotal,
  getCustomerAllocationComposition,
  getCustomerTargetBreakdown,
} = require("@/lib/customers/customer-coverage-view-model.ts");

const { buildOfficialRowsForView } = require("@/components/reports/person-target-report.tsx");

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

const specialistHunter = {
  id: "specialist-hunter-qa",
  name: "Hunter Especializado QA",
  email: "specialist.qa@brq.com",
  jobTitle: "Hunter Especializado",
  roleType: "Hunter Especializado",
  active: true,
  clientIds: ["customer-specialist-qa"],
};

const standardHunter = {
  id: "standard-hunter-qa",
  name: "Hunter Padrão QA",
  email: "hunter.qa@brq.com",
  jobTitle: "Hunter",
  roleType: "Hunter",
  active: true,
  clientIds: ["customer-specialist-qa"],
};

const people = [specialistHunter, standardHunter];
const allocations = [
  {
    id: "target-specialist-hunter-qa",
    customerId: "customer-specialist-qa",
    personId: "specialist-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 400,
  },
  {
    id: "target-standard-hunter-qa",
    customerId: "customer-specialist-qa",
    personId: "standard-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 600,
  },
];

const studioAllocations = [
  {
    id: "studio-specialist-hunter-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-specialist-qa",
    hunterPersonId: "specialist-hunter-qa",
    year: 2026,
    hunterAmount: 300,
    maintenanceAmount: 0,
  },
  {
    id: "studio-standard-hunter-qa",
    customerId: "customer-specialist-qa",
    areaId: "studio-standard-qa",
    hunterPersonId: "standard-hunter-qa",
    year: 2026,
    hunterAmount: 200,
    maintenanceAmount: 0,
  },
];

const areas = [
  { id: "studio-specialist-qa", name: "Studio Specialist QA" },
  { id: "studio-standard-qa", name: "Studio Standard QA" },
];

const year = 2026;

const allocatedTotal = getCustomerCoverageAllocatedTotal(customer, people, allocations, studioAllocations, areas, year);
const composition = getCustomerAllocationComposition(customer, people, allocations, studioAllocations, areas, year, getCustomerTargetBreakdown(customer));

console.log("Canonical allocatedTotal:", allocatedTotal);
console.log("Canonical composition.allocatedTotal:", composition.allocatedTotal);
console.log("Canonical composition.rows:", composition.rows.map((r) => ({ personName: r.personName, roleType: r.roleType, hunter: r.hunter, total: r.total })));

const officialPeopleRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [
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
  ],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: people,
  allocations: allocations,
  studioAllocations: studioAllocations,
  customerNames: new Map([["customer-specialist-qa", "Cliente Specialist QA"]]),
  areaNames: new Map([
    ["studio-specialist-qa", "Studio Specialist QA"],
    ["studio-standard-qa", "Studio Standard QA"],
  ]),
  year: 2026,
});

console.log("Official people rows:", officialPeopleRows.map((r) => ({ executive: r.executive, customerName: r.customerName, hunter: r.hunter, farmerRenewal: r.farmerRenewal })));

const specialistRows = officialPeopleRows.filter((r) => r.executive === "Hunter Especializado QA");
const standardRows = officialPeopleRows.filter((r) => r.executive === "Hunter Padrão QA" && r.rowStyle !== "subtotal" && r.rowStyle !== "total");

if (specialistRows.length > 0) {
  console.error("FAIL: Hunter Especializado appears in official people export.");
  process.exit(1);
}

if (standardRows.length === 0) {
  console.error("FAIL: Standard Hunter missing from official people export.");
  process.exit(1);
}

const standardHunterTotal = standardRows.reduce((sum, r) => sum + r.hunter, 0);
if (Math.abs(standardHunterTotal - 600) > 0.01) {
  console.error(`FAIL: Standard Hunter total mismatch: expected 600, got ${standardHunterTotal}`);
  process.exit(1);
}

const totalRow = officialPeopleRows.find((r) => r.executive === "TOTAL GERAL (na meta)");
if (!totalRow || Math.abs(totalRow.hunter - 600) > 0.01) {
  console.error(`FAIL: Total geral mismatch: expected 600, got ${totalRow?.hunter}`);
  process.exit(1);
}

console.log("PASS: Hunter Especializado is excluded from official people totals.");
console.log("PASS: Standard Hunter official total is correct (600 contained).");
