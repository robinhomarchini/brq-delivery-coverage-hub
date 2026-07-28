import { createSupabaseDeliveryRepository } from "../src/lib/repositories/supabaseDeliveryRepository";
import { getSupabaseBrowserClient } from "../src/lib/supabase/client";
import { buildDashboardData } from "../src/lib/dashboardMetrics";

const TARGET_YEAR = 2026;
const TOLERANCE = 0.02;

function assertAlmostEqual(actual: number, expected: number, message: string, tolerance = TOLERANCE) {
  if (Math.abs(Number(actual) - Number(expected)) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}, tolerance ${tolerance}`);
  }
}

function assertEqual(actual: number | string, expected: number | string, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function runReconciliation() {
  const repository = createSupabaseDeliveryRepository();
  if (!repository) {
    console.log("SKIP - Supabase delivery repository is not configured in this environment.");
    return;
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    console.log("SKIP - Supabase browser client is not configured in this environment.");
    return;
  }

  const tableNames = [
    "areas",
    "people",
    "customers",
    "customer_target_years",
    "revenue_target_allocations",
    "studio_target_allocations",
    "board_target_baselines",
  ];

  const tableResults = await Promise.all(
    tableNames.map((table) => client.from(table).select("*").then((r) => ({ table, data: r.data ?? [], error: r.error }))),
  );

  const failed = tableResults.find((item) => item.error);
  if (failed) {
    const message = failed.error?.message ?? String(failed.error);
    if (failed.table === "areas" && (message.includes("permission denied") || message.includes("JWT"))) {
      console.log("SKIP - Cannot read areas without authentication. Reconciliation against real data requires an authenticated Supabase session.");
      return;
    }
    throw new Error(`Failed to read ${failed.table}: ${message}`);
  }

  const emptyTables = tableResults.filter((item) => item.data.length === 0 && item.table !== "board_target_baselines").map((item) => item.table);
  if (emptyTables.length > 0 && tableResults.some((item) => item.table === "areas" && item.data.length > 0)) {
    // areas is available but core tables are empty -> likely RLS without auth
    console.log("SKIP - Some tables returned empty data without authentication. Reconciliation requires an authenticated Supabase session.");
    return;
  }

  const areas = tableResults.find((item) => item.table === "areas")?.data ?? [];
  const people = tableResults.find((item) => item.table === "people")?.data ?? [];
  const customers = tableResults.find((item) => item.table === "customers")?.data ?? [];
  const customerTargets = tableResults.find((item) => item.table === "customer_target_years")?.data ?? [];
  const targetAllocations = tableResults.find((item) => item.table === "revenue_target_allocations")?.data ?? [];
  const studioTargetAllocations = tableResults.find((item) => item.table === "studio_target_allocations")?.data ?? [];
  const boardTargetBaselines = tableResults.find((item) => item.table === "board_target_baselines")?.data ?? [];

  const mappedCustomers = customers.map((row) => ({
    id: row.id,
    name: row.name,
    industry: row.industry,
    directorResponsibleId: row.director_responsible_id,
    managerResponsibleIds: row.manager_responsible_ids ?? (row.manager_responsible_id ? [row.manager_responsible_id] : []),
    hunterTarget: Number(row.hunter_target ?? 0),
    farmerRenewalTarget: Number(row.farmer_renewal_target ?? 0),
    studioHunterTarget: Number(row.studio_hunter_target ?? 0),
    studioTarget: Number(row.studio_target ?? 0),
    revenue: Number(row.revenue ?? 0),
    countsTowardTarget: row.counts_toward_target ?? true,
    targetExclusionReason: row.target_exclusion_reason,
    margin: Number(row.margin ?? 0),
    strategicAccount: row.strategic_account ?? false,
    active: row.active ?? true,
    lifecycleStatus: row.lifecycle_status,
    closedAt: row.closed_at,
    closedReason: row.closed_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const mappedCustomerTargets = customerTargets.map((row) => ({
    customerId: row.customer_id,
    year: row.target_year,
    hunterTarget: Number(row.hunter_target ?? 0),
    farmerRenewalTarget: Number(row.farmer_renewal_target ?? 0),
    studioHunterTarget: Number(row.studio_hunter_target ?? 0),
    studioTarget: Number(row.studio_target ?? 0),
    revenue: Number(row.revenue ?? 0),
    countsTowardTarget: row.counts_toward_target ?? true,
    targetExclusionReason: row.target_exclusion_reason,
  }));

  const mappedTargetAllocations = targetAllocations.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    personId: row.person_id,
    type: row.target_type,
    year: row.target_year,
    amount: Number(row.amount ?? 0),
    ownAmount: row.own_amount != null ? Number(row.own_amount) : undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const mappedStudioTargetAllocations = studioTargetAllocations.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    areaId: row.area_id,
    hunterPersonId: row.hunter_person_id,
    maintenancePersonId: row.maintenance_person_id,
    year: row.target_year,
    amount: Number(row.amount ?? 0),
    hunterAmount: Number(row.hunter_amount ?? 0),
    maintenanceAmount: Number(row.maintenance_amount ?? 0),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const mappedBoardTargetBaselines = boardTargetBaselines.map((row) => ({
    year: row.baseline_year,
    customerName: row.customer_name,
    businessUnit: row.business_unit,
    hunterTarget: Number(row.hunter_target ?? 0),
    farmerRenewalTarget: Number(row.farmer_renewal_target ?? 0),
    totalTarget: Number(row.total_target ?? 0),
  }));

  const mappedAreas = areas.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    managerId: row.manager_id,
    notes: row.notes,
    active: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const mappedPeople = people.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title,
    directorId: row.director_id,
    managerId: row.manager_id,
    roleType: row.role_type,
    areaId: row.area_id,
    clientIds: row.client_ids ?? [],
    photoUrl: row.photo_url,
    notes: row.notes,
    active: row.active ?? true,
    lifecycleStatus: row.lifecycle_status,
    closedAt: row.closed_at,
    closedReason: row.closed_reason,
    isManager: row.is_manager ?? false,
    hierarchyLevel: row.hierarchy_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const filters = {
    includeNewLogos: false,
    hunterScope: { enabled: false, person: null, customerIds: new Set<string>() },
    targetYear: TARGET_YEAR,
  };

  console.log(`Reconciliation inputs: customers=${mappedCustomers.length}, customerTargets=${mappedCustomerTargets.length}, targetAllocations=${mappedTargetAllocations.length}, studioTargetAllocations=${mappedStudioTargetAllocations.length}, areas=${mappedAreas.length}, people=${mappedPeople.length}, boardTargetBaselines=${mappedBoardTargetBaselines.length}`);

  const localResult = buildDashboardData(
    mappedPeople,
    mappedCustomers,
    mappedCustomerTargets,
    mappedTargetAllocations,
    mappedStudioTargetAllocations,
    mappedBoardTargetBaselines,
    mappedAreas,
    filters,
  );

  const sqlResult = await repository.getDashboardSummary({
    targetYear: TARGET_YEAR,
    includeNewLogos: false,
    hunterScopeEnabled: false,
    hunterPersonId: null,
    hunterCustomerIds: [],
  });

  const localSummary = localResult.summary;
  const sqlSummary = sqlResult.summary;

  console.log("SQL summary:", JSON.stringify(sqlSummary, null, 2));
  console.log("Local summary:", JSON.stringify(localSummary, null, 2));

  assertAlmostEqual(sqlSummary.totalTarget, localSummary.totalTarget, "totalTarget");
  assertAlmostEqual(sqlSummary.boardTotalTarget, localSummary.totalTarget, "boardTotalTarget against local totalTarget");
  assertAlmostEqual(sqlSummary.hunterTarget, localSummary.hunterTarget, "hunterTarget");
  assertAlmostEqual(sqlSummary.farmerRenewalTarget, localSummary.farmerRenewalTarget, "farmerRenewalTarget");
  assertAlmostEqual(sqlSummary.allocatedPeopleTotal, localSummary.allocatedPeopleTotal, "allocatedPeopleTotal");
  assertAlmostEqual(sqlSummary.peopleDelta, localSummary.peopleDelta, "peopleDelta");
  assertAlmostEqual(sqlSummary.achievementPercentage, localSummary.achievementPercentage, "achievementPercentage");
  assertEqual(sqlSummary.customerCount, localSummary.customerCount, "customerCount");
  assertEqual(sqlSummary.activePeopleCount, localSummary.activePeopleCount, "activePeopleCount");
  assertEqual(sqlSummary.directorCount, localSummary.directorCount, "directorCount");
  assertEqual(sqlSummary.managerCount, localSummary.managerCount, "managerCount");

  const localCustomerMap = new Map(localResult.financialByCustomer.map((item) => [item.customerCluster, item]));
  const sqlCustomerMap = new Map(sqlResult.financialByCustomer.map((item) => [item.customerCluster, item]));

  const allClusters = new Set([...localCustomerMap.keys(), ...sqlCustomerMap.keys()]);
  for (const cluster of allClusters) {
    const local = localCustomerMap.get(cluster);
    const sql = sqlCustomerMap.get(cluster);
    if (!local || !sql) continue;
    assertAlmostEqual(sql.revenueCurrent, local.revenueCurrent, `revenueCurrent for ${cluster}`);
    assertAlmostEqual(sql.revenueTarget, local.revenueTarget, `revenueTarget for ${cluster}`);
    assertAlmostEqual(sql.hunterRevenue, local.hunterRevenue, `hunterRevenue for ${cluster}`);
    assertAlmostEqual(sql.deliveryFarmerRevenue, local.deliveryFarmerRevenue, `deliveryFarmerRevenue for ${cluster}`);
  }

  console.log("Reconciliation tests passed: SQL metric layer matches local dashboard calculations.");
}

runReconciliation().catch((error) => {
  console.error("FAIL - reconciliation failed:", JSON.stringify(error, null, 2));
  process.exit(1);
});
