import {
  financialSourceCustomerNames,
  getFinancialCustomerGovernance,
  getFinancialCustomerId,
  getFinancialCustomerMetric,
  splitAmount,
} from "@/lib/financial-customers";
import { targetMarginPercent } from "@/lib/financial-targets";
import type { LifecycleStatus } from "@/lib/lifecycle";
import { OTHER_DIRECTOR_ID, OTHER_DIRECTOR_NAME } from "@/lib/director-governance";

export type RoleType =
  | "Executive"
  | "Director"
  | "Farmer + Delivery"
  | "Delivery"
  | "Hunter"
  | "Hunter Especializado"
  | "Farmer"
  | "Hunter + Farmer"
  | "Staff";

export type SubjectStatus = "Ativo" | "Em evolução" | "Atenção" | "Planejado";

export interface Area {
  id: string;
  name: string;
  description: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  jobTitle: string;
  directorId?: string;
  managerId?: string;
  roleType: RoleType;
  areaId?: string;
  clientIds: string[];
  photoUrl?: string;
  notes?: string;
  active: boolean;
  lifecycleStatus: LifecycleStatus;
  closedAt?: string;
  closedReason?: string;
  isManager: boolean;
  hierarchyLevel: 1 | 2 | 3;
}

export interface PersonCompensation {
  personId: string;
  annualSalary: number;
  currency: "BRL";
  effectiveFrom: string;
  notes?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  industry: string;
  directorResponsibleId: string;
  managerResponsibleIds: string[];
  hunterTarget: number;
  farmerRenewalTarget: number;
  studioHunterTarget: number;
  studioTarget: number;
  revenue: number;
  margin: number;
  strategicAccount: boolean;
  lifecycleStatus: LifecycleStatus;
  closedAt?: string;
  closedReason?: string;
}

export interface CustomerTarget {
  customerId: string;
  year: number;
  hunterTarget: number;
  farmerRenewalTarget: number;
  studioHunterTarget: number;
  studioTarget: number;
  revenue: number;
}

export interface Subject {
  id: string;
  customerId: string;
  name: string;
  description: string;
  ownerPersonId?: string;
  status: SubjectStatus;
  strategic: boolean;
}

export type TargetAllocationType = "hunter" | "farmer_renewal" | "studio";

export interface TargetAllocation {
  id: string;
  customerId: string;
  personId: string;
  type: TargetAllocationType;
  year: number;
  amount: number;
  ownAmount?: number;
  notes?: string;
}

export interface StudioTargetAllocation {
  id: string;
  customerId: string;
  areaId: string;
  hunterPersonId?: string;
  maintenancePersonId?: string;
  year: number;
  hunterAmount: number;
  maintenanceAmount: number;
  notes?: string;
}

export interface SpecialistHunterStudioAssignment {
  id: string;
  personId: string;
  studioTargetAllocationId: string;
  year: number;
  notes?: string;
}

export const areas: Area[] = [
  { id: "area-financial", name: "Serviços Financeiros", description: "Bancos, seguros e meios de pagamento." },
  { id: "area-aliancas", name: "Alianças", description: "Parcerias, alianças estratégicas e ecossistema." },
  { id: "area-px", name: "PX", description: "People Experience e práticas de experiência." },
  { id: "area-mobile", name: "Mobile", description: "Produtos e soluções mobile." },
  { id: "area-ba", name: "BA", description: "Business Analysis e discovery funcional." },
  { id: "area-ia", name: "IA", description: "Inteligência Artificial, automação e agentes." },
  { id: "area-dados", name: "Dados", description: "Dados, analytics, engenharia e governança." },
  { id: "area-industry", name: "Indústria & Varejo", description: "Indústria, consumo, varejo e logística." },
  { id: "area-digital", name: "Digital & Growth", description: "Novos negócios, tecnologia e plataformas digitais." },
  { id: "area-corporate", name: "Estratégia & Operações", description: "Gestão executiva, operações e pré-vendas." },
];

export const customers: Customer[] = financialSourceCustomerNames.map((name) => ({
  id: getFinancialCustomerId(name),
  name,
  industry: "Financial Services",
  ...getFinancialCustomerGovernance(name),
  hunterTarget: getFinancialCustomerMetric(name, "hunterRevenue"),
  farmerRenewalTarget: getFinancialCustomerMetric(name, "deliveryFarmerRevenue"),
  studioHunterTarget: 0,
  studioTarget: 0,
  revenue: getFinancialCustomerMetric(name, "revenueTarget"),
  margin: targetMarginPercent,
  strategicAccount: true,
  lifecycleStatus: "active",
}));

export const specialistHunterStudioAssignments: SpecialistHunterStudioAssignment[] = [];

export const customerTargets: CustomerTarget[] = customers.map((customer) => ({
  customerId: customer.id,
  year: 2026,
  hunterTarget: customer.hunterTarget,
  farmerRenewalTarget: customer.farmerRenewalTarget,
  studioHunterTarget: customer.studioHunterTarget,
  studioTarget: customer.studioTarget,
  revenue: customer.revenue,
}));

const subject = (
  id: string,
  customerId: string,
  name: string,
  ownerPersonId: string,
  status: SubjectStatus = "Ativo",
  strategic = false,
): Subject => ({
  id,
  customerId,
  name,
  ownerPersonId,
  status,
  strategic,
  description: `Frente de atuação de ${name} no cliente.`,
});

export const subjects: Subject[] = [
  subject("subject-itau-data", getFinancialCustomerId("BANCO ITAÚ S.A."), "Dados", "bruno", "Ativo", true),
  subject("subject-itau-checking", getFinancialCustomerId("BANCO ITAÚ S.A."), "Conta Corrente", "orion", "Ativo", true),
  subject("subject-itau-investments", getFinancialCustomerId("BANCO ITAÚ S.A."), "Investimentos", "fernanda", "Em evolução", true),
  subject("subject-itau-cards", getFinancialCustomerId("BANCO ITAÚ S.A."), "Cartões", "bonfim"),
  subject("subject-alelo-benefits", "client-alelo", "Benefícios", "ana", "Ativo", true),
  subject("subject-alelo-data", "client-alelo", "Dados", "ana", "Em evolução"),
  subject("subject-nuclea-payments", "client-cip", "Pagamentos", "ana", "Ativo", true),
  subject("subject-nuclea-data", "client-cip", "Dados", "ana"),
  subject("subject-santander-checking", "client-santander", "Conta Corrente", "ana", "Ativo", true),
  subject("subject-santander-investments", "client-santander", "Investimentos", "ana", "Ativo", true),
  subject("subject-b3-capital-markets", "client-b3", "Mercado de Capitais", "ana", "Ativo", true),
  subject("subject-btg-investments", "client-banco-pactual", "Investimentos", "ana", "Ativo", true),
  subject("subject-bv-auto", "client-votorantim", "Financiamento", "ana", "Ativo"),
  subject("subject-xp-investments", "client-xp-investimentos", "Investimentos", "ana", "Em evolução", true),
];

const clientIdsFor = (managerId: string) =>
  customers.filter((customer) => customer.managerResponsibleIds.includes(managerId)).map((customer) => customer.id);

const managerArea: Record<string, string> = {
  flavia: "area-financial",
  ana: "area-financial",
  everton: "area-financial",
  varella: "area-financial",
  giullia: "area-financial",
  cris: "area-financial",
  gabriela: "area-financial",
  gege: "area-financial",
  bresciani: "area-financial",
  andreia: "area-financial",
  orion: "area-financial",
  fernanda: "area-financial",
  bruno: "area-financial",
  bonfim: "area-financial",
  paula: "area-financial",
  balista: "area-financial",
};

const manager = (
  id: string,
  name: string,
  directorId: string,
  roleType: Extract<RoleType, "Farmer + Delivery" | "Delivery">,
  jobTitle = "Manager de Delivery",
): Person => ({
  id,
  name,
  email: `${id}@brq.com`,
  jobTitle,
  directorId,
  roleType,
  areaId: managerArea[id],
  clientIds: clientIdsFor(id),
  active: true,
  lifecycleStatus: "active",
  isManager: true,
  hierarchyLevel: 3,
});

export const people: Person[] = [
  {
    id: "robinson",
    name: "Robinson Marchini",
    email: "robinson.marchini@brq.com",
    jobTitle: "Diretor Executivo de Delivery",
    roleType: "Executive",
    areaId: "area-corporate",
    clientIds: customers.map((customer) => customer.id),
    notes: "Responsável executivo pela organização de Delivery.",
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 1,
  },
  {
    id: "ane",
    name: "Ane Knust Coelho",
    email: "ane.coelho@brq.com",
    jobTitle: "Diretor de Delivery",
    managerId: "robinson",
    roleType: "Director",
    areaId: "area-corporate",
    clientIds: customers.filter((item) => item.directorResponsibleId === "ane").map((item) => item.id),
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 2,
  },
  {
    id: "ca",
    name: "CA",
    email: "ca@brq.com",
    jobTitle: "Diretor de Delivery",
    managerId: "robinson",
    roleType: "Director",
    areaId: "area-corporate",
    clientIds: customers.filter((item) => item.directorResponsibleId === "ca").map((item) => item.id),
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 2,
  },
  {
    id: OTHER_DIRECTOR_ID,
    name: OTHER_DIRECTOR_NAME,
    email: "outros@brq.com",
    jobTitle: "Diretoria a definir",
    roleType: "Director",
    areaId: "area-corporate",
    clientIds: customers.filter((item) => item.directorResponsibleId === OTHER_DIRECTOR_ID).map((item) => item.id),
    notes: "Bucket transitório para clientes ainda sem diretoria definida. Não recebe meta direta.",
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 2,
  },
  {
    id: "renan",
    name: "Renan",
    email: "renan@brq.com",
    jobTitle: "Pré-Vendas / Staff",
    managerId: "robinson",
    roleType: "Staff",
    areaId: "area-corporate",
    clientIds: [],
    notes: "Papel de staff ligado diretamente à direção executiva.",
    active: true,
    lifecycleStatus: "active",
    isManager: false,
    hierarchyLevel: 2,
  },
  manager("flavia", "Flavia Tetamante", "ane", "Farmer + Delivery"),
  manager("ana", "Ana Braz", "ane", "Delivery"),
  manager("everton", "Everton", "ane", "Farmer + Delivery"),
  manager("varella", "Varella", "ane", "Farmer + Delivery"),
  manager("giullia", "Giullia", "ane", "Delivery"),
  manager("cris", "Cris Koso", "ane", "Farmer + Delivery"),
  manager("gabriela", "Gabriela Macedo", "ane", "Farmer + Delivery"),
  manager("gege", "Gege", "ane", "Farmer + Delivery"),
  manager("bresciani", "Bresciani", "ane", "Farmer + Delivery"),
  manager("andreia", "Andreia", "ane", "Farmer + Delivery"),
  manager("orion", "Orion", "ca", "Delivery"),
  manager("fernanda", "Fernanda", "ca", "Delivery"),
  manager("bruno", "Bruno", "ca", "Delivery"),
  manager("bonfim", "Ricardo Bonfim", "ca", "Delivery"),
  manager("paula", "Paula", "ca", "Farmer + Delivery"),
  manager("balista", "Balista", "ca", "Delivery"),
];

export const targetAllocations: TargetAllocation[] = customers.flatMap((customer) => {
  const farmerRenewal = getFinancialCustomerMetric(customer.name, "deliveryFarmerRevenue");

  const managerAllocations = customer.managerResponsibleIds.map((personId, index) => ({
    id: `target-${customer.id}-${personId}-farmer-renewal-2026`,
    customerId: customer.id,
    personId,
    type: "farmer_renewal" as const,
    year: 2026,
    amount: splitAmount(farmerRenewal, customer.managerResponsibleIds.length, index),
    notes: "Carga inicial importada da planilha Financial BU.",
  }));

  return managerAllocations;
});

export const studioTargetAllocations: StudioTargetAllocation[] = [];
