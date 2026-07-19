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

export interface DeliveryRepository {
  getAll(): Promise<DeliveryData>;
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
}
