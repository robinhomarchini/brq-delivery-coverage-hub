export type RoutingLevel = "LOCAL_ONLY" | "CODEX_STANDARD" | "CODEX_CRITICAL" | "UNKNOWN";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Reviewer =
  | "domain"
  | "database"
  | "security"
  | "UX"
  | "reuse/componentization"
  | "performance"
  | "final code review";

export type RouteResult = {
  classification: RoutingLevel;
  reason: string;
  risk_level: RiskLevel;
  recommended_execution: string;
  required_reviewers: Reviewer[];
  relevant_files: string[];
  excluded_files: string[];
  stable_context: string[];
  open_questions: string[];
};

export type RoutingRuleSet = {
  critical: string[];
  standard: string[];
  local: string[];
  criticalPaths: string[];
  excludedPaths: string[];
};

export type ContextOptions = {
  request: string;
  maxFiles?: number;
  rootDir?: string;
};

export type LocalModelStatus = {
  enabled: boolean;
  available: boolean;
  reason: string;
  baseUrl?: string;
  model?: string;
};
