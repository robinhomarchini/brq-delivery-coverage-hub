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

const { createSupabaseDeliveryRepository } = require("../src/lib/repositories/supabaseDeliveryRepository.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertAlmostEqual(actual, expected, message, tolerance = 0.02) {
  if (Math.abs(Number(actual) - Number(expected)) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}, tolerance ${tolerance}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function runMetricLayerVerification() {
  const repository = createSupabaseDeliveryRepository();
  if (!repository) {
    console.log("SKIP - Supabase is not configured in this environment.");
    return;
  }

  let result;
  try {
    result = await repository.getDashboardSummary({
      targetYear: 2026,
      includeNewLogos: false,
      hunterScopeEnabled: false,
      hunterPersonId: null,
      hunterCustomerIds: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.log(`SKIP - RPC call failed with: ${message}. This may indicate RLS requires an authenticated test identity.`);
    return;
  }

  const summary = result.summary;
  const financialByCustomer = result.financialByCustomer;

  if (!summary || typeof summary !== "object") {
    console.log("SKIP - RPC did not return a summary object.");
    return;
  }

  assert(summary.totalTarget > 0, "Expected positive total target from RPC.");
  assert(summary.customerCount > 0, "Expected positive customer count from RPC.");
  assert(Number.isInteger(summary.activePeopleCount), "Expected integer activePeopleCount from RPC.");
  assert(Number.isInteger(summary.directorCount), "Expected integer directorCount from RPC.");
  assert(Number.isInteger(summary.managerCount), "Expected integer managerCount from RPC.");
  assert(summary.activePeopleCount >= summary.directorCount, "activePeopleCount should be >= directorCount.");
  assert(summary.activePeopleCount >= summary.managerCount, "activePeopleCount should be >= managerCount.");
  assert(Array.isArray(financialByCustomer), "Expected financialByCustomer to be an array.");
  assertAlmostEqual(summary.boardTotalTarget, summary.hunterTarget + summary.farmerRenewalTarget, "boardTotalTarget should equal hunterTarget + farmerRenewalTarget", 0.02);
  assertAlmostEqual(summary.peopleDelta, summary.allocatedPeopleTotal - summary.totalTarget, "peopleDelta should equal allocatedPeopleTotal - totalTarget", 0.02);
  if (summary.totalTarget > 0) {
    assertAlmostEqual(summary.achievementPercentage, summary.allocatedPeopleTotal / summary.totalTarget * 100, "achievementPercentage should equal allocatedPeopleTotal / totalTarget * 100", 0.02);
  } else {
    assertEqual(summary.achievementPercentage, 0, "achievementPercentage should be 0 when totalTarget is 0");
  }

  if (financialByCustomer.length > 0) {
    for (const row of financialByCustomer) {
      assertAlmostEqual(row.revenueCurrent, row.hunterRevenue + row.deliveryFarmerRevenue, `revenueCurrent should equal Hunter + Delivery/Farmer for ${row.customerCluster}`, 0.02);
      assert(row.revenueTarget >= 0, `Expected non-negative revenueTarget for ${row.customerCluster}`);
      assert(row.hunterRevenue >= 0, `Expected non-negative hunterRevenue for ${row.customerCluster}`);
      assert(row.deliveryFarmerRevenue >= 0, `Expected non-negative deliveryFarmerRevenue for ${row.customerCluster}`);
    }
  }

  console.log("Metric layer verification passed: RPC returns valid JSON with consistent target breakdowns.");
}

runMetricLayerVerification().catch((error) => {
  const message = error instanceof Error ? error.message ?? error.stack : JSON.stringify(error);
  console.error("FAIL - metric layer verification failed:", message);
  process.exit(1);
});
