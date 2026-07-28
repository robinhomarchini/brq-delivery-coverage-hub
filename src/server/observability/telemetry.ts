import { createHash, randomUUID } from "node:crypto";

type TelemetryEventName = "OperationStarted" | "OperationSucceeded" | "OperationFailed" | "OperationCancelled";

type TelemetryUser = {
  userId?: string;
  role?: string;
  emailHash?: string;
};

type TelemetryBusinessContext = {
  customerId?: string;
  personIdHash?: string;
  targetYear?: number;
  targetType?: string;
  view?: string;
  year?: number;
  contextHash?: string;
};

type TelemetryPhase = {
  name: string;
  durationMs: number;
};

type TelemetryEvent = {
  eventName: TelemetryEventName;
  operationName: string;
  capability: string;
  correlationId: string;
  timestamp: string;
  durationMs?: number;
  status?: "started" | "succeeded" | "failed" | "cancelled";
  errorCategory?: string;
  user?: TelemetryUser;
  businessContext?: TelemetryBusinessContext;
  metrics?: Record<string, number>;
  phases?: TelemetryPhase[];
};

type OperationContext = {
  operationName: string;
  capability: string;
  correlationId?: string;
  user?: TelemetryUser;
  businessContext?: TelemetryBusinessContext;
};

type OperationFailure = {
  errorCategory: string;
  error?: unknown;
  metrics?: Record<string, number>;
};

type OperationSuccess = {
  metrics?: Record<string, number>;
};

export class OperationTimer {
  private readonly startTime = now();
  private readonly phaseStarts = new Map<string, number>();
  private readonly phases: TelemetryPhase[] = [];

  startPhase(name: string) {
    this.phaseStarts.set(name, now());
  }

  endPhase(name: string) {
    const startedAt = this.phaseStarts.get(name);
    if (startedAt === undefined) return;
    this.phaseStarts.delete(name);
    this.phases.push({ name, durationMs: roundMs(now() - startedAt) });
  }

  durationMs() {
    return roundMs(now() - this.startTime);
  }

  getPhases() {
    return [...this.phases];
  }

  endOpenPhases() {
    for (const name of this.phaseStarts.keys()) {
      this.endPhase(name);
    }
  }
}

export class OperationTracker {
  private readonly timer = new OperationTimer();

  constructor(private readonly context: Required<Pick<OperationContext, "operationName" | "capability" | "correlationId">> & Omit<OperationContext, "operationName" | "capability" | "correlationId">) {}

  start() {
    emitTelemetryEvent({
      eventName: "OperationStarted",
      operationName: this.context.operationName,
      capability: this.context.capability,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      status: "started",
      user: this.context.user,
      businessContext: this.context.businessContext,
    });
  }

  startPhase(name: string) {
    this.timer.startPhase(name);
  }

  endPhase(name: string) {
    this.timer.endPhase(name);
  }

  setUser(user: TelemetryUser) {
    this.context.user = user;
  }

  setBusinessContext(businessContext: TelemetryBusinessContext) {
    this.context.businessContext = businessContext;
  }

  succeed(details: OperationSuccess = {}) {
    this.timer.endOpenPhases();
    emitTelemetryEvent({
      eventName: "OperationSucceeded",
      operationName: this.context.operationName,
      capability: this.context.capability,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      durationMs: this.timer.durationMs(),
      status: "succeeded",
      user: this.context.user,
      businessContext: this.context.businessContext,
      metrics: details.metrics,
      phases: this.timer.getPhases(),
    });
  }

  fail(details: OperationFailure) {
    this.timer.endOpenPhases();
    emitTelemetryEvent({
      eventName: "OperationFailed",
      operationName: this.context.operationName,
      capability: this.context.capability,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      durationMs: this.timer.durationMs(),
      status: "failed",
      errorCategory: details.errorCategory,
      user: this.context.user,
      businessContext: this.context.businessContext,
      metrics: details.metrics,
      phases: this.timer.getPhases(),
    }, details.error);
  }
}

export function startOperation(context: OperationContext) {
  const tracker = new OperationTracker({
    ...context,
    correlationId: context.correlationId ?? randomUUID(),
  });
  tracker.start();
  return tracker;
}

export function getCorrelationId(request: Request) {
  return request.headers.get("x-correlation-id")
    ?? request.headers.get("x-request-id")
    ?? randomUUID();
}

export function hashTelemetryValue(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function categorizeTelemetryError(error: unknown) {
  if (error instanceof Error) {
    if (/auth|session|unauthorized|autorizado|permiss/i.test(error.message)) return "authorization";
    if (/invalid|inválido|valida/i.test(error.message)) return "validation";
    if (/fetch|network|timeout/i.test(error.message)) return "network";
  }
  return "unexpected";
}

export function withCorrelationHeader(response: Response, correlationId: string) {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

function emitTelemetryEvent(event: TelemetryEvent, error?: unknown) {
  const payload = sanitizeEvent(event);
  if (event.eventName === "OperationFailed") {
    console.error(JSON.stringify({ ...payload, error: sanitizeError(error) }));
    return;
  }
  console.info(JSON.stringify(payload));
}

function sanitizeEvent(event: TelemetryEvent) {
  return {
    telemetry: true,
    ...event,
  };
}

function sanitizeError(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return {
    name: error.name,
    messageHash: hashTelemetryValue(error.message),
  };
}

function now() {
  return performance.now();
}

function roundMs(value: number) {
  return Math.round(value * 100) / 100;
}
