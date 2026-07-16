/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
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

const { getCustomerCoverageStatus } = require("../src/lib/customers/customer-coverage-view-model.ts");

const year = 2026;
const specialist = makePerson("specialist", "Marco Aurelio De Lima Guedea", "Hunter Especializado", ["csu", "professional-services"]);
const regularHunter = makePerson("hunter", "Marcelo Saugo", "Hunter", ["quod"]);
const zeroDelivery = makePerson("delivery", "Ana Braz", "Delivery", ["csu"]);
const people = [specialist, regularHunter, zeroDelivery];

assert.equal(
  getCustomerCoverageStatus(
    makeCustomer("csu", { hunterTarget: 400000, farmerRenewalTarget: 0, managerResponsibleIds: ["delivery"] }),
    people,
    [],
    [
      makeAllocation("csu-specialist", "csu", "specialist", "hunter", 400000),
      makeAllocation("csu-delivery-zero", "csu", "delivery", "farmer_renewal", 0),
    ],
    [],
    year,
  ).status,
  "specialist",
  "CSU must stay purple/specialist even when a zero-value Delivery relationship exists.",
);

assert.equal(
  getCustomerCoverageStatus(
    makeCustomer("professional-services", { hunterTarget: 1750000, farmerRenewalTarget: 0 }),
    people,
    [],
    [makeAllocation("professional-specialist", "professional-services", "specialist", "hunter", 1750000)],
    [],
    year,
  ).status,
  "specialist",
  "Professional Services must be specialist when the matched allocation is only Hunter Especializado.",
);

assert.equal(
  getCustomerCoverageStatus(
    makeCustomer("quod", { hunterTarget: 300000, farmerRenewalTarget: 0 }),
    people,
    [],
    [makeAllocation("quod-hunter", "quod", "hunter", "hunter", 300000)],
    [],
    year,
  ).status,
  "ok",
  "QUOD must be reconciled/blue when a normal Hunter covers a Hunter-only target.",
);

assert.equal(
  getCustomerCoverageStatus(
    makeCustomer("new-current-year", { hunterTarget: 300000, farmerRenewalTarget: 200000, countsTowardTarget: false }),
    people,
    [],
    [makeAllocation("new-current-year-hunter", "new-current-year", "hunter", "hunter", 300000)],
    [],
    year,
  ).status,
  "outOfTarget",
  "New Logo customers must not be marked as mismatched even when they keep control values.",
);

console.log("Customer coverage status checks passed.");

function makeCustomer(id, overrides = {}) {
  return {
    id,
    name: id,
    industry: "Financial Services",
    directorResponsibleId: "director",
    managerResponsibleIds: [],
    hunterTarget: 0,
    farmerRenewalTarget: 0,
    studioHunterTarget: 0,
    studioTarget: 0,
    revenue: 0,
    margin: 0,
    strategicAccount: false,
    lifecycleStatus: "active",
    ...overrides,
  };
}

function makePerson(id, name, roleType, clientIds = []) {
  return {
    id,
    name,
    email: `${id}@brq.com`,
    jobTitle: roleType,
    roleType,
    clientIds,
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 3,
  };
}

function makeAllocation(id, customerId, personId, type, amount) {
  return {
    id,
    customerId,
    personId,
    type,
    year,
    amount,
    ownAmount: amount,
  };
}
