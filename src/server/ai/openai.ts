import { getAiConfig } from "./config";

interface AiMessage {
  role: "system" | "user";
  content: string;
}

export interface AiWebSource {
  title: string;
  url: string;
}

export async function generateAiText(messages: AiMessage[]) {
  const response = await generateAiResponseText(messages);
  if (response.text) return response;
  return generateAiChatCompletionText(messages);
}

export async function generateAiTextWithWebSearch(messages: AiMessage[]) {
  return generateAiResponseText(messages, { webSearch: true });
}

export async function transcribeAiAudio(audio: Blob, fileName: string) {
  const config = getAiConfig();
  if (!config.apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const body = new FormData();
    body.append("file", audio, fileName);
    body.append("model", config.transcriptionModel);
    body.append("language", "pt");
    body.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[ai] Audio transcription request failed.", { status: response.status });
      return null;
    }

    const data = await response.json() as { text?: string };
    return data.text?.trim() || null;
  } catch (error) {
    console.warn("[ai] Audio transcription request did not complete.", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAiResponseText(messages: AiMessage[], options: { webSearch?: boolean } = {}) {
  const config = getAiConfig();
  if (!config.apiKey) return { text: null, error: "missing_api_key" as const, webSearchUsed: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        max_output_tokens: config.maxTokens,
        store: false,
        ...(options.webSearch
          ? {
              tools: [{ type: "web_search", search_context_size: "medium" }],
              tool_choice: "required",
            }
          : {
              temperature: config.temperature,
              text: { format: { type: "json_object" } },
            }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerError = await readProviderError(response);
      console.warn("[ai] Responses API request failed.", {
        status: response.status,
        webSearch: Boolean(options.webSearch),
        code: providerError.code,
        type: providerError.type,
        param: providerError.param,
      });
      return { text: null, error: "provider_error" as const, webSearchUsed: false, sources: [] };
    }

    const data = await response.json() as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{
          text?: string;
          type?: string;
          annotations?: Array<{
            type?: string;
            title?: string;
            url?: string;
          }>;
        }>;
      }>;
    };
    const text = data.output_text?.trim()
      || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim()
      || null;
    const webSearchUsed = Boolean(data.output?.some((item) => item.type === "web_search_call"));
    const sources = extractWebSources(data.output);
    return { text, error: text ? null : "empty_response" as const, webSearchUsed, sources };
  } catch (error) {
    console.warn("[ai] Responses API request did not complete.", {
      reason: error instanceof Error ? error.name : "unknown",
      webSearch: Boolean(options.webSearch),
    });
    return {
      text: null,
      error: error instanceof Error && error.name === "AbortError" ? "timeout" as const : "network_error" as const,
      webSearchUsed: false,
      sources: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractWebSources(output: Array<{
  content?: Array<{
    annotations?: Array<{ type?: string; title?: string; url?: string }>;
  }>;
}> | undefined): AiWebSource[] {
  const unique = new Map<string, AiWebSource>();
  for (const item of output ?? []) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type !== "url_citation" || !annotation.url) continue;
        try {
          const url = new URL(annotation.url);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
          unique.set(url.href, {
            title: annotation.title?.trim() || url.hostname,
            url: url.href,
          });
        } catch {
          // Ignore malformed provider citations.
        }
      }
    }
  }
  return [...unique.values()].slice(0, 8);
}

async function readProviderError(response: Response) {
  try {
    const payload = await response.json() as {
      error?: { code?: string; type?: string; param?: string };
    };
    return {
      code: payload.error?.code ?? "unknown",
      type: payload.error?.type ?? "unknown",
      param: payload.error?.param ?? "unknown",
    };
  } catch {
    return { code: "unknown", type: "unknown", param: "unknown" };
  }
}

async function generateAiChatCompletionText(messages: AiMessage[]) {
  const config = getAiConfig();
  if (!config.apiKey) return { text: null, error: "missing_api_key" as const, webSearchUsed: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[ai] Chat Completions fallback failed.", { status: response.status });
      return { text: null, error: "provider_error" as const, webSearchUsed: false };
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() || null;
    return { text, error: text ? null : "empty_response" as const, webSearchUsed: false };
  } catch (error) {
    console.warn("[ai] Chat Completions fallback did not complete.", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return {
      text: null,
      error: error instanceof Error && error.name === "AbortError" ? "timeout" as const : "network_error" as const,
      webSearchUsed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
