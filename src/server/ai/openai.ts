import { getAiConfig } from "./config";

interface AiMessage {
  role: "system" | "user";
  content: string;
}

export async function generateAiText(messages: AiMessage[]) {
  const response = await generateAiResponseText(messages);
  if (response.text) return response;
  return generateAiChatCompletionText(messages);
}

export async function generateAiTextWithWebSearch(messages: AiMessage[]) {
  return generateAiResponseText(messages, { webSearch: true });
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
        temperature: config.temperature,
        text: { format: { type: "json_object" } },
        store: false,
        ...(options.webSearch ? { tools: [{ type: "web_search", search_context_size: "low" }] } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[ai] Responses API request failed.", {
        status: response.status,
        webSearch: Boolean(options.webSearch),
      });
      return { text: null, error: "provider_error" as const, webSearchUsed: false };
    }

    const data = await response.json() as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{
          text?: string;
          type?: string;
        }>;
      }>;
    };
    const text = data.output_text?.trim()
      || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim()
      || null;
    const webSearchUsed = Boolean(data.output?.some((item) => item.type === "web_search_call"));
    return { text, error: text ? null : "empty_response" as const, webSearchUsed };
  } catch (error) {
    console.warn("[ai] Responses API request did not complete.", {
      reason: error instanceof Error ? error.name : "unknown",
      webSearch: Boolean(options.webSearch),
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
