"use client";

import { useMemo } from "react";

const STORAGE_KEY = "brq.dashboard.hunterScope";

export interface HunterScopeSnapshot {
  enabled: boolean;
  personId: string | null;
  customerIds: string[];
}

export function readHunterScopeSnapshot(): HunterScopeSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HunterScopeSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      enabled: Boolean(parsed.enabled),
      personId: typeof parsed.personId === "string" ? parsed.personId : null,
      customerIds: Array.isArray(parsed.customerIds) ? parsed.customerIds.filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

export function usePersistedHunterScope(derivedScope: {
  enabled: boolean;
  person?: { id: string } | null;
  customerIds?: Set<string> | null;
}) {
  const customerIds = useMemo(() => Array.from(derivedScope.customerIds ?? []), [derivedScope.customerIds]);

  return useMemo(() => {
    const persisted = readHunterScopeSnapshot();
    const derived: HunterScopeSnapshot = {
      enabled: derivedScope.enabled,
      personId: derivedScope.person?.id ?? null,
      customerIds,
    };
    const base = persisted ?? derived;
    const merged: HunterScopeSnapshot = {
      enabled: base.enabled,
      personId: base.personId ?? derived.personId,
      customerIds: base.customerIds.length > 0 ? base.customerIds : derived.customerIds,
    };
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
  }, [derivedScope.enabled, derivedScope.person?.id, customerIds]);
}
