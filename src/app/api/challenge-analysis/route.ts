import { NextResponse } from "next/server";
import { z } from "zod";
import { generateChallengeNarrative } from "@/server/ai/challenge-analysis";
import type { ChallengeAiBaseline, ChallengeAnalysisRow, ChallengeView } from "@/lib/challenge-analysis";

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
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = challengeRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("Invalid challenge analysis payload", parsed.error.flatten().fieldErrors);
      return NextResponse.json({ error: "Dados inválidos para análise." }, { status: 400 });
    }

    const rows = parsed.data.rows.filter((row) => row.view === parsed.data.view) as ChallengeAnalysisRow[];
    const analysisYear = parsed.data.year ?? 2026;
    const result = await generateChallengeNarrative({
      rows,
      view: parsed.data.view as ChallengeView,
      year: analysisYear,
      context: parsed.data.context,
      previousBaseline: parsed.data.baseline as ChallengeAiBaseline | undefined,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar a análise agora. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
