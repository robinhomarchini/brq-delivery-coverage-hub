/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const telemetryPath = path.join(root, "src", "server", "observability", "telemetry.ts");
const personTargetsRoutePath = path.join(root, "src", "app", "api", "delivery", "person-customer-targets", "route.ts");
const challengeAnalysisRoutePath = path.join(root, "src", "app", "api", "challenge-analysis", "route.ts");
const challengeAnalysisAccessPath = path.join(root, "src", "server", "auth", "challenge-analysis-access.ts");

const telemetry = read(telemetryPath);
const route = read(personTargetsRoutePath);
const challengeRoute = read(challengeAnalysisRoutePath);
const challengeAccess = read(challengeAnalysisAccessPath);

assertIncludes(telemetry, "type TelemetryEventName = \"OperationStarted\" | \"OperationSucceeded\" | \"OperationFailed\" | \"OperationCancelled\"", "Telemetry must define controlled operation lifecycle events.");
assertIncludes(telemetry, "operationName: string", "Telemetry event must include operation name.");
assertIncludes(telemetry, "capability: string", "Telemetry event must include business capability.");
assertIncludes(telemetry, "correlationId: string", "Telemetry event must include correlation id.");
assertIncludes(telemetry, "timestamp: string", "Telemetry event must include timestamp.");
assertIncludes(telemetry, "durationMs?: number", "Telemetry event must include operation duration.");
assertIncludes(telemetry, "errorCategory?: string", "Telemetry event must include error category.");
assertIncludes(telemetry, "user?: TelemetryUser", "Telemetry event must include safe authenticated-user context.");
assertIncludes(telemetry, "businessContext?: TelemetryBusinessContext", "Telemetry event must include business context.");
assertIncludes(telemetry, "phases?: TelemetryPhase[]", "Telemetry event must include phase timing.");
assertIncludes(telemetry, "class OperationTimer", "Telemetry must expose a reusable operation timer.");
assertIncludes(telemetry, "startPhase(name: string)", "Operation timer must support phase start.");
assertIncludes(telemetry, "endPhase(name: string)", "Operation timer must support phase end.");
assertIncludes(telemetry, "endOpenPhases()", "Operation timer must close open phases before terminal events.");
assertIncludes(telemetry, "eventName: \"OperationStarted\"", "Telemetry must emit OperationStarted.");
assertIncludes(telemetry, "eventName: \"OperationSucceeded\"", "Telemetry must emit OperationSucceeded.");
assertIncludes(telemetry, "eventName: \"OperationFailed\"", "Telemetry must emit OperationFailed.");
assertIncludes(telemetry, "console.info(JSON.stringify(payload))", "Telemetry must emit structured searchable success/start events.");
assertIncludes(telemetry, "console.error(JSON.stringify({ ...payload, error: sanitizeError(error) }))", "Telemetry must emit structured searchable failure events.");
assertNotIncludes(telemetry, "console.log", "Telemetry must not use console.log.");
assertIncludes(telemetry, "hashTelemetryValue", "Telemetry must hash potentially sensitive values.");
assertIncludes(telemetry, "messageHash", "Telemetry errors must avoid raw exception messages.");
assertIncludes(telemetry, "x-correlation-id", "Telemetry must read/write correlation id.");
assertIncludes(telemetry, "categorizeTelemetryError", "Telemetry must categorize failures.");

assertIncludes(route, "startOperation({", "Person target route must start a telemetry operation.");
assertIncludes(route, "operationName: \"delivery.personCustomerTargets.save\"", "Person target route must use a stable operation name.");
assertIncludes(route, "capability: \"Targets\"", "Person target route must classify the business capability.");
assertIncludes(route, "getCorrelationId(request)", "Person target route must propagate or create correlation id.");
assertIncludes(route, "operation.startPhase(\"auth\")", "Person target route must measure auth time.");
assertIncludes(route, "operation.startPhase(\"request.parse\")", "Person target route must measure request parsing/validation time.");
assertIncludes(route, "operation.startPhase(\"authorization.scope\")", "Person target route must measure Hunter scope checks.");
assertIncludes(route, "operation.startPhase(\"repository.save\")", "Person target route must approximate database/repository time.");
assertIncludes(route, "operation.succeed({", "Person target route must record success.");
assertIncludes(route, "operation.fail({ errorCategory: \"validation\" })", "Person target route must record validation failures.");
assertIncludes(route, "operation.fail({ errorCategory: \"authorization\"", "Person target route must record authorization failures.");
assertIncludes(route, "operation.fail({ errorCategory: categorizeTelemetryError(error), error })", "Person target route must categorize unexpected failures.");
assertIncludes(route, "withCorrelationHeader(", "Person target responses must include correlation id.");
assertIncludes(route, "emailHash: hashTelemetryValue(accessUser.email)", "Person target route must avoid logging raw email.");
assertIncludes(route, "personIdHash: hashTelemetryValue(parsed.data.personId)", "Person target route must avoid logging raw person id.");
assertNotIncludes(route, "hunterAmount: parsed.data.hunterAmount", "Telemetry metrics must not log raw financial target amounts.");
assertNotIncludes(route, "farmerRenewalAmount: parsed.data.farmerRenewalAmount", "Telemetry metrics must not log raw financial target amounts.");

assertIncludes(challengeAccess, "return accessUser", "Challenge analysis auth must return the validated app user for safe telemetry context.");
assertIncludes(challengeRoute, "startOperation({", "Challenge analysis route must start a telemetry operation.");
assertIncludes(challengeRoute, "operationName: \"executive.challengeAnalysis.generate\"", "Challenge analysis route must use a stable operation name.");
assertIncludes(challengeRoute, "capability: \"Challenges\"", "Challenge analysis route must classify the business capability.");
assertIncludes(challengeRoute, "getCorrelationId(request)", "Challenge analysis route must propagate or create correlation id.");
assertIncludes(challengeRoute, "operation.startPhase(\"auth\")", "Challenge analysis route must measure auth/access time.");
assertIncludes(challengeRoute, "operation.startPhase(\"request.parse\")", "Challenge analysis route must measure request parsing/validation time.");
assertIncludes(challengeRoute, "operation.startPhase(\"analysis.prepare\")", "Challenge analysis route must measure server-side processing time.");
assertIncludes(challengeRoute, "operation.startPhase(\"ai.generate\")", "Challenge analysis route must measure AI/provider generation time.");
assertIncludes(challengeRoute, "operation.succeed({", "Challenge analysis route must record success.");
assertIncludes(challengeRoute, "operation.fail({ errorCategory: \"validation\" })", "Challenge analysis route must record validation failures.");
assertIncludes(challengeRoute, "operation.fail({ errorCategory: \"authorization\"", "Challenge analysis route must record authorization failures.");
assertIncludes(challengeRoute, "operation.fail({ errorCategory: categorizeTelemetryError(error), error })", "Challenge analysis route must categorize unexpected failures.");
assertIncludes(challengeRoute, "withCorrelationHeader(", "Challenge analysis responses must include correlation id.");
assertIncludes(challengeRoute, "emailHash: hashTelemetryValue(accessUser.email)", "Challenge analysis route must avoid logging raw email.");
assertIncludes(challengeRoute, "contextHash: hashTelemetryValue(parsed.data.context)", "Challenge analysis route must avoid logging raw prompt/context.");
assertIncludes(challengeRoute, "submittedRows: parsed.data.rows.length", "Challenge analysis route must record bounded workload size.");
assertIncludes(challengeRoute, "generativeAiResult: result.source === \"generative_ai\" ? 1 : 0", "Challenge analysis route must record provider/fallback outcome.");
assertNotIncludes(challengeRoute, "console.warn", "Challenge analysis route must not use unstructured warning logs.");

console.log("Observability checks passed.");

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${path.relative(root, filePath)}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

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
