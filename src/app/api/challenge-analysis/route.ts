import { NextResponse } from "next/server";
import { z } from "zod";
import { generateChallengeNarrative } from "@/server/ai/challenge-analysis";
import { assertCanUseChallengeAnalysis, ChallengeAccessError } from "@/server/auth/challenge-analysis-access";
import type { ChallengeAiBaseline, ChallengeAnalysisRow, ChallengeView } from "@/lib/challenge-analysis";
import {
  categorizeTelemetryError,
  getCorrelationId,
  hashTelemetryValue,
  startOperation,
  withCorrelationHeader,
} from "@/server/observability/telemetry";

const challengeAiNumbersSchema = z.object({
  peopleCount: z.number().int().nonnegative(),
  targetAmount: z.number().finite().nonnegative(),
  averageMultiple: z.number().finite().nonnegative().nullable(),
  adequateCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  aggressiveCount: z.number().int().nonnegative(),
  missingSalaryCount: z.number().int().nonnegative(),
  benchmarkLow: z.number().finite().nonnegative(),
  benchmarkHigh: z.number().finite().nonnegative(),
});

const challengeAiBaselineSchema = z.object({
  id: z.string().min(1).max(220),
  view: z.enum(["hunters", "farmers", "delivery"]),
  year: z.number().int().min(2020).max(2100),
  createdAt: z.string().max(80),
  context: z.string().max(4000),
  narrative: z.string().max(4000),
  opinion: z.string().max(4000).optional(),
  reconsideredCriteria: z.array(z.string().max(1000)).max(6).optional(),
  simulatedReassessment: z.array(z.string().max(1000)).max(6).optional(),
  reflectedNumbers: challengeAiNumbersSchema,
  assumptions: z.array(z.string().max(1000)).max(6),
  recommendations: z.array(z.string().max(1000)).max(6),
  pendingQuestions: z.array(z.string().max(1000)).max(4),
});

const challengeRowSchema = z.object({
  personId: z.string().min(1).max(160),
  personName: z.string().min(1).max(160),
  jobTitle: z.string().max(160),
  roleType: z.string().max(80),
  annualSalary: z.number().finite().nonnegative().nullable(),
  targetAmount: z.number().finite().nonnegative(),
  challengeMultiple: z.number().finite().nonnegative().nullable(),
  status: z.enum(["low", "adequate", "aggressive", "missing"]),
  seniority: z.enum(["junior", "mid", "senior", "lead", "executive"]),
  marketSignal: z.object({
    status: z.enum(["below_market", "in_range", "above_market", "missing"]),
    label: z.string().max(120),
    seniorityLabel: z.string().max(120),
    low: z.number().finite().nonnegative(),
    high: z.number().finite().nonnegative(),
    rationale: z.string().max(1000),
  }),
  view: z.enum(["hunters", "farmers", "delivery"]),
});

const challengeRequestSchema = z.object({
  view: z.enum(["hunters", "farmers", "delivery"]),
  year: z.number().int().min(2020).max(2100).optional(),
  rows: z.array(challengeRowSchema).max(200),
  context: z.string().trim().max(4000).optional(),
  baseline: challengeAiBaselineSchema.optional(),
  useExternalResearch: z.boolean().optional(),
  conversationHistory: z.array(z.object({
    prompt: z.string().trim().min(1).max(4000),
    answer: z.string().trim().min(1).max(4000),
  })).max(6).optional(),
});

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const operation = startOperation({
    operationName: "executive.challengeAnalysis.generate",
    capability: "Challenges",
    correlationId,
  });

  try {
    operation.startPhase("auth");
    const accessUser = await assertCanUseChallengeAnalysis(request);
    operation.endPhase("auth");
    operation.setUser({
      userId: accessUser.userId,
      role: accessUser.role,
      emailHash: hashTelemetryValue(accessUser.email),
    });

    operation.startPhase("request.parse");
    const body = await request.json();
    const parsed = challengeRequestSchema.safeParse(body);
    operation.endPhase("request.parse");
    if (!parsed.success) {
      operation.fail({ errorCategory: "validation" });
      return withCorrelationHeader(
        NextResponse.json({ error: "Dados inválidos para análise." }, { status: 400 }),
        correlationId,
      );
    }

    operation.startPhase("analysis.prepare");
    const rows = parsed.data.rows.filter((row) => row.view === parsed.data.view) as ChallengeAnalysisRow[];
    const analysisYear = parsed.data.year ?? 2026;
    const hasContext = Boolean(parsed.data.context?.trim());
    const hasPreviousBaseline = Boolean(parsed.data.baseline);
    operation.setBusinessContext({
      view: parsed.data.view,
      year: analysisYear,
      contextHash: hashTelemetryValue(parsed.data.context),
    });
    operation.endPhase("analysis.prepare");

    operation.startPhase("ai.generate");
    const result = await generateChallengeNarrative({
      rows,
      view: parsed.data.view as ChallengeView,
      year: analysisYear,
      context: parsed.data.context,
      previousBaseline: parsed.data.baseline as ChallengeAiBaseline | undefined,
      conversationHistory: parsed.data.conversationHistory,
      useExternalResearch: parsed.data.useExternalResearch,
    });
    operation.endPhase("ai.generate");
    operation.succeed({
      metrics: {
        submittedRows: parsed.data.rows.length,
        analyzedRows: rows.length,
        hasContext: hasContext ? 1 : 0,
        hasPreviousBaseline: hasPreviousBaseline ? 1 : 0,
        requestedExternalResearch: parsed.data.useExternalResearch ? 1 : 0,
        generativeAiResult: result.source === "generative_ai" ? 1 : 0,
        deterministicFallbackResult: result.source === "deterministic_fallback" ? 1 : 0,
      },
    });

    return withCorrelationHeader(NextResponse.json(result), correlationId);
  } catch (error) {
    if (error instanceof ChallengeAccessError) {
      operation.fail({ errorCategory: "authorization", error });
      return withCorrelationHeader(
        NextResponse.json(
          { error: "Acesso não autorizado para análise de remuneração." },
          { status: error.status },
        ),
        correlationId,
      );
    }
    operation.fail({ errorCategory: categorizeTelemetryError(error), error });
    return withCorrelationHeader(
      NextResponse.json(
        { error: "Não foi possível gerar a análise agora. Tente novamente em instantes." },
        { status: 500 },
      ),
      correlationId,
    );
  }
}
