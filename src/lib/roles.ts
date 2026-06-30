import type { RoleType } from "@/data/mockData";

export const roleTypes: RoleType[] = [
  "Executive",
  "Director",
  "Farmer + Delivery",
  "Delivery",
  "Hunter",
  "Farmer",
  "Hunter + Farmer",
  "Staff",
];

export const deliveryManagerRoleTypes: RoleType[] = ["Farmer + Delivery", "Delivery"];
export const nonTargetAssignableRoleTypes: RoleType[] = ["Executive", "Director", "Staff"];

export function translateRole(role: RoleType) {
  const labels: Record<RoleType, string> = {
    Executive: "Executivo",
    Director: "Diretor",
    "Farmer + Delivery": "Farmer + Delivery",
    Delivery: "Delivery",
    Hunter: "Hunter",
    Farmer: "Farmer",
    "Hunter + Farmer": "Hunter + Farmer",
    Staff: "Staff",
  };

  return labels[role];
}

export function isDeliveryManagerRole(role: RoleType) {
  return deliveryManagerRoleTypes.includes(role);
}

export function isTargetAssignableRole(role: RoleType) {
  return !nonTargetAssignableRoleTypes.includes(role);
}

export function isCustomerManagerProfile(role: RoleType, isManager: boolean) {
  return isManager && isTargetAssignableRole(role);
}

export function isHunterRole(role: RoleType) {
  return role === "Hunter" || role === "Hunter + Farmer";
}

export function getHierarchyLevelForRole(role: RoleType): 1 | 2 | 3 {
  if (role === "Executive") return 1;
  if (role === "Director" || role === "Staff") return 2;
  return 3;
}

export function getRoleBadgeVariant(role: RoleType) {
  if (role === "Staff") return "warning" as const;
  if (role === "Farmer + Delivery") return "navy" as const;
  if (role === "Hunter" || role === "Hunter + Farmer") return "commercial" as const;
  if (role === "Farmer") return "farmer" as const;
  return "default" as const;
}
