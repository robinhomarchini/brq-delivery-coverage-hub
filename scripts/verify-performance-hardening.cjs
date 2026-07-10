/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const targetManagementPath = path.join(root, "src", "components", "targets", "target-management.tsx");
const personTargetReportPath = path.join(root, "src", "components", "reports", "person-target-report.tsx");
const deliveryStorePath = path.join(root, "src", "store", "delivery-store.tsx");
const performanceMigrationPath = path.join(root, "supabase", "migrations", "20260709113000_performance_indexes_for_target_reports.sql");
const packagePath = path.join(root, "package.json");

const targetManagementSource = fs.readFileSync(targetManagementPath, "utf8");
const personTargetReportSource = fs.readFileSync(personTargetReportPath, "utf8");
const deliveryStoreSource = fs.readFileSync(deliveryStorePath, "utf8");
const performanceMigrationSource = fs.readFileSync(performanceMigrationPath, "utf8");
const packageSource = fs.readFileSync(packagePath, "utf8");

assertIncludes(targetManagementSource, "buildCustomerAllocationSummary", "Target management must build one yearly customer allocation summary.");
assertIncludes(targetManagementSource, "allocationSummaryByCustomer", "Target management must reuse the allocation summary in memoized view models.");
assertIncludes(targetManagementSource, "customerNamesById", "Target management must use indexed customer lookups in render/filter paths.");
assertIncludes(targetManagementSource, "peopleNamesById", "Target management must use indexed people lookups in render/filter paths.");
assertNotIncludes(targetManagementSource, "function sumAllocations(", "Target management must not recalculate customer allocation totals per row.");
assertIncludes(personTargetReportSource, "const hunterClientTotals = useMemo", "Person target report must memoize Hunter x Clientes footer totals.");
assertIncludes(personTargetReportSource, "function summarizeHunterClientRows", "Person target report must centralize Hunter x Clientes totalization.");
assertIncludes(personTargetReportSource, "function sumAmount", "Person target report must reuse a small amount totalizer for report footers.");
assertNotIncludes(personTargetReportSource, "filteredHunterClientRows.reduce((total, row) => total + row.hunterAmount", "Person target report must not calculate Hunter x Clientes footer totals inline in JSX.");
assertNotIncludes(personTargetReportSource, "filteredSpecialistHunterRows.reduce((total, row) => total + row.amount", "Person target report must not calculate Specialist Hunter footer totals inline in JSX.");
assertNotIncludes(personTargetReportSource, "filteredDirectorDetailRows.reduce((total, row) => total + row.amount", "Person target report must not calculate Director footer totals inline in JSX.");
assertIncludes(deliveryStoreSource, "syncStudioDerivedTargetsFromStudioAllocations", "Delivery store must keep Studio-derived person totals fresh after partial Studio saves.");
assertIncludes(deliveryStoreSource, "getAffectedStudioHunterKeys", "Delivery store must update both previous and current Studio Hunter owners.");
assertIncludes(deliveryStoreSource, "setTargetAllocations((current) => syncStudioDerivedTargetsFromStudioAllocations", "Delivery store must avoid full reload while synchronizing affected Studio-derived targets.");
assertIncludes(deliveryStoreSource, "getEligibleStudioRenewalAmountForPerson", "Delivery store must roll eligible Studio renewal into Farmer/Delivery targets.");
assertIncludes(deliveryStoreSource, "item.hunterPersonId === id || item.maintenancePersonId === id", "Delivery store must clear deleted people from Studio Hunter and Studio maintenance assignments.");
assertIncludes(deliveryStoreSource, "maintenancePersonId: item.maintenancePersonId === id ? undefined : item.maintenancePersonId", "Delivery store must clear deleted people from Studio maintenance assignments.");
assertIncludes(deliveryStoreSource, "for (const personId of [allocation.hunterPersonId, allocation.maintenancePersonId])", "Delivery store must refresh both Studio Hunter and maintenance responsible person totals.");
assertIncludes(deliveryStoreSource, "setCustomerTargets((current) => current.filter((item) => item.customerId !== id))", "Delivery store must clear customer target snapshots after partial customer delete.");
assertIncludes(deliveryStoreSource, "removedStudioAllocationIds", "Delivery store must clear specialist Hunter selections linked to deleted customer Studio allocations.");
assertIncludes(deliveryStoreSource, "const saved = await repository.saveSubject(subject)", "Delivery store must use canonical saved Subject returned by the repository.");
assertIncludes(performanceMigrationSource, "revenue_target_allocations_customer_person_type_year_idx", "Performance migration must index target allocation lookup by customer/person/type/year.");
assertIncludes(performanceMigrationSource, "studio_target_allocations_customer_area_year_idx", "Performance migration must index studio allocation lookup by customer/area/year.");
assertIncludes(performanceMigrationSource, "specialist_hunter_studio_assignments_person_year_idx", "Performance migration must index specialist hunter report lookup by person/year.");
assertIncludes(packageSource, "\"test:performance\": \"node scripts/verify-performance-hardening.cjs\"", "package.json must expose test:performance.");

console.log("Performance hardening QA checks passed.");

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
