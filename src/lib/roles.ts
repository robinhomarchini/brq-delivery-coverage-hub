export const ROLE_TYPES = [
  "Executive",
  "Director",
  "Farmer + Delivery",
  "Delivery",
  "Hunter",
  "Hunter Especializado",
  "Farmer",
  "Hunter + Farmer",
  "Staff",
] as const;

export type RoleType = (typeof ROLE_TYPES)[number];

export type RoleDefinition = {
  label: string;
  hierarchyLevel: 1 | 2 | 3;
  badgeVariant: "default" | "warning" | "navy" | "commercial" | "farmer";
  canBeTargetAssignable: boolean;
  isHunter: boolean;
  isFarmerDeliveryTarget: boolean;
  isLeadership: boolean;
  canAppearInOrganization: boolean;
  hasDarkCardTheme: boolean;
};

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  Executive: {
    label: "Executivo",
    hierarchyLevel: 1,
    badgeVariant: "default",
    canBeTargetAssignable: false,
    isHunter: false,
    isFarmerDeliveryTarget: false,
    isLeadership: true,
    canAppearInOrganization: true,
    hasDarkCardTheme: true,
  },
  Director: {
    label: "Diretor",
    hierarchyLevel: 2,
    badgeVariant: "default",
    canBeTargetAssignable: false,
    isHunter: false,
    isFarmerDeliveryTarget: false,
    isLeadership: true,
    canAppearInOrganization: true,
    hasDarkCardTheme: true,
  },
  "Farmer + Delivery": {
    label: "Farmer + Delivery",
    hierarchyLevel: 3,
    badgeVariant: "navy",
    canBeTargetAssignable: true,
    isHunter: false,
    isFarmerDeliveryTarget: true,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: true,
  },
  Delivery: {
    label: "Delivery",
    hierarchyLevel: 3,
    badgeVariant: "default",
    canBeTargetAssignable: true,
    isHunter: false,
    isFarmerDeliveryTarget: true,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
  Hunter: {
    label: "Hunter",
    hierarchyLevel: 3,
    badgeVariant: "commercial",
    canBeTargetAssignable: true,
    isHunter: true,
    isFarmerDeliveryTarget: false,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
  "Hunter Especializado": {
    label: "Hunter Especializado",
    hierarchyLevel: 3,
    badgeVariant: "commercial",
    canBeTargetAssignable: false,
    isHunter: true,
    isFarmerDeliveryTarget: false,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
  Farmer: {
    label: "Farmer",
    hierarchyLevel: 3,
    badgeVariant: "farmer",
    canBeTargetAssignable: true,
    isHunter: false,
    isFarmerDeliveryTarget: true,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
  "Hunter + Farmer": {
    label: "Hunter + Farmer",
    hierarchyLevel: 3,
    badgeVariant: "commercial",
    canBeTargetAssignable: true,
    isHunter: true,
    isFarmerDeliveryTarget: true,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
  Staff: {
    label: "Staff",
    hierarchyLevel: 2,
    badgeVariant: "warning",
    canBeTargetAssignable: false,
    isHunter: false,
    isFarmerDeliveryTarget: false,
    isLeadership: false,
    canAppearInOrganization: true,
    hasDarkCardTheme: false,
  },
};

export const roleTypes = ROLE_TYPES.slice();
export const deliveryManagerRoleTypes = ROLE_TYPES.filter((role) => ROLE_DEFINITIONS[role].isFarmerDeliveryTarget && role !== "Farmer" && role !== "Hunter + Farmer");
export const nonTargetAssignableRoleTypes = ROLE_TYPES.filter((role) => !ROLE_DEFINITIONS[role].canBeTargetAssignable);

export function translateRole(role: RoleType): string {
  return ROLE_DEFINITIONS[role].label;
}

export function isDeliveryManagerRole(role: RoleType): boolean {
  return deliveryManagerRoleTypes.includes(role);
}

export function isTargetAssignableRole(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].canBeTargetAssignable;
}

export function isCustomerManagerProfile(role: RoleType, isManager: boolean): boolean {
  return isManager && isTargetAssignableRole(role);
}

export function isCustomerFarmerResponsibleProfile(role: RoleType, isManager: boolean): boolean {
  return isCustomerManagerProfile(role, isManager) || isFarmerDeliveryTargetRole(role);
}

export function isFarmerDeliveryTargetRole(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].isFarmerDeliveryTarget;
}

export function isHunterRole(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].isHunter;
}

export function isSpecialistHunterRole(role: RoleType): boolean {
  return role === "Hunter Especializado";
}

export function isHunterSelectionRole(role: RoleType): boolean {
  return isHunterRole(role) || isSpecialistHunterRole(role);
}

export function isDeliveryRole(role: RoleType): boolean {
  return role === "Delivery";
}

export function isFarmerRole(role: RoleType): boolean {
  return role === "Farmer";
}

export function isHunterFarmerRole(role: RoleType): boolean {
  return role === "Hunter + Farmer";
}

export function getHierarchyLevelForRole(role: RoleType): 1 | 2 | 3 {
  return ROLE_DEFINITIONS[role].hierarchyLevel;
}

export function getRoleBadgeVariant(role: RoleType): "default" | "warning" | "navy" | "commercial" | "farmer" {
  return ROLE_DEFINITIONS[role].badgeVariant;
}

export function isLeadershipRole(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].isLeadership;
}

export function isStaffRole(role: RoleType): boolean {
  return role === "Staff";
}

export function canAppearInOrganization(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].canAppearInOrganization;
}

export function isExecutiveRole(role: RoleType): boolean {
  return role === "Executive";
}

export function isDirectorRole(role: RoleType): boolean {
  return role === "Director";
}

export function isDirectorOrExecutiveRole(role: RoleType): boolean {
  return isDirectorRole(role) || isExecutiveRole(role);
}

export function hasDarkCardTheme(role: RoleType): boolean {
  return ROLE_DEFINITIONS[role].hasDarkCardTheme;
}
