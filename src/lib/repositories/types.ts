import type { Area, Customer, CustomerTarget, Person, PersonCompensation, SpecialistHunterStudioAssignment, StudioTargetAllocation, Subject, TargetAllocation } from "@/data/mockData";
import type { BoardTargetBaselineRow } from "@/data/boardTargetBaseline";
import type { StudioBaselineSnapshot } from "@/lib/studio-baseline-import";
import type { TargetBaselineSnapshot } from "@/lib/target-baseline-import";

export interface AreaUsage {
  areaId: string;
  peopleCount: number;
  territoryCount: number;
}

export interface PersonCustomerTargetsInput {
  customerId: string;
  personId: string;
  year: number;
  hunterAmount: number;
  hunterOwnAmount?: number;
  farmerRenewalAmount: number;
  studioAmount: number;
  increaseCustomerTarget: boolean;
  allowSpecialistHunterAsCustomerHunter?: boolean;
  notes?: string;
}

export interface PersonCustomerRemovalInput {
  customerId: string;
  personId: string;
}

export interface SpecialistHunterStudioAssignmentsInput {
  personId: string;
  customerId: string;
  year: number;
  studioTargetAllocationIds: string[];
  assignedAmounts?: Record<string, number>;
}

export interface DeliveryData {
  people: Person[];
  personCompensations: PersonCompensation[];
  customers: Customer[];
  customerTargets: CustomerTarget[];
  subjects: Subject[];
  areas: Area[];
  areaUsages: AreaUsage[];
  targetAllocations: TargetAllocation[];
  studioTargetAllocations: StudioTargetAllocation[];
  specialistHunterStudioAssignments: SpecialistHunterStudioAssignment[];
  boardTargetBaselines: BoardTargetBaselineRow[];
  studioBaselineSnapshots: StudioBaselineSnapshot[];
  targetBaselineSnapshots: TargetBaselineSnapshot[];
}

export interface DashboardMetricSummary {
  totalTarget: number;
  boardTotalTarget: number;
  hunterTarget: number;
  farmerRenewalTarget: number;
  allocatedPeopleTotal: number;
  peopleDelta: number;
  achievementPercentage: number;
  customerCount: number;
  activePeopleCount: number;
  directorCount: number;
  managerCount: number;
}

export interface CustomerPerformanceMetric {
  customerId: string;
  customerName: string;
  targetAmount: number;
  allocatedTotal: number;
  hunterAllocated: number;
  deliveryFarmerAllocated: number;
  responsiblePeopleCount: number;
  peopleDelta: number;
  achievementPercentage: number;
}

export interface CustomerPerformanceResult {
  items: CustomerPerformanceMetric[];
}

export interface DashboardMetricFinancialByCustomer {
  customerCluster: string;
  revenueCurrent: number;
  revenueTarget: number;
  hunterRevenue: number;
  deliveryFarmerRevenue: number;
}

export interface DashboardMetricResult {
  summary: DashboardMetricSummary;
  financialByCustomer: DashboardMetricFinancialByCustomer[];
}

export const DASHBOARD_METRIC_SUMMARY_FIELDS = [
  "totalTarget",
  "boardTotalTarget",
  "hunterTarget",
  "farmerRenewalTarget",
  "allocatedPeopleTotal",
  "peopleDelta",
  "achievementPercentage",
  "customerCount",
  "activePeopleCount",
  "directorCount",
  "managerCount",
] as const satisfies ReadonlyArray<keyof DashboardMetricSummary>;

export const DASHBOARD_METRIC_FINANCIAL_BY_CUSTOMER_FIELDS = [
  "customerCluster",
  "revenueCurrent",
  "revenueTarget",
  "hunterRevenue",
  "deliveryFarmerRevenue",
] as const satisfies ReadonlyArray<keyof DashboardMetricFinancialByCustomer>;

export function validateDashboardMetricResult(value: unknown): DashboardMetricResult {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { financialByCustomer?: unknown[] }).financialByCustomer)
  ) {
    throw new Error("Invalid dashboard metric result: expected object with financialByCustomer array");
  }

  const unsafe = value as Record<string, unknown>;
  const summary = unsafe.summary;

  if (
    !summary ||
    typeof summary !== "object" ||
    DASHBOARD_METRIC_SUMMARY_FIELDS.some((field) => !(field in summary))
  ) {
    throw new Error("Invalid dashboard metric summary: missing required fields");
  }

  const normalized = {
    summary: {
      totalTarget: Number((summary as Record<string, unknown>)["totalTarget"]),
      boardTotalTarget: Number((summary as Record<string, unknown>)["boardTotalTarget"]),
      hunterTarget: Number((summary as Record<string, unknown>)["hunterTarget"]),
      farmerRenewalTarget: Number((summary as Record<string, unknown>)["farmerRenewalTarget"]),
      allocatedPeopleTotal: Number((summary as Record<string, unknown>)["allocatedPeopleTotal"]),
      peopleDelta: Number((summary as Record<string, unknown>)["peopleDelta"]),
      achievementPercentage: Number((summary as Record<string, unknown>)["achievementPercentage"]),
      customerCount: Number((summary as Record<string, unknown>)["customerCount"]),
      activePeopleCount: Number((summary as Record<string, unknown>)["activePeopleCount"]),
      directorCount: Number((summary as Record<string, unknown>)["directorCount"]),
      managerCount: Number((summary as Record<string, unknown>)["managerCount"]),
    },
    financialByCustomer: (unsafe.financialByCustomer as Array<Record<string, unknown>>).map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        DASHBOARD_METRIC_FINANCIAL_BY_CUSTOMER_FIELDS.some((field) => !(field in item))
      ) {
        throw new Error("Invalid financialByCustomer item: missing required fields");
      }

      return {
        customerCluster: String(item.customerCluster),
        revenueCurrent: Number(item.revenueCurrent ?? 0),
        revenueTarget: Number(item.revenueTarget ?? 0),
        hunterRevenue: Number(item.hunterRevenue ?? 0),
        deliveryFarmerRevenue: Number(item.deliveryFarmerRevenue ?? 0),
      };
    }),
  };

  return normalized;
}

export interface DashboardSummaryFilters {
  targetYear: number;
  includeNewLogos: boolean;
  hunterScopeEnabled: boolean;
  hunterPersonId: string | null;
  hunterCustomerIds: string[];
}

export interface DeliveryRepository {
  getAll(): Promise<DeliveryData>;
  findCustomerById(id: string): Promise<Customer | null>;
  findPersonById(id: string): Promise<Person | null>;
  saveArea(area: Area): Promise<DeliveryData>;
  deleteArea(id: string): Promise<DeliveryData>;
  savePerson(person: Person): Promise<DeliveryData>;
  savePersonCompensation(compensation: PersonCompensation): Promise<DeliveryData>;
  deletePersonCompensation(personId: string): Promise<DeliveryData>;
  deletePerson(id: string): Promise<void>;
  saveCustomer(customer: Customer, targetYear?: number): Promise<DeliveryData>;
  saveCustomers(customers: Customer[], targetYear?: number): Promise<DeliveryData>;
  deleteCustomer(id: string): Promise<void>;
  saveSubject(subject: Subject): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;
  saveTargetAllocation(allocation: TargetAllocation): Promise<TargetAllocation>;
  deleteTargetAllocation(id: string): Promise<void>;
  saveStudioTargetAllocation(allocation: StudioTargetAllocation): Promise<StudioTargetAllocation>;
  deleteStudioTargetAllocation(id: string): Promise<void>;
  saveSpecialistHunterStudioAssignments(input: SpecialistHunterStudioAssignmentsInput): Promise<DeliveryData>;
  saveStudioBaselineSnapshot(snapshot: Omit<StudioBaselineSnapshot, "id" | "createdAt">): Promise<StudioBaselineSnapshot>;
  saveTargetBaselineSnapshot(snapshot: Omit<TargetBaselineSnapshot, "id" | "createdAt">): Promise<TargetBaselineSnapshot>;
  savePersonCustomerTargets(input: PersonCustomerTargetsInput): Promise<DeliveryData>;
  removePersonCustomerTargets(input: PersonCustomerRemovalInput): Promise<DeliveryData>;
  getDashboardSummary(filters: DashboardSummaryFilters): Promise<DashboardMetricResult>;
  getPerformanceByCustomer(filters: DashboardSummaryFilters): Promise<CustomerPerformanceResult>;
}
