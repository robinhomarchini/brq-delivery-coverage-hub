export type EmployeeImportMatchStatus = "change" | "unchanged" | "updated";
export type EmployeeImportUnmatchedReason = "not_found" | "ambiguous" | "invalid_salary";
export type ManagerResolution = "exact" | "saved" | "manual" | "unmatched";

export interface EmployeeImportMatchedPerson {
  sourceName: string;
  personId: string;
  personName: string;
  currentSalary: number | null;
  proposedSalary: number;
  status: EmployeeImportMatchStatus;
}

export interface EmployeeImportUnmatchedPerson {
  sourceName: string;
  reason: EmployeeImportUnmatchedReason;
  matchesCount?: number;
}

export interface EmployeeImportManagerOption {
  id: string;
  name: string;
}

export interface EmployeeImportManagerGroup {
  sourceKey: string;
  sourceName: string;
  employeeCount: number;
  resolvedManagerId: string | null;
  resolvedManagerName: string | null;
  resolution: ManagerResolution;
}

export interface EmployeeImportManagerTotal {
  managerId: string;
  managerName: string;
  employeeCount: number;
  sourceManagers: string[];
}

export interface EmployeeImportPreview {
  batchId?: string;
  batchStatus?: "reconciling" | "hc_confirmed";
  sourceFileName: string;
  sourceRowCount: number;
  matchedPeople: EmployeeImportMatchedPerson[];
  unmatchedPeople: EmployeeImportUnmatchedPerson[];
  managers: EmployeeImportManagerGroup[];
  managerTotals: EmployeeImportManagerTotal[];
  availableManagers: EmployeeImportManagerOption[];
  rowsWithoutManager: number;
  summary: {
    salaryChanges: number;
    salariesUnchanged: number;
    peopleNotFound: number;
    invalidSalaryRows: number;
    unresolvedManagers: number;
  };
}

export interface EmployeeImportSalaryActionResult {
  personId: string;
  status: "updated";
  updatedAt: string;
}

export interface EmployeeImportHeadcountResult {
  headcountsUpdated: number;
  status: "hc_confirmed";
}

export interface EmployeeImportApplyAllResult {
  salaryResults: EmployeeImportSalaryActionResult[];
  headcountResult: EmployeeImportHeadcountResult;
}

export type EmployeeImportManualMappings = Record<string, string>;
