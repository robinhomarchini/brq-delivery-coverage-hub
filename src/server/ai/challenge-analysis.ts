import type { ChallengeAiBaseline, ChallengeAiNumbers, ChallengeAiResult, ChallengeAnalysisRow, ChallengeView } from "@/lib/challenge-analysis";
import { getChallengeBenchmark } from "@/lib/challenge-analysis";
import { generateAiText } from "./openai";

export async function generateChallengeNarrative({
  rows,
  view,
  year,
  context,
  previousBaseline,
}: {
  rows: ChallengeAnalysisRow[];
  view: ChallengeView;
  year: number;
  context?: string;
  previousBaseline?: ChallengeAiBaseline;
}): Promise<ChallengeAiResult> {
  const benchmark = getChallengeBenchmark(view);
  const normalizedContext = context?.trim();
  const reflectedNumbers = buildReflectedNumbers(rows, benchmark);
  const anonymizedRows = rows.map((row) => ({
    perfil: row.roleType,
    cargo: row.jobTitle,
    meta: Math.round(row.targetAmount),
    salarioAnualizado: row.annualSalary === null ? null : Math.round(row.annualSalary),
    multiplo: row.challengeMultiple === null ? null : Number(row.challengeMultiple.toFixed(2)),
    status: row.status,
    senioridade: row.marketSignal.seniorityLabel,
    faixaMercado: `${row.marketSignal.low}x a ${row.marketSignal.high}x`,
  }));

  const fallback = buildFallbackResult({ rows, view, year, context: normalizedContext, reflectedNumbers, previousBaseline });
  const aiText = await generateAiText([
    {
      role: "system",
      content: "Você é um advisor executivo de vendas e delivery. Responda em pt-BR, com prudência. Não faça decisão individual de remuneração. Avalie conceitos existentes e aprendidos no baseline GEN AI contra os números oficiais cadastrados/calculados. Use apenas dados agregados/anônimos enviados, baseline GEN AI anterior e contexto adicional. Diferencie fatos medidos, hipóteses/conceitos aprendidos e recomendações. Não cite nomes de pessoas. Não altere salário, meta ou status oficial. Retorne somente JSON válido.",
    },
    {
      role: "user",
      content: JSON.stringify({
        objetivo: normalizedContext
          ? "Reavaliar o desafio e atualizar o baseline conceitual GEN AI, incorporando o contexto adicional como aprendizado da análise para comparar contra os números oficiais, sem alterar dados oficiais."
          : "Avaliar o desafio e criar baseline conceitual GEN AI inicial para comparar conceitos existentes contra números oficiais, sem citar nomes.",
        visao: getChallengeViewLabel(view),
        ano: year,
        referencia: `Faixa interna de múltiplo meta/salário: adequado entre ${benchmark.low}x e ${benchmark.high}x.`,
        numerosCalculados: reflectedNumbers,
        baselineGenAiAnterior: previousBaseline ? {
          criadoEm: previousBaseline.createdAt,
          contexto: previousBaseline.context,
          narrativa: previousBaseline.narrative,
          hipoteses: previousBaseline.assumptions,
          recomendacoes: previousBaseline.recommendations,
          perguntasPendentes: previousBaseline.pendingQuestions,
        } : "Nenhum baseline GEN AI anterior.",
        contextoAdicional: normalizedContext || "Nenhum contexto adicional informado.",
        linhas: anonymizedRows,
        respostaEsperada: {
          narrative: "Um parágrafo executivo revisado, citando que os números oficiais permanecem preservados.",
          assumptions: "Array com até 4 conceitos, hipóteses ou aprendizados incorporados ao baseline GEN AI.",
          recommendations: "Array com 3 recomendações objetivas.",
          pendingQuestions: "Array com até 2 perguntas pendentes para calibrar melhor a análise.",
        },
      }),
    },
  ]);

  return buildResultFromAiText({
    aiText,
    fallback,
    view,
    year,
    context: normalizedContext,
    reflectedNumbers,
  });
}

function buildReflectedNumbers(rows: ChallengeAnalysisRow[], benchmark: { low: number; high: number }): ChallengeAiNumbers {
  const rowsWithMultiple = rows.filter((row) => row.challengeMultiple !== null);
  return {
    peopleCount: rows.length,
    targetAmount: rows.reduce((total, row) => total + row.targetAmount, 0),
    averageMultiple: rowsWithMultiple.length
      ? roundTwo(rowsWithMultiple.reduce((total, row) => total + (row.challengeMultiple ?? 0), 0) / rowsWithMultiple.length)
      : null,
    adequateCount: rows.filter((row) => row.status === "adequate").length,
    lowCount: rows.filter((row) => row.status === "low").length,
    aggressiveCount: rows.filter((row) => row.status === "aggressive").length,
    missingSalaryCount: rows.filter((row) => row.status === "missing").length,
    benchmarkLow: benchmark.low,
    benchmarkHigh: benchmark.high,
  };
}

function buildFallbackResult({
  rows,
  view,
  year,
  context,
  reflectedNumbers,
  previousBaseline,
}: {
  rows: ChallengeAnalysisRow[];
  view: ChallengeView;
  year: number;
  context?: string;
  reflectedNumbers: ChallengeAiNumbers;
  previousBaseline?: ChallengeAiBaseline;
}): ChallengeAiResult {
  const total = rows.length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const low = rows.filter((row) => row.status === "low").length;
  const adequate = rows.filter((row) => row.status === "adequate").length;
  const aggressive = rows.filter((row) => row.status === "aggressive").length;
  const label = getChallengeViewLabel(view);
  const narrative = `${label}: ${adequate} de ${total} pessoa(s) estão na faixa adequada, ${low} abaixo do desafio esperado, ${aggressive} com desafio agressivo e ${missing} sem salário cadastrado. ${context ? "O contexto informado foi incorporado como baseline GEN AI da análise, sem alterar salários, metas ou classificações oficiais." : "Este baseline GEN AI inicial usa apenas os dados calculados oficiais."} Use esta leitura como apoio gerencial.`;
  const assumptions = [
    ...(previousBaseline ? ["Baseline GEN AI anterior considerado como ponto de partida contextual."] : []),
    ...(context ? [`Contexto incorporado como aprendizado da análise: ${context}`] : ["Nenhum contexto adicional informado."]),
  ];
  const recommendations = [
    "Revisar casos abaixo da faixa antes de concluir adequação do desafio.",
    "Validar capacidade real e carteira nos casos com desafio agressivo.",
    "Completar salários ausentes antes de usar a leitura em decisão executiva.",
  ];
  const pendingQuestions = context ? ["Há evidência quantitativa para converter o contexto em ajuste de meta ou carteira?", "O contexto vale apenas para esta visão/ano ou deve virar regra formal?"] : [];

  return makeAiResult({
    view,
    year,
    context,
    reflectedNumbers,
    narrative,
    assumptions,
    recommendations,
    pendingQuestions,
  });
}

function buildResultFromAiText({
  aiText,
  fallback,
  view,
  year,
  context,
  reflectedNumbers,
}: {
  aiText: string | null;
  fallback: ChallengeAiResult;
  view: ChallengeView;
  year: number;
  context?: string;
  reflectedNumbers: ChallengeAiNumbers;
}) {
  if (!aiText) return fallback;

  const parsed = parseAiJson(aiText);
  if (!parsed) return fallback;

  return makeAiResult({
    view,
    year,
    context,
    reflectedNumbers,
    narrative: normalizeText(parsed.narrative) || fallback.narrative,
    assumptions: normalizeStringArray(parsed.assumptions, fallback.assumptions),
    recommendations: normalizeStringArray(parsed.recommendations, fallback.recommendations),
    pendingQuestions: normalizeStringArray(parsed.pendingQuestions, fallback.pendingQuestions),
  });
}

function makeAiResult({
  view,
  year,
  context,
  reflectedNumbers,
  narrative,
  assumptions,
  recommendations,
  pendingQuestions,
}: {
  view: ChallengeView;
  year: number;
  context?: string;
  reflectedNumbers: ChallengeAiNumbers;
  narrative: string;
  assumptions: string[];
  recommendations: string[];
  pendingQuestions: string[];
}): ChallengeAiResult {
  const createdAt = new Date().toISOString();
  const baseline: ChallengeAiBaseline = {
    id: `${view}-${year}-${createdAt}`,
    view,
    year,
    createdAt,
    context: context || "",
    narrative,
    reflectedNumbers,
    assumptions,
    recommendations,
    pendingQuestions,
  };

  return {
    narrative,
    reflectedNumbers,
    assumptions,
    recommendations,
    pendingQuestions,
    baseline,
  };
}

function parseAiJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .slice(0, 4);
  return normalized.length ? normalized : fallback;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function getChallengeViewLabel(view: ChallengeView) {
  if (view === "hunters") return "Hunters";
  if (view === "farmers") return "Farmers / Renovação + Ampliação";
  return "Delivery";
}
