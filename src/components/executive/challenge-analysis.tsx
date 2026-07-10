"use client";

import { useMemo, useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, Gauge, Info, Mic, MicOff, RefreshCw, ShieldAlert, Target, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
import type { ChallengeAiBaseline, ChallengeAiResult, ChallengeAnalysisRow, ChallengeMarketStatus, ChallengeStatus, ChallengeView } from "@/lib/challenge-analysis";
import { buildChallengeRows, getChallengeBenchmark } from "@/lib/challenge-analysis";
import { canManageCompensation } from "@/lib/compensation-access";
import { useAccess } from "@/lib/access-context";
import { createAuthServiceSelection } from "@/lib/auth/auth-service";
import { useDeliveryStore } from "@/store/delivery-store";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorNotice } from "@/components/shared/success-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

const defaultYear = 2026;

export function ChallengeAnalysis() {
  const { accessUser } = useAccess();
  const { people, personCompensations, studioTargetAllocations, targetAllocations } = useDeliveryStore();
  const [view, setView] = useState<ChallengeView>("hunters");
  const [year, setYear] = useState(defaultYear);
  const [narrative, setNarrative] = useState("");
  const [aiResult, setAiResult] = useState<ChallengeAiResult | null>(null);
  const [aiBaselines, setAiBaselines] = useState<Record<string, ChallengeAiBaseline>>({});
  const [contextInput, setContextInput] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [listening, setListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const authSelection = useMemo(() => createAuthServiceSelection(), []);
  const authService = authSelection.service;
  const canView = canManageCompensation(accessUser, people);
  const years = useMemo(
    () => Array.from(new Set([
      defaultYear,
      ...targetAllocations.map((allocation) => allocation.year),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((first, second) => second - first),
    [studioTargetAllocations, targetAllocations],
  );
  const rows = useMemo(
    () => buildChallengeRows(people, personCompensations, targetAllocations, studioTargetAllocations, year, view),
    [people, personCompensations, studioTargetAllocations, targetAllocations, view, year],
  );
  const totals = useMemo(() => getChallengeTotals(rows), [rows]);
  const benchmark = getChallengeBenchmark(view);
  const baselineKey = `${view}:${year}`;
  const activeBaseline = aiBaselines[baselineKey] ?? null;

  async function generateNarrative() {
    setLoadingAi(true);
    setErrorMessage("");

    try {
      const accessToken = authService ? await authService.getAccessToken() : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/challenge-analysis", {
        method: "POST",
        headers,
        body: JSON.stringify({ view, year, rows, context: contextInput.trim() || undefined, baseline: activeBaseline ?? undefined }),
      });
      const data = await response.json() as ChallengeAiResult & { error?: string };

      if (!response.ok || !data.narrative) {
        throw new Error(data.error || "Não foi possível gerar a análise.");
      }
      setNarrative(data.narrative);
      setAiResult(data);
      setAiBaselines((current) => ({
        ...current,
        [baselineKey]: data.baseline,
      }));
      setContextInput("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível gerar a análise.");
    } finally {
      setLoadingAi(false);
    }
  }

  function startVoiceContext() {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setErrorMessage("Reconhecimento de voz não está disponível neste navegador.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setErrorMessage("Não foi possível capturar a fala. Você pode digitar o contexto manualmente.");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setContextInput((current) => current ? `${current}\n${transcript}` : transcript);
    };
    recognition.start();
  }

  if (!canView) {
    return (
      <RestrictedView />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="C-level"
        title="Análise de Desafio"
        description="Avalie se o desafio de meta está coerente com o investimento salarial, separado por visões estratégicas."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select className="w-32" value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Button type="button" onClick={generateNarrative} disabled={loadingAi || !rows.length}>
              {loadingAi ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {contextInput.trim() || activeBaseline ? "Reavaliar com GEN AI" : "Gerar leitura GEN AI"}
            </Button>
          </div>
        )}
      />

      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="mb-5 p-4 shadow-sm">
        <div className="space-y-4">
          <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
            <SegmentButton active={view === "hunters"} onClick={() => setView("hunters")} title={getViewRationale("hunters")}>
              Hunters
            </SegmentButton>
            <SegmentButton active={view === "farmers"} onClick={() => setView("farmers")} title={getViewRationale("farmers")}>
              Farmers
            </SegmentButton>
            <SegmentButton active={view === "delivery"} onClick={() => setView("delivery")} title={getViewRationale("delivery")}>
              Delivery
            </SegmentButton>
          </div>
          <div className="flex max-w-5xl items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600" title={getViewRationale(view)}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              {getViewRationale(view)} Faixa de referência interna: {benchmark.low}x a {benchmark.high}x de meta anual sobre salário anualizado, calculado como salário mensal cadastrado x 12.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-5 border-purple-100 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-brq-purple" />
              <p className="text-sm font-bold text-slate-950">Assistente GEN AI de reavaliação</p>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Traga conceitos, hipóteses ou aprendizados por texto ou voz. A GEN AI compara esse baseline conceitual com os números oficiais cadastrados, sem alterar salário, metas ou qualquer dado oficial.
            </p>
            {activeBaseline && (
              <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs text-purple-900">
                <p className="font-bold">Baseline GEN AI ativo</p>
                <p className="mt-1 leading-5">
                  A próxima reavaliação parte da tese aprendida em {formatDateTime(activeBaseline.createdAt)} para {getChallengeViewLabel(view)} {year}.
                </p>
              </div>
            )}
            <Textarea
              className="mt-3 min-h-28"
              value={contextInput}
              onChange={(event) => setContextInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!loadingAi && rows.length) {
                    void generateNarrative();
                  }
                }
              }}
              maxLength={4000}
              placeholder="Ex.: conceito aprendido, mudança de tese, carteira herdada, conta atípica, transição de papel, responsabilidade regional, pipeline fora do ano, restrição operacional relevante..."
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{contextInput.length}/4000 caracteres</span>
              {contextInput && (
                <button type="button" className="font-semibold text-brq-purple hover:text-purple-700" onClick={() => setContextInput("")}>
                  Limpar contexto
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="outline" onClick={startVoiceContext} disabled={listening} title="Ditado por voz em português quando suportado pelo navegador">
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Ouvindo..." : "Falar contexto"}
            </Button>
            <Button type="button" onClick={generateNarrative} disabled={loadingAi || !rows.length}>
              {loadingAi ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Reavaliar com GEN AI
            </Button>
          </div>
        </div>
      </Card>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiSummaryCard label="Pessoas avaliadas" value={rows.length} icon={UsersRound} />
        <KpiSummaryCard label="Meta analisada" currencyValue={totals.targetAmount} icon={Target} tone="purple" />
        <KpiSummaryCard label="Múltiplo médio" value={`${formatMultiple(totals.averageMultiple)}x`} icon={BrainCircuit} tone={getAverageTone(totals.averageMultiple, benchmark.low, benchmark.high)} />
        <KpiSummaryCard label="Em faixa mercado" value={totals.inMarketRange} icon={Gauge} tone={totals.inMarketRange ? "ok" : "neutral"} />
        <KpiSummaryCard label="Sem salário" value={totals.missing} icon={ShieldAlert} tone={totals.missing ? "warning" : "ok"} />
      </section>

      <Card className="mb-5 border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-brq-purple">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Leitura executiva</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {narrative || "Gere a leitura GEN AI para receber uma avaliação dos conceitos existentes/aprendidos contra os números oficiais cadastrados. A análise não cita nomes e deve ser usada como apoio gerencial, não como decisão automática de remuneração."}
            </p>
          </div>
        </div>
      </Card>

      {aiResult && (
        <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-brq-purple" />
              <p className="text-sm font-bold text-slate-950">Números oficiais refletidos</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Pessoas" value={aiResult.reflectedNumbers.peopleCount} />
              <MiniMetric label="Meta analisada" value={formatCurrency(aiResult.reflectedNumbers.targetAmount)} />
              <MiniMetric label="Múltiplo médio" value={`${formatMultiple(aiResult.reflectedNumbers.averageMultiple)}x`} />
              <MiniMetric label="Faixa referência" value={`${formatMultiple(aiResult.reflectedNumbers.benchmarkLow)}x a ${formatMultiple(aiResult.reflectedNumbers.benchmarkHigh)}x`} />
              <MiniMetric label="Adequados" value={aiResult.reflectedNumbers.adequateCount} />
              <MiniMetric label="Sem salário" value={aiResult.reflectedNumbers.missingSalaryCount} />
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-brq-purple" />
              <p className="text-sm font-bold text-slate-950">Baseline conceitual GEN AI</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Aprendizado contextual usado como tese da análise. Não altera dados oficiais.
            </p>
            <InsightList title="Conceitos aprendidos / hipóteses" items={aiResult.assumptions} />
            <InsightList title="Recomendações" items={aiResult.recommendations} />
            {aiResult.pendingQuestions.length > 0 && <InsightList title="Perguntas pendentes" items={aiResult.pendingQuestions} />}
          </Card>
        </section>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1240px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Salário anualizado</TableHead>
                <TableHead>Meta analisada</TableHead>
                <TableHead>Múltiplo</TableHead>
                <TableHead>Mercado / senioridade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.personId}>
                  <TableCell className="font-bold text-slate-950">{row.personName}</TableCell>
                  <TableCell>{row.jobTitle}</TableCell>
                  <TableCell>{row.roleType}</TableCell>
                  <TableCell>{row.annualSalary === null ? "Não informado" : formatCurrency(row.annualSalary)}</TableCell>
                  <TableCell>{formatCurrency(row.targetAmount)}</TableCell>
                  <TableCell>
                    <span className={cn("font-bold tabular-nums", getMultipleClassName(row.status))}>
                      {row.challengeMultiple === null ? "—" : `${formatMultiple(row.challengeMultiple)}x`}
                    </span>
                  </TableCell>
                  <TableCell><MarketSignalBadge row={row} /></TableCell>
                  <TableCell><StatusBadge status={row.status} low={benchmark.low} high={benchmark.high} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!rows.length && <EmptyState />}
      </Card>
    </>
  );
}

function RestrictedView() {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-purple-50 text-brq-purple">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">C-level</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Análise restrita</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Esta visão usa dados salariais e fica disponível apenas para usuário BRQ ativo com perfil admin e cargo próprio de VP ou Vice-presidente.
          </p>
        </div>
      </div>
    </section>
  );
}

function SegmentButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "min-w-24 rounded-xl px-4 py-2 text-sm font-bold transition",
        active ? "bg-brq-purple text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status, low, high }: { status: ChallengeStatus; low: number; high: number }) {
  const title = `Racional: múltiplo = meta anual analisada / salário anualizado. Salário anualizado = salário mensal cadastrado x 12. Adequado nesta visão entre ${low}x e ${high}x.`;
  if (status === "adequate") return <Badge variant="success" title={title}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Adequado</Badge>;
  if (status === "low") return <Badge variant="destructive" title={title}>Abaixo da referência</Badge>;
  if (status === "aggressive") return <Badge variant="warning" title={title}>Desafio agressivo</Badge>;
  return <Badge variant="secondary" title="Sem salário mensal cadastrado para calcular o múltiplo anualizado.">Sem salário</Badge>;
}

function MarketSignalBadge({ row }: { row: ChallengeAnalysisRow }) {
  return (
    <div title={row.marketSignal.rationale} className="inline-flex max-w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", getMarketIconClassName(row.marketSignal.status))}>
        <MarketSignalIcon status={row.marketSignal.status} />
      </span>
      <span className="min-w-0">
        <span className={cn("block font-bold", getMarketTextClassName(row.marketSignal.status))}>{row.marketSignal.label}</span>
        <span className="block truncate text-slate-400">
          {row.marketSignal.seniorityLabel} · ref. {formatMultiple(row.marketSignal.low)}x-{formatMultiple(row.marketSignal.high)}x
        </span>
      </span>
    </div>
  );
}

function MarketSignalIcon({ status }: { status: ChallengeMarketStatus }) {
  if (status === "in_range") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "below_market") return <TrendingDown className="h-4 w-4" />;
  if (status === "above_market") return <TrendingUp className="h-4 w-4" />;
  return <ShieldAlert className="h-4 w-4" />;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-600">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function getChallengeTotals(rows: ChallengeAnalysisRow[]) {
  const rowsWithMultiple = rows.filter((row) => row.challengeMultiple !== null);
  return {
    targetAmount: rows.reduce((total, row) => total + row.targetAmount, 0),
    averageMultiple: rowsWithMultiple.length
      ? rowsWithMultiple.reduce((total, row) => total + (row.challengeMultiple ?? 0), 0) / rowsWithMultiple.length
      : null,
    low: rows.filter((row) => row.status === "low").length,
    missing: rows.filter((row) => row.status === "missing").length,
    inMarketRange: rows.filter((row) => row.marketSignal.status === "in_range").length,
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getAverageTone(value: number | null, low: number, high: number) {
  if (value === null) return "warning";
  if (value < low) return "danger";
  if (value > high) return "warning";
  return "ok";
}

function getMultipleClassName(status: ChallengeStatus) {
  if (status === "adequate") return "text-emerald-700";
  if (status === "low") return "text-red-700";
  if (status === "aggressive") return "text-amber-700";
  return "text-slate-400";
}

function getMarketIconClassName(status: ChallengeMarketStatus) {
  if (status === "in_range") return "bg-emerald-100 text-emerald-700";
  if (status === "below_market") return "bg-red-100 text-red-700";
  if (status === "above_market") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function getMarketTextClassName(status: ChallengeMarketStatus) {
  if (status === "in_range") return "text-emerald-700";
  if (status === "below_market") return "text-red-700";
  if (status === "above_market") return "text-amber-700";
  return "text-slate-500";
}

function formatMultiple(value: number | null) {
  if (value === null) return "0,00";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getViewRationale(view: ChallengeView) {
  if (view === "hunters") {
    return "Hunters compara Hunter próprio + Studio Hunter atribuído com salário mensal anualizado por 12; Studio Hunter é somado aqui como leitura derivada, sem virar meta direta da pessoa.";
  }
  if (view === "farmers") {
    return "Farmers compara Renovação + Ampliação com salário mensal anualizado por 12 para avaliar desafio de expansão e retenção.";
  }
  return "Delivery compara metas sob responsabilidade de entrega, como renovação/ampliação e Áreas & Studios quando existirem, com salário mensal anualizado por 12 para avaliar desafio operacional.";
}

function getChallengeViewLabel(view: ChallengeView) {
  if (view === "hunters") return "Hunters";
  if (view === "farmers") return "Farmers";
  return "Delivery";
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
