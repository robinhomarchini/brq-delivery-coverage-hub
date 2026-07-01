import type { Customer, Person, Subject } from "@/data/mockData";
import { formatPercentPtBr, targetMarginPercent } from "@/lib/financial-targets";

export interface AiInsight {
  title: string;
  description: string;
  severity: "info" | "attention" | "critical";
}

export function identifyManagerOverload(people: Person[], customers: Customer[]): AiInsight[] {
  const overloaded = people
    .filter((person) => person.isManager)
    .map((person) => ({
      person,
      total: customers.filter((customer) => customer.managerResponsibleIds.includes(person.id)).length,
    }))
    .filter(({ total }) => total >= 3);

  return overloaded.length
    ? overloaded.map(({ person, total }) => ({
        title: `Atenção à capacidade de ${person.name}`,
        description: `${total} clientes sob responsabilidade direta. Validar capacidade e complexidade da carteira.`,
        severity: "attention" as const,
      }))
    : [{
        title: "Capacidade equilibrada",
        description: "Nenhum manager ultrapassa o limiar demonstrativo de três clientes.",
        severity: "info",
      }];
}

export function detectUncoveredSubjects(subjects: Subject[]): AiInsight[] {
  return subjects
    .filter((subject) => subject.status === "Atenção" || !subject.ownerPersonId)
    .map((subject) => ({
      title: `Cobertura pendente: ${subject.name}`,
      description: "Assunto sinalizado para definição ou reforço de ownership.",
      severity: "critical" as const,
    }));
}

export function suggestPortfolioRebalance(customers: Customer[]): AiInsight[] {
  const lowMargin = customers.filter((customer) => customer.margin < targetMarginPercent);
  return [{
    title: "Revisar portfólio abaixo da margem-alvo",
    description: `${lowMargin.length} conta(s) estão abaixo da margem-alvo informativa de ${formatPercentPtBr(targetMarginPercent)}.`,
    severity: lowMargin.length ? "attention" : "info",
  }];
}

export function generateExecutiveSummary(
  people: Person[],
  _subjects: Subject[],
  customers: Customer[],
): string {
  const managers = people.filter((person) => person.isManager && person.active).length;
  const strategic = customers.filter((customer) => customer.strategicAccount).length;
  return `A estrutura ativa conta com ${managers} managers, ${customers.length} clientes e ${strategic} contas estratégicas. O módulo de assuntos está pausado para revisão do modelo.`;
}
