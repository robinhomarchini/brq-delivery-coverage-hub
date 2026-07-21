import type { Person, PersonCompensation, RoleType, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import { isHunterRole } from "@/lib/roles";

export type ChallengeView = "hunters" | "farmers" | "delivery";
export type ChallengeStatus = "low" | "adequate" | "aggressive" | "missing";
export type ChallengeSeniority = "junior" | "mid" | "senior" | "lead" | "executive";
export type ChallengeMarketStatus = "below_market" | "in_range" | "above_market" | "missing";

export interface ChallengeAiNumbers {
  peopleCount: number;
  targetAmount: number;
  averageMultiple: number | null;
  adequateCount: number;
  lowCount: number;
  aggressiveCount: number;
  missingSalaryCount: number;
  benchmarkLow: number;
  benchmarkHigh: number;
}

export interface ChallengeAiBaseline {
  id: string;
  view: ChallengeView;
  year: number;
  createdAt: string;
  context: string;
  narrative: string;
  opinion: string;
  reconsideredCriteria: string[];
  simulatedReassessment: string[];
  reflectedNumbers: ChallengeAiNumbers;
  assumptions: string[];
  recommendations: string[];
  pendingQuestions: string[];
}

export interface ChallengeAiResult {
  narrative: string;
  opinion: string;
  reconsideredCriteria: string[];
  simulatedReassessment: string[];
  reflectedNumbers: ChallengeAiNumbers;
  assumptions: string[];
  recommendations: string[];
  pendingQuestions: string[];
  baseline: ChallengeAiBaseline;
  source: "generative_ai" | "deterministic_fallback";
}

export interface ChallengeAnalysisRow {
  personId: string;
  personName: string;
  jobTitle: string;
  roleType: string;
  annualSalary: number | null;
  targetAmount: number;
  challengeMultiple: number | null;
  status: ChallengeStatus;
  seniority: ChallengeSeniority;
  marketSignal: ChallengeMarketSignal;
  view: ChallengeView;
}

export interface ChallengeMarketSignal {
  status: ChallengeMarketStatus;
  label: string;
  seniorityLabel: string;
  low: number;
  high: number;
  rationale: string;
}

const benchmark = {
  hunters: { low: 4, high: 8 },
  farmers: { low: 3, high: 6 },
  delivery: { low: 2, high: 5 },
} satisfies Record<ChallengeView, { low: number; high: number }>;

const salaryAnnualizationFactor = 12;

export function buildChallengeRows(
  people: Person[],
  compensations: PersonCompensation[],
  allocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
  view: ChallengeView,
) {
  const compensationByPerson = new Map(compensations.map((item) => [item.personId, item]));
  const relevantPeople = people.filter((person) =>
    person.active && isRelevantForView(person.roleType, view)
  );
  const relevantTypes = getRelevantTargetTypes(view);

  return relevantPeople
    .map<ChallengeAnalysisRow>((person) => {
      const directAllocations = allocations
        .filter((allocation) => allocation.personId === person.id && allocation.year === year && relevantTypes.includes(allocation.type));
      const directTargetAmount = directAllocations.reduce((total, allocation) => total + allocation.amount, 0);
      const directHunterCustomerIds = new Set(directAllocations
        .filter((allocation) => allocation.type === "hunter")
        .map((allocation) => allocation.customerId));
      const studioHunterAmount = view === "hunters"
        ? studioAllocations
          .filter((allocation) =>
            allocation.hunterPersonId === person.id
            && allocation.year === year
            && !directHunterCustomerIds.has(allocation.customerId)
          )
          .reduce((total, allocation) => total + allocation.hunterAmount, 0)
        : 0;
      const targetAmount = directTargetAmount + studioHunterAmount;
      const monthlySalary = compensationByPerson.get(person.id)?.annualSalary ?? null;
      const annualSalary = monthlySalary === null ? null : monthlySalary * salaryAnnualizationFactor;
      const challengeMultiple = annualSalary && annualSalary > 0 ? targetAmount / annualSalary : null;
      const seniority = inferSeniority(person.jobTitle, person.roleType);

      return {
        personId: person.id,
        personName: person.name,
        jobTitle: person.jobTitle,
        roleType: person.roleType,
        annualSalary,
        targetAmount,
        challengeMultiple,
        status: getChallengeStatus(view, challengeMultiple),
        seniority,
        marketSignal: getChallengeMarketSignal(view, seniority, challengeMultiple),
        view,
      };
    })
    .sort((first, second) => second.targetAmount - first.targetAmount || first.personName.localeCompare(second.personName, "pt-BR"));
}

export function getChallengeStatus(view: ChallengeView, multiple: number | null): ChallengeStatus {
  if (multiple === null) return "missing";
  if (multiple < benchmark[view].low) return "low";
  if (multiple > benchmark[view].high) return "aggressive";
  return "adequate";
}

export function getChallengeBenchmark(view: ChallengeView) {
  return benchmark[view];
}

export function getChallengeMarketSignal(
  view: ChallengeView,
  seniority: ChallengeSeniority,
  multiple: number | null,
): ChallengeMarketSignal {
  const range = getSeniorityAdjustedBenchmark(view, seniority);
  const seniorityLabel = getSeniorityLabel(seniority);
  const viewLabel = getViewLabel(view);
  const rationale = `Referência indicativa: ${viewLabel}, senioridade ${seniorityLabel}, faixa ${range.low}x a ${range.high}x de meta anual sobre salário mensal anualizado por 12.`;

  if (multiple === null) {
    return {
      status: "missing",
      label: "Sem base salarial",
      seniorityLabel,
      low: range.low,
      high: range.high,
      rationale: `${rationale} Cadastre salário mensal para comparar com a faixa.`,
    };
  }

  if (multiple < range.low) {
    return {
      status: "below_market",
      label: "Abaixo da faixa",
      seniorityLabel,
      low: range.low,
      high: range.high,
      rationale: `${rationale} O múltiplo atual está abaixo da faixa esperada para este cargo/senioridade.`,
    };
  }

  if (multiple > range.high) {
    return {
      status: "above_market",
      label: "Acima da faixa",
      seniorityLabel,
      low: range.low,
      high: range.high,
      rationale: `${rationale} O múltiplo atual está acima da faixa e deve ser validado contra carteira, capacidade e contexto.`,
    };
  }

  return {
    status: "in_range",
    label: "Em faixa",
    seniorityLabel,
    low: range.low,
    high: range.high,
    rationale: `${rationale} O múltiplo atual está dentro da faixa indicativa.`,
  };
}

function isRelevantForView(roleType: RoleType, view: ChallengeView) {
  if (view === "hunters") return isHunterRole(roleType);
  if (view === "farmers") return roleType === "Farmer" || roleType === "Farmer + Delivery" || roleType === "Hunter + Farmer";
  return roleType === "Delivery" || roleType === "Farmer + Delivery";
}

function getRelevantTargetTypes(view: ChallengeView) {
  if (view === "hunters") return ["hunter"];
  if (view === "farmers") return ["farmer_renewal"];
  return ["farmer_renewal", "studio"];
}

function inferSeniority(jobTitle: string, roleType: RoleType): ChallengeSeniority {
  const normalized = jobTitle
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (roleType === "Executive" || /\b(vp|vice|presidente|executiv|c-level|c level)\b/.test(normalized)) return "executive";
  if (roleType === "Director" || /\b(diretor|director|head|superintendente)\b/.test(normalized)) return "lead";
  if (/\b(senior|sr|especialista|principal|lead|lider|coordenador|manager|gerente)\b/.test(normalized)) return "senior";
  if (/\b(junior|jr|assistente|analista i|consultor i)\b/.test(normalized)) return "junior";
  return "mid";
}

function getSeniorityAdjustedBenchmark(view: ChallengeView, seniority: ChallengeSeniority) {
  const base = benchmark[view];
  const factor = getSeniorityFactor(seniority);
  return {
    low: roundOneDecimal(base.low * factor),
    high: roundOneDecimal(base.high * factor),
  };
}

function getSeniorityFactor(seniority: ChallengeSeniority) {
  if (seniority === "junior") return 0.75;
  if (seniority === "senior") return 1.1;
  if (seniority === "lead") return 1.2;
  if (seniority === "executive") return 1.3;
  return 1;
}

function getSeniorityLabel(seniority: ChallengeSeniority) {
  if (seniority === "junior") return "júnior";
  if (seniority === "senior") return "sênior";
  if (seniority === "lead") return "liderança";
  if (seniority === "executive") return "executiva";
  return "plena";
}

function getViewLabel(view: ChallengeView) {
  if (view === "hunters") return "Hunters";
  if (view === "farmers") return "Farmers";
  return "Delivery";
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
