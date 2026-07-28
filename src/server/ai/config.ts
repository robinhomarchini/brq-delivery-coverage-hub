export function getAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || "gpt-5.5",
    transcriptionModel: process.env.AI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    maxTokens: Number(process.env.AI_MAX_TOKENS || 900),
    temperature: Number(process.env.AI_TEMPERATURE || 0.2),
  };
}
