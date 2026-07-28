/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Module = require("node:module");

require("sucrase/register");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { buildDashboardData } = require("../src/lib/dashboardMetrics.ts");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertGreaterThanOrEqual(actual, expected, message) {
  if (actual < expected) {
    throw new Error(`${message}: expected >= ${expected}, got ${actual}`);
  }
}

function assertArrayLength(arr, expected, message) {
  if (arr.length !== expected) {
    throw new Error(`${message}: expected length ${expected}, got ${arr.length}`);
  }
}

function createMockPerson(id, name, roleType, active, clientIds = [], isManager = false, directorId) {
  return {
    id,
    name,
    email: `${name.toLowerCase().replace(/\s/g, "")}@brq.com`,
    jobTitle: "Consultor",
    directorId,
    roleType,
    clientIds,
    active,
    lifecycleStatus: "active",
    isManager,
    hierarchyLevel: 3,
  };
}

function createMockCustomer(id, name, directorResponsibleId, managerResponsibleIds = [], hunterTarget = 0, farmerRenewalTarget = 0) {
  return {
    id,
    name,
    industry: "Financial Services",
    directorResponsibleId,
    managerResponsibleIds,
    hunterTarget,
    farmerRenewalTarget,
    studioHunterTarget: 0,
    studioTarget: 0,
    revenue: hunterTarget + farmerRenewalTarget,
    margin: 0.3,
    strategicAccount: true,
    lifecycleStatus: "active",
  };
}

function runTests() {
  const people = [
    createMockPerson("p1", "Ana Silva", "Director", true, ["c1", "c2"], true),
    createMockPerson("p2", "Bruno Costa", "Hunter", true, ["c1"], false, "p1"),
    createMockPerson("p3", "Carla Mendes", "Farmer", true, ["c2"], false, "p1"),
    createMockPerson("p4", "Diego Ramos", "Hunter + Farmer", true, ["c3"], false, "p1"),
    createMockPerson("p5", "Elena Souza", "Delivery", true, [], false, "p1"),
    createMockPerson("p6", "Fernando Lima", "Staff", true, [], false, "p1"),
    createMockPerson("p7", "Gabriel Santos", "Hunter", false, ["c1"], false, "p1"),
    createMockPerson("p8", "Helena Costa", "Director", true, ["c3"], true, "p1"),
  ];

  const customers = [
    createMockCustomer("c1", "Banco Itau S.A.", "p1", ["p1"], 500000, 300000),
    createMockCustomer("c2", "Nuclea Pagamentos", "p1", ["p1"], 200000, 150000),
    createMockCustomer("c3", "B3 Capital Markets", "p1", ["p8"], 400000, 250000),
  ];

  const customerTargets = customers.map((c) => ({
    customerId: c.id,
    year: 2026,
    hunterTarget: c.hunterTarget,
    farmerRenewalTarget: c.farmerRenewalTarget,
    studioHunterTarget: 0,
    studioTarget: 0,
    revenue: c.revenue,
    countsTowardTarget: true,
  }));

  const targetAllocations = [
    { id: "ta1", customerId: "c1", personId: "p2", type: "hunter", year: 2026, amount: 400000 },
    { id: "ta2", customerId: "c2", personId: "p3", type: "farmer_renewal", year: 2026, amount: 150000 },
    { id: "ta3", customerId: "c3", personId: "p4", type: "hunter", year: 2026, amount: 300000 },
    { id: "ta4", customerId: "c3", personId: "p4", type: "farmer_renewal", year: 2026, amount: 200000 },
  ];

  const studioTargetAllocations = [];
  const boardTargetBaselines = [
  { year: 2026, customerName: "Banco Itau S.A.", businessUnit: "BU Financial", hunterTarget: 500000, farmerRenewalTarget: 300000, totalTarget: 800000 },
  { year: 2026, customerName: "Nuclea Pagamentos", businessUnit: "BU Financial", hunterTarget: 200000, farmerRenewalTarget: 150000, totalTarget: 350000 },
  { year: 2026, customerName: "B3 Capital Markets", businessUnit: "BU Financial", hunterTarget: 400000, farmerRenewalTarget: 250000, totalTarget: 650000 },
];
  const areas = [
    { id: "area-1", name: "Area 1", description: "Desc" },
  ];

  const filters = {
    includeNewLogos: false,
    hunterScope: { enabled: false, person: null, customerIds: new Set(customers.map((c) => c.id)) },
    targetYear: 2026,
  };

  const data = buildDashboardData(people, customers, customerTargets, targetAllocations, studioTargetAllocations, boardTargetBaselines, areas, filters);

  assertEqual(data.summary.customerCount, 3, "customerCount");
  assertEqual(data.summary.activePeopleCount, 7, "activePeopleCount (exclui Gabriel inativo)");
  assertEqual(data.summary.directorCount, 2, "directorCount");
  assertEqual(data.summary.managerCount, 2, "managerCount");
  assertEqual(data.summary.totalTarget, 1800000, "totalTarget");
  assertEqual(data.summary.allocatedPeopleTotal, 1050000, "allocatedPeopleTotal");
  assertEqual(data.summary.achievementPercentage, 58.33, "achievementPercentage");
  assertEqual(data.summary.peopleDelta, -750000, "peopleDelta");

  assertArrayLength(data.financialByCustomer, 3, "financialByCustomer length");
  assertArrayLength(data.financialByDirector, 1, "financialByDirector length");
  assertArrayLength(data.financialByManager, 2, "financialByManager length");

  assertEqual(data.financialByDirector[0].name, "Ana Silva", "director name");
  assertEqual(data.financialByDirector[0].revenueTarget, 1800000, "director revenueTarget");
  assertEqual(data.financialByDirector[0].hunterRevenue, 1100000, "director hunterRevenue");
  assertEqual(data.financialByDirector[0].deliveryFarmerRevenue, 700000, "director deliveryFarmerRevenue");

  assertEqual(data.financialByManager[0].name, "Ana Silva", "manager name");
  assertEqual(data.financialByManager[1].name, "Helena Costa", "manager name 2");

  assertArrayLength(data.roleDistribution, 4, "roleDistribution length");
  assertArrayLength(data.clientsByManager, 2, "clientsByManager length");
  assertArrayLength(data.clientsByDirector, 2, "clientsByDirector length");

  const totalTargetSum = data.financialByCustomer.reduce((sum, c) => sum + c.revenueTarget, 0);
  assertEqual(totalTargetSum, 1800000, "sum of customer targets equals totalTarget");

  const totalAllocatedSum = data.financialByCustomer.reduce((sum, c) => sum + c.revenueCurrent, 0);
  assertEqual(totalAllocatedSum, 1050000, "sum of customer allocated equals allocatedPeopleTotal");

  const alerts = data.alerts;
  assertArrayLength(alerts, 1, "alerts count");
  assertEqual(alerts[0].type, "activePersonWithoutTarget", "alert type for active person without target");

  console.log("All dashboard metric contract tests passed.");
}

runTests();