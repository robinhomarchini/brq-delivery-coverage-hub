import type { Area, Customer, Person, Subject, TargetAllocation } from "@/data/mockData";

export interface PersonCustomerTargetsInput {
  customerId: string;
  personId: string;
  year: number;
  hunterAmount: number;
  farmerRenewalAmount: number;
  increaseCustomerTarget: boolean;
  notes?: string;
}

export interface DeliveryData {
  people: Person[];
  customers: Customer[];
  subjects: Subject[];
  areas: Area[];
  targetAllocations: TargetAllocation[];
}

export interface DeliveryRepository {
  getAll(): Promise<DeliveryData>;
  savePerson(person: Person): Promise<DeliveryData>;
  deletePerson(id: string): Promise<void>;
  saveCustomer(customer: Customer): Promise<DeliveryData>;
  deleteCustomer(id: string): Promise<void>;
  saveSubject(subject: Subject): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;
  saveTargetAllocation(allocation: TargetAllocation): Promise<TargetAllocation>;
  deleteTargetAllocation(id: string): Promise<void>;
  savePersonCustomerTargets(input: PersonCustomerTargetsInput): Promise<DeliveryData>;
}
