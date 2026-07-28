/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rolesPath = path.join(root, "src", "lib", "roles.ts");
const mockDataPath = path.join(root, "src", "data", "mockData.ts");
const validationPath = path.join(root, "src", "lib", "validation.ts");

const rolesSource = fs.readFileSync(rolesPath, "utf8");
const mockDataSource = fs.readFileSync(mockDataPath, "utf8");
const validationSource = fs.readFileSync(validationPath, "utf8");

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message);
  }
}

function assertNotIncludes(source, token, message) {
  if (source.includes(token)) {
    throw new Error(message);
  }
}

const roleTypes = [
  "Executive",
  "Director",
  "Farmer + Delivery",
  "Delivery",
  "Hunter",
  "Hunter Especializado",
  "Farmer",
  "Hunter + Farmer",
  "Staff",
];

assertIncludes(rolesSource, "export const ROLE_TYPES = [", "roles.ts must export ROLE_TYPES.");
assertIncludes(rolesSource, "export type RoleType = (typeof ROLE_TYPES)[number];", "roles.ts must derive RoleType from ROLE_TYPES.");
assertIncludes(rolesSource, "export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition>", "roles.ts must export ROLE_DEFINITIONS.");

for (const role of roleTypes) {
  const needsQuotes = role.includes(" ") || role.includes("+");
  const keyPattern = needsQuotes ? `  "${role}": {` : `  ${role}: {`;
  assertIncludes(rolesSource, keyPattern, `ROLE_DEFINITIONS must contain entry for ${role}.`);
}

assertNotIncludes(rolesSource, '"Manager"', "Manager must not be included in ROLE_TYPES or ROLE_DEFINITIONS.");
assertIncludes(rolesSource, "export function translateRole(role: RoleType): string", "roles.ts must export translateRole.");
assertIncludes(rolesSource, "export function isHunterRole(role: RoleType): boolean", "roles.ts must export isHunterRole.");
assertIncludes(rolesSource, "export function isSpecialistHunterRole(role: RoleType): boolean", "roles.ts must export isSpecialistHunterRole.");
assertIncludes(rolesSource, "export function isHunterSelectionRole(role: RoleType): boolean", "roles.ts must export isHunterSelectionRole.");
assertIncludes(rolesSource, "export function isFarmerDeliveryTargetRole(role: RoleType): boolean", "roles.ts must export isFarmerDeliveryTargetRole.");
assertIncludes(rolesSource, "export function isDeliveryManagerRole(role: RoleType): boolean", "roles.ts must export isDeliveryManagerRole.");
assertIncludes(rolesSource, "export function isTargetAssignableRole(role: RoleType): boolean", "roles.ts must export isTargetAssignableRole.");
assertIncludes(rolesSource, "export function isCustomerManagerProfile(role: RoleType, isManager: boolean): boolean", "roles.ts must export isCustomerManagerProfile.");
assertIncludes(rolesSource, "export function isCustomerFarmerResponsibleProfile(role: RoleType, isManager: boolean): boolean", "roles.ts must export isCustomerFarmerResponsibleProfile.");
assertIncludes(rolesSource, "export function getHierarchyLevelForRole(role: RoleType): 1 | 2 | 3", "roles.ts must export getHierarchyLevelForRole.");
assertIncludes(rolesSource, "export function getRoleBadgeVariant(role: RoleType)", "roles.ts must export getRoleBadgeVariant.");
assertIncludes(rolesSource, "export function isLeadershipRole(role: RoleType): boolean", "roles.ts must export isLeadershipRole.");
assertIncludes(rolesSource, "export function isStaffRole(role: RoleType): boolean", "roles.ts must export isStaffRole.");
assertIncludes(rolesSource, "export function canAppearInOrganization(role: RoleType): boolean", "roles.ts must export canAppearInOrganization.");
assertIncludes(rolesSource, "export function isExecutiveRole(role: RoleType): boolean", "roles.ts must export isExecutiveRole.");
assertIncludes(rolesSource, "export function isDirectorRole(role: RoleType): boolean", "roles.ts must export isDirectorRole.");
assertIncludes(rolesSource, "export function isDirectorOrExecutiveRole(role: RoleType): boolean", "roles.ts must export isDirectorOrExecutiveRole.");
assertIncludes(rolesSource, "export function hasDarkCardTheme(role: RoleType): boolean", "roles.ts must export hasDarkCardTheme.");
assertIncludes(rolesSource, "export function isDeliveryRole(role: RoleType): boolean", "roles.ts must export isDeliveryRole.");
assertIncludes(rolesSource, "export function isFarmerRole(role: RoleType): boolean", "roles.ts must export isFarmerRole.");
assertIncludes(rolesSource, "export function isHunterFarmerRole(role: RoleType): boolean", "roles.ts must export isHunterFarmerRole.");

assertIncludes(rolesSource, "isHunter: true", "Hunter roles must be marked with isHunter: true.");
assertIncludes(rolesSource, "isFarmerDeliveryTarget: true", "Farmer/delivery roles must be marked with isFarmerDeliveryTarget: true.");
assertIncludes(rolesSource, "isLeadership: true", "Leadership roles must be marked with isLeadership: true.");
assertIncludes(rolesSource, "canBeTargetAssignable: false", "Non-assignable roles must be marked with canBeTargetAssignable: false.");
assertIncludes(rolesSource, "hasDarkCardTheme: true", "Dark card theme roles must be marked with hasDarkCardTheme: true.");

assertIncludes(mockDataSource, 'import type { RoleType } from "@/lib/roles"', "mockData.ts must import RoleType from the canonical roles module.");
assertNotIncludes(mockDataSource, "export type RoleType =", "mockData.ts must not redefine RoleType union; it should import from roles.ts.");

assertIncludes(validationSource, '"Executive"', "Validation schema must include Executive.");
assertIncludes(validationSource, '"Director"', "Validation schema must include Director.");
assertIncludes(validationSource, '"Staff"', "Validation schema must include Staff.");
assertIncludes(validationSource, '"Hunter Especializado"', "Validation schema must include Hunter Especializado.");
assertIncludes(validationSource, '"Farmer + Delivery"', "Validation schema must include Farmer + Delivery.");
assertIncludes(validationSource, '"Delivery"', "Validation schema must include Delivery.");
assertIncludes(validationSource, '"Hunter"', "Validation schema must include Hunter.");
assertIncludes(validationSource, '"Farmer"', "Validation schema must include Farmer.");
assertIncludes(validationSource, '"Hunter + Farmer"', "Validation schema must include Hunter + Farmer.");

const supabaseRolePattern = /check \(role_type in \(([^)]+)\)/g;
const migrationMatches = [
  ...rolesSource.matchAll(supabaseRolePattern),
  ...validationSource.matchAll(supabaseRolePattern),
];
for (const match of migrationMatches) {
  const rolesInMigration = match[1].split(",").map((item) => item.trim().replace(/^'|'$/g, ""));
  for (const role of rolesInMigration) {
    assert(roleTypes.includes(role), `Supabase migration or validation contains role "${role}" which is not in canonical ROLE_TYPES.`);
  }
}

console.log("Role domain contract checks passed.");
