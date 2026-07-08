export function getAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || "gpt-5.5",
    maxTokens: Number(process.env.AI_MAX_TOKENS || 900),
    temperature: Number(process.env.AI_TEMPERATURE || 0.2),
  };
}
