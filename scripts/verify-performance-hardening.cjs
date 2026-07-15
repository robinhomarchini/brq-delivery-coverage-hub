/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const targetManagementPath = path.join(root, "src", "components", "targets", "target-management.tsx");
const personTargetAssignmentPath = path.join(root, "src", "components", "targets", "person-target-assignment.tsx");
const customerManagementPath = path.join(root, "src", "components", "customers", "customer-management.tsx");
const customerCoverageViewModelPath = path.join(root, "src", "lib", "customers", "customer-coverage-view-model.ts");
const customerTargetTotalPath = path.join(root, "src", "lib", "customer-target-total.ts");
const personTargetReportPath = path.join(root, "src", "components", "reports", "person-target-report.tsx");
const customerPortfolioPath = path.join(root, "src", "components", "portfolio", "customer-portfolio-management.tsx");
const deliveryStorePath = path.join(root, "src", "store", "delivery-store.tsx");
const boardTargetBaselinePath = path.join(root, "src", "lib", "board-target-baseline.ts");
const targetBaselineImportPath = path.join(root, "src", "lib", "target-baseline-import.ts");
const studioBaselineImportPath = path.join(root, "src", "lib", "studio-baseline-import.ts");
const exportPath = path.join(root, "src", "lib", "export.ts");
const localRepositoryPath = path.join(root, "src", "lib", "repositories", "localDeliveryRepository.ts");
const supabaseRepositoryPath = path.join(root, "src", "lib", "repositories", "supabaseDeliveryRepository.ts");
const performanceMigrationPath = path.join(root, "supabase", "migrations", "20260709113000_performance_indexes_for_target_reports.sql");
const packagePath = path.join(root, "package.json");

const targetManagementSource = fs.readFileSync(targetManagementPath, "utf8");
const personTargetAssignmentSource = fs.readFileSync(personTargetAssignmentPath, "utf8");
const customerManagementSource = fs.readFileSync(customerManagementPath, "utf8");
const customerCoverageViewModelSource = fs.readFileSync(customerCoverageViewModelPath, "utf8");
const customerTargetTotalSource = fs.readFileSync(customerTargetTotalPath, "utf8");
const personTargetReportSource = fs.readFileSync(personTargetReportPath, "utf8");
const customerPortfolioSource = fs.readFileSync(customerPortfolioPath, "utf8");
const deliveryStoreSource = fs.readFileSync(deliveryStorePath, "utf8");
const boardTargetBaselineSource = fs.readFileSync(boardTargetBaselinePath, "utf8");
const targetBaselineImportSource = fs.readFileSync(targetBaselineImportPath, "utf8");
const studioBaselineImportSource = fs.readFileSync(studioBaselineImportPath, "utf8");
const exportSource = fs.readFileSync(exportPath, "utf8");
const localRepositorySource = fs.readFileSync(localRepositoryPath, "utf8");
const supabaseRepositorySource = fs.readFileSync(supabaseRepositoryPath, "utf8");
const performanceMigrationSource = fs.readFileSync(performanceMigrationPath, "utf8");
const packageSource = fs.readFileSync(packagePath, "utf8");

assertIncludes(targetManagementSource, "buildCustomerAllocationSummary", "Target management must build one yearly customer allocation summary.");
assertIncludes(targetManagementSource, "allocationSummaryByCustomer", "Target management must reuse the allocation summary in memoized view models.");
assertIncludes(targetManagementSource, "customerNamesById", "Target management must use indexed customer lookups in render/filter paths.");
assertIncludes(targetManagementSource, "peopleNamesById", "Target management must use indexed people lookups in render/filter paths.");
assertNotIncludes(targetManagementSource, "function sumAllocations(", "Target management must not recalculate customer allocation totals per row.");
assertIncludes(personTargetAssignmentSource, "effectiveSelectedCustomerId", "Person target assignment must keep an explicit focused customer state.");
assertIncludes(personTargetAssignmentSource, "visibleCustomers.filter((customer) => customer.id === effectiveSelectedCustomerId)", "Person target assignment focused customer selector must filter the grid.");
assertIncludes(personTargetAssignmentSource, "Todos os clientes da pessoa", "Person target assignment must let users clear the focused customer filter.");
assertIncludes(customerManagementSource, "@/lib/customers/customer-coverage-view-model", "Customer management must consume the extracted coverage view model.");
assertIncludes(customerTargetTotalSource, "getCustomerTotalTarget", "Customer total target calculation must stay centralized.");
assertIncludes(customerTargetTotalSource, "hunterTarget + farmerRenewalTarget", "Customer total target must be Hunter plus Renewal/Expansion only.");
[
  customerManagementSource,
  customerCoverageViewModelSource,
  personTargetReportSource,
  targetManagementSource,
  personTargetAssignmentSource,
  boardTargetBaselineSource,
  targetBaselineImportSource,
  deliveryStoreSource,
  studioBaselineImportSource,
  exportSource,
  localRepositorySource,
  supabaseRepositorySource,
].forEach((source) => {
  assertNotIncludes(source, "hunterTarget + customer.farmerRenewalTarget + customer.studioTarget", "Customer total target must not add Studio maintenance directly.");
  assertNotIncludes(source, "customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget", "Customer total target must not add Studio maintenance directly.");
  assertNotIncludes(source, "hunterTarget + farmerRenewalTarget + studioTarget", "Customer total target must not add Studio maintenance directly.");
});
assertIncludes(customerCoverageViewModelSource, "export function getCustomerCoverageStatus", "Customer coverage status must stay outside the UI component.");
assertIncludes(customerCoverageViewModelSource, "export function getCustomerAllocationComposition", "Customer allocation composition must stay outside the UI component.");
assertIncludes(customerCoverageViewModelSource, "export function getCustomerStudioComposition", "Customer studio composition must stay outside the UI component.");
assertNotIncludes(customerManagementSource, "function getCustomerCoverageStatus(", "Customer management must not reintroduce coverage calculations inline.");
assertNotIncludes(customerManagementSource, "function getCustomerAllocationComposition(", "Customer management must not reintroduce allocation composition inline.");
assertNotIncludes(customerManagementSource, "function sortCustomerRows(", "Customer management must not sort rows with inline derived calculations.");
assertIncludes(personTargetReportSource, "const hunterClientTotals = useMemo", "Person target report must memoize Hunter x Clientes footer totals.");
assertIncludes(personTargetReportSource, "function summarizeHunterClientRows", "Person target report must centralize Hunter x Clientes totalization.");
assertIncludes(personTargetReportSource, "function sumAmount", "Person target report must reuse a small amount totalizer for report footers.");
assertNotIncludes(personTargetReportSource, "filteredHunterClientRows.reduce((total, row) => total + row.hunterAmount", "Person target report must not calculate Hunter x Clientes footer totals inline in JSX.");
assertNotIncludes(personTargetReportSource, "filteredSpecialistHunterRows.reduce((total, row) => total + row.amount", "Person target report must not calculate Specialist Hunter footer totals inline in JSX.");
assertNotIncludes(personTargetReportSource, "filteredDirectorDetailRows.reduce((total, row) => total + row.amount", "Person target report must not calculate Director footer totals inline in JSX.");
assertIncludes(customerPortfolioSource, "hunterIds: string[]", "Customer portfolio must expose Hunters/commercial participants separately.");
assertIncludes(customerPortfolioSource, "person.clientIds.includes(customerId)", "Customer portfolio must derive portfolio participants from person-customer assignments.");
assertIncludes(customerPortfolioSource, "allocation.type === \"hunter\"", "Customer portfolio must include Hunters from target allocations.");
assertIncludes(customerPortfolioSource, "allocation.hunterPersonId", "Customer portfolio must include Hunters from Studio allocations.");
assertIncludes(customerPortfolioSource, "<TableHead>Hunter / Comercial</TableHead>", "Customer portfolio table must show Hunter/commercial participants.");
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
assertIncludes(studioBaselineImportSource, "buildStudioAllocationIndex", "Studio baseline comparison must pre-index allocations by customer/studio/year.");
assertIncludes(studioBaselineImportSource, "allocationsByCustomerArea", "Studio baseline comparison must reuse indexed allocation totals per row.");
assertNotIncludes(studioBaselineImportSource, "studioAllocations.filter((allocation) =>", "Studio baseline comparison must not scan all Studio allocations for every baseline row.");
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
