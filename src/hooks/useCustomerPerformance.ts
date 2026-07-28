"use client";

import { useMemo, useEffect, useState } from "react";
import { createDeliveryRepositorySelection } from "@/lib/repositories";
import type { CustomerPerformanceMetric, DashboardSummaryFilters } from "@/lib/repositories";

export function useCustomerPerformance(filters: DashboardSummaryFilters) {
  const repository = useMemo(() => createDeliveryRepositorySelection().repository, []);
  const [items, setItems] = useState<CustomerPerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await repository.getPerformanceByCustomer(filters);
        if (!active) return;
        setItems(data.items ?? []);
        setError(undefined);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar a performance por cliente.");
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

  return { items, loading, error };
}
