import { getAiConfig } from "./config";

interface AiMessage {
  role: "system" | "user";
  content: string;
}

export async function generateAiText(messages: AiMessage[]) {
  const responseText = await generateAiResponseText(messages);
  return responseText ?? generateAiChatCompletionText(messages);
}

export async function generateAiTextWithWebSearch(messages: AiMessage[]) {
  return generateAiResponseText(messages, { webSearch: true });
}

async function generateAiResponseText(messages: AiMessage[], options: { webSearch?: boolean } = {}) {
  const config = getAiConfig();
  if (!config.apiKey) return null;

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
      return null;
    }

    const data = await response.json() as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
          type?: string;
        }>;
      }>;
    };
    return data.output_text?.trim()
      || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim()
      || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAiChatCompletionText(messages: AiMessage[]) {
  const config = getAiConfig();
  if (!config.apiKey) return null;

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
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
