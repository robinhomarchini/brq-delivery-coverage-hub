export type EmployeeImportMatchStatus = "change" | "unchanged";
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

export interface EmployeeImportApplyResult {
  salariesChanged: number;
  salariesUnchanged: number;
  managerMappingsSaved: number;
  ignoredPeople: number;
}

export type EmployeeImportManualMappings = Record<string, string>;
