"use client";

import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import type { ReportView } from "@/lib/reports/person-target-official-export";

export interface PersonTargetSummaryCardsProps {
  countLabel: string;
  count: number;
  firstLabel: string;
  first: number;
  secondLabel: string;
  second: number;
  totalLabel: string;
  total: number;
  effectiveView: ReportView;
}

export function PersonTargetSummaryCards({
  countLabel,
  count,
  firstLabel,
  first,
  secondLabel,
  second,
  totalLabel,
  total,
  effectiveView,
}: PersonTargetSummaryCardsProps) {
  const valueOrCurrency = (value: number) => ({
    ...(effectiveView === "specialistHunters" || effectiveView === "clients" ? { value } : { currencyValue: value }),
  });

  return (
    <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiSummaryCard label={countLabel} value={count} />
      <KpiSummaryCard label={firstLabel} {...valueOrCurrency(first)} />
      <KpiSummaryCard label={secondLabel} {...valueOrCurrency(second)} />
      <KpiSummaryCard label={totalLabel} currencyValue={total} />
    </section>
  );
}
