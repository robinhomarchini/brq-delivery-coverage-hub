import type { LocalModelStatus, RoutingLevel } from "./types";

const defaultBaseUrl = "http://localhost:11434";

export function getLocalModelConfig() {
  return {
    enabled: process.env.LOCAL_AI_ENABLED === "true",
    baseUrl: process.env.LOCAL_AI_BASE_URL ?? defaultBaseUrl,
    model: process.env.LOCAL_AI_MODEL ?? "",
  };
}
export async function checkLocalModel(): Promise<LocalModelStatus> {
  const config = getLocalModelConfig();
  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      reason: "LOCAL_AI_ENABLED is not true; deterministic routing will be used.",
      baseUrl: config.baseUrl,
      model: config.model || undefined,
    };
  }

  if (!config.model) {
    return {
      enabled: true,
      available: false,
      reason: "LOCAL_AI_MODEL is not configured; deterministic routing will be used.",
      baseUrl: config.baseUrl,
    };
  }

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) {
      return {
        enabled: true,
        available: false,
        reason: `Local model endpoint returned HTTP ${response.status}; deterministic routing will be used.`,
        baseUrl: config.baseUrl,
        model: config.model,
      };
    }
    return {
      enabled: true,
      available: true,
      reason: "Local Ollama-compatible endpoint is reachable.",
      baseUrl: config.baseUrl,
      model: config.model,
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      reason: `Local model unavailable: ${error instanceof Error ? error.message : String(error)}. Deterministic routing will be used.`,
      baseUrl: config.baseUrl,
      model: config.model,
    };
  }
}

export async function classifyWithLocalModel(request: string): Promise<{ classification?: RoutingLevel; reason?: string; available: boolean }> {
  const status = await checkLocalModel();
  if (!status.available) return { available: false, reason: status.reason };

  const config = getLocalModelConfig();
  const prompt = [
    "Classify this repository task as one of LOCAL_ONLY, CODEX_STANDARD, CODEX_CRITICAL, or UNKNOWN.",
    "Return compact JSON only: {\"classification\":\"...\",\"reason\":\"...\"}.",
    "Never choose LOCAL_ONLY for code, database, security, auth, production, financial source-of-truth, or architecture changes.",
    `Task: ${request}`,
  ].join("\n");

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: config.model, prompt, stream: false }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { available: false, reason: `Local model returned HTTP ${response.status}.` };

    const payload = await response.json() as { response?: string };
    const parsed = JSON.parse(payload.response ?? "{}") as { classification?: RoutingLevel; reason?: string };
    return {
      available: true,
      classification: parsed.classification,
      reason: parsed.reason,
    };
  } catch (error) {
    return {
      available: false,
      reason: `Local model classification failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  }
}
