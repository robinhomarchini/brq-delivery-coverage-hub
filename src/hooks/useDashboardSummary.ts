"use client";

import { useMemo, useEffect, useState } from "react";
import { createDeliveryRepositorySelection } from "@/lib/repositories";
import type { DashboardMetricResult, DashboardSummaryFilters } from "@/lib/repositories";

export function useDashboardSummary(filters: DashboardSummaryFilters) {
  const repository = useMemo(() => createDeliveryRepositorySelection().repository, []);
  const [result, setResult] = useState<DashboardMetricResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await repository.getDashboardSummary(filters);
        if (!active) return;
        setResult(data);
        setError(undefined);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar o resumo executivo.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [repository, filters]);

  return { summary: result?.summary ?? null, financialByCustomer: result?.financialByCustomer ?? [], loading, error };
}
