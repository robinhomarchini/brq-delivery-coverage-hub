import { findTargetAllocationDuplicates } from "../src/lib/target-allocation-duplicates";
import type { Area, Customer, Person, StudioTargetAllocation, TargetAllocation } from "../src/data/mockData";

const customers: Customer[] = [{
  id: "customer-audit-qa",
  name: "Cliente Auditoria QA",
  industry: "Financial Services",
  directorResponsibleId: "director-qa",
  managerResponsibleIds: [],
  hunterTarget: 0,
  farmerRenewalTarget: 0,
  studioHunterTarget: 0,
  studioTarget: 0,
  revenue: 0,
  margin: 36.8,
  strategicAccount: false,
  lifecycleStatus: "active",
}];

const people: Person[] = [{
  id: "person-audit-qa",
  name: "Pessoa Auditoria QA",
  jobTitle: "Manager de Delivery",
  roleType: "Delivery",
  clientIds: ["customer-audit-qa"],
  active: true,
  lifecycleStatus: "active",
  isManager: false,
  hierarchyLevel: 3,
}, {
  id: "person-orphan-studio-qa",
  name: "Pessoa Studio Órfão QA",
  jobTitle: "Manager de Delivery",
  roleType: "Delivery",
  clientIds: ["customer-audit-qa"],
  active: true,
  lifecycleStatus: "active",
  isManager: false,
  hierarchyLevel: 3,
}];

const areas: Area[] = [{
  id: "area-salesforce-qa",
  name: "Salesforce",
  description: "Studio Salesforce QA.",
}];

const allocations: TargetAllocation[] = [{
  id: "target-audit-qa",
  customerId: "customer-audit-qa",
  personId: "person-audit-qa",
  type: "farmer_renewal",
  year: 2026,
  amount: 125,
  ownAmount: 100,
}, {
  id: "target-audit-inflated-duplicate-qa",
  customerId: "customer-audit-qa",
  personId: "person-audit-qa",
  type: "farmer_renewal",
  year: 2026,
  amount: 150,
  ownAmount: 125,
}];

const studioAllocations: StudioTargetAllocation[] = [{
  id: "studio-audit-qa",
  customerId: "customer-audit-qa",
  areaId: "area-salesforce-qa",
  maintenancePersonId: "person-audit-qa",
  year: 2026,
  hunterAmount: 0,
  maintenanceAmount: 25,
}, {
  id: "studio-orphan-maintenance-qa",
  customerId: "customer-audit-qa",
  areaId: "area-salesforce-qa",
  maintenancePersonId: "person-orphan-studio-qa",
  year: 2026,
  hunterAmount: 0,
  maintenanceAmount: 440756,
}];

const groups = findTargetAllocationDuplicates({
  allocations,
  customers,
  people,
  areas,
  studioAllocations,
});

assert(groups.some((group) => group.issueType === "duplicate_key" && group.items.length === 2), "Duplicate audit must find exact repeated Customer + Person + Type + Year keys.");
assert(groups.some((group) =>
  group.issueType === "contained_studio_review"
  && group.customerName === "Cliente Auditoria QA"
  && group.personName === "Pessoa Auditoria QA"
  && group.containedStudioAmount === 25
), "Duplicate audit must flag contained Studio review groups even when the duplicated key alone is not enough.");
assert(groups.some((group) =>
  group.issueType === "studio_without_person_total"
  && group.customerName === "Cliente Auditoria QA"
  && group.personName === "Pessoa Studio Órfão QA"
  && group.containedStudioAmount === 440756
), "Duplicate audit must flag Studio rows with value when the corresponding person target total is missing.");

console.log("Target allocation duplicate audit QA checks passed.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
