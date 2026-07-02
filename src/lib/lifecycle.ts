export type LifecycleStatus = "active" | "inactive" | "closed";

export const lifecycleStatuses: LifecycleStatus[] = ["active", "inactive", "closed"];

export const lifecycleStatusLabels: Record<LifecycleStatus, string> = {
  active: "Ativo",
  inactive: "Desativado",
  closed: "Encerrado",
};

export function normalizeLifecycleStatus(value: unknown, activeFallback = true): LifecycleStatus {
  if (value === "active" || value === "inactive" || value === "closed") return value;
  return activeFallback ? "active" : "inactive";
}

export function translateLifecycleStatus(status: LifecycleStatus) {
  return lifecycleStatusLabels[status];
}

export function getActiveFromLifecycle(status: LifecycleStatus) {
  return status === "active";
}

export function getLifecycleStatusFromActive(active?: boolean): LifecycleStatus {
  return active === false ? "inactive" : "active";
}

export function isLifecycleActive(record: { lifecycleStatus?: LifecycleStatus; active?: boolean }) {
  return normalizeLifecycleStatus(record.lifecycleStatus, record.active !== false) === "active";
}

export function getLifecycleStatusBadgeVariant(status: LifecycleStatus) {
  if (status === "active") return "success" as const;
  if (status === "closed") return "destructive" as const;
  return "secondary" as const;
}

export function hasLifecycleClosureError(status: LifecycleStatus, closedAt?: string) {
  return status === "closed" && !closedAt;
}
