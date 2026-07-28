"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, Gauge, Info, MessageSquareText, Mic, MicOff, RefreshCw, ShieldAlert, Target, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
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
type AiPanelKey = "answer" | "considerations" | "concepts" | "numbers";
type AiPanelItem =
  | { key: AiPanelKey; title: string; kind: "list"; items: string[] }
  | { key: AiPanelKey; title: string; kind: "metrics" };
type ChallengeAiInteraction = {
  prompt: string;
  result: ChallengeAiResult;
  createdAt: string;
};

export function ChallengeAnalysis() {
  const { accessUser } = useAccess();
  const { people, personCompensations, studioTargetAllocations, targetAllocations } = useDeliveryStore();
  const [view, setView] = useState<ChallengeView>("hunters");
  const [year, setYear] = useState(defaultYear);
  const [narrative, setNarrative] = useState("");
  const [aiResult, setAiResult] = useState<ChallengeAiResult | null>(null);
  const [aiBaselines, setAiBaselines] = useState<Record<string, ChallengeAiBaseline>>({});
  const [contextInput, setContextInput] = useState("");
  const [interactionsByBaseline, setInteractionsByBaseline] = useState<Record<string, ChallengeAiInteraction[]>>({});
  const [useExternalResearch, setUseExternalResearch] = useState(false);
  const [openAiPanel, setOpenAiPanel] = useState<AiPanelKey>("answer");
  const [loadingAi, setLoadingAi] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const activeInteractions = interactionsByBaseline[baselineKey] ?? [];

  useEffect(() => () => {
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function generateNarrative() {
    setLoadingAi(true);
    setErrorMessage("");
    const submittedContext = contextInput.trim();

    try {
      const accessToken = authService ? await authService.getAccessToken() : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const response = await fetch("/api/challenge-analysis", {
        method: "POST",
        headers,
        body: JSON.stringify({
          view,
          year,
          rows,
          context: submittedContext || undefined,
          baseline: activeBaseline ?? undefined,
          useExternalResearch,
          conversationHistory: activeInteractions.slice(-6).map((interaction) => ({
            prompt: interaction.prompt,
            answer: interaction.result.opinion || interaction.result.narrative,
          })),
        }),
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
      setInteractionsByBaseline((current) => ({
        ...current,
        [baselineKey]: [
          ...(current[baselineKey] ?? []).slice(-7),
          {
            prompt: submittedContext || "Gerar leitura executiva inicial com os números oficiais e a tese disponível.",
            result: data,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      setOpenAiPanel("answer");
      if (data.source === "generative_ai") {
        setContextInput("");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível gerar a análise.");
    } finally {
      setLoadingAi(false);
    }
  }

  async function startVoiceContext() {
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Gravação de voz não está disponível neste navegador. Você pode digitar o contexto.");
      return;
    }

    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        void transcribeVoiceContext(audio);
      };
      recorder.start();
      setListening(true);
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);
    } catch (error) {
      setListening(false);
      setErrorMessage(getVoiceCaptureErrorMessage(error));
    }
  }

  async function transcribeVoiceContext(audio: Blob) {
    if (!audio.size) {
      setErrorMessage("Nenhum áudio foi capturado. Tente novamente.");
      return;
    }

    setTranscribingVoice(true);
    setErrorMessage("");
    try {
      const accessToken = authService ? await authService.getAccessToken() : null;
      const headers: HeadersInit = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const body = new FormData();
      body.append("audio", audio, "contexto.webm");
      const response = await fetch("/api/challenge-analysis/transcribe", {
        method: "POST",
        headers,
        body,
      });
      const data = await response.json() as { transcript?: string; error?: string };
      if (!response.ok || !data.transcript) {
        throw new Error(data.error || "Não foi possível transcrever o áudio.");
      }
      setContextInput((current) => current ? `${current}\n${data.transcript}` : data.transcript || current);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível transcrever o áudio.");
    } finally {
      setTranscribingVoice(false);
    }
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
              Pergunte o que quiser sobre a coerência do desafio ou traga novos critérios por texto/voz. A GEN AI responde o que acha, reconsidera a leitura com esses critérios e simula efeitos sem alterar salário, metas ou dados oficiais.
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
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-purple-700"
                checked={useExternalResearch}
                onChange={(event) => setUseExternalResearch(event.target.checked)}
              />
              <span>
                <strong className="block text-slate-950">Buscar referências externas</strong>
                Usar pesquisa web pública como apoio, sem alterar metas, salários ou números oficiais.
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="outline" onClick={() => void startVoiceContext()} disabled={transcribingVoice} title="Gravar e transcrever contexto em português">
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {transcribingVoice ? "Transcrevendo..." : listening ? "Parar e transcrever" : "Falar contexto"}
            </Button>
            <Button type="button" onClick={generateNarrative} disabled={loadingAi || !rows.length}>
              {loadingAi ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Reavaliar com GEN AI
            </Button>
          </div>
        </div>
      </Card>

      <ChallengeConversationResult
        aiResult={aiResult}
        narrative={narrative}
        interactions={activeInteractions}
        activePanel={openAiPanel}
        onPanelChange={setOpenAiPanel}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiSummaryCard label="Pessoas avaliadas" value={rows.length} icon={UsersRound} />
        <KpiSummaryCard label="Meta analisada" currencyValue={totals.targetAmount} icon={Target} tone="purple" />
        <KpiSummaryCard label="Múltiplo médio" value={`${formatMultiple(totals.averageMultiple)}x`} icon={BrainCircuit} tone={getAverageTone(totals.averageMultiple, benchmark.low, benchmark.high)} />
        <KpiSummaryCard label="Em faixa mercado" value={totals.inMarketRange} icon={Gauge} tone={totals.inMarketRange ? "ok" : "neutral"} />
        <KpiSummaryCard label="Sem salário" value={totals.missing} icon={ShieldAlert} tone={totals.missing ? "warning" : "ok"} />
      </section>

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

function ChallengeConversationResult({
  aiResult,
  narrative,
  interactions,
  activePanel,
  onPanelChange,
}: {
  aiResult: ChallengeAiResult | null;
  narrative: string;
  interactions: ChallengeAiInteraction[];
  activePanel: AiPanelKey;
  onPanelChange: (panel: AiPanelKey) => void;
}) {
  const interaction = interactions.at(-1) ?? null;
  const result = interaction?.result ?? aiResult;
  const panelItems = result ? getAiPanelItems(result) : [];
  const activeItem = panelItems.find((item) => item.key === activePanel) ?? panelItems[0];

  return (
    <Card className="mb-5 border-purple-100 p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-brq-purple">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-950">Conversa com GEN AI</p>
              {result && (
                <Badge className={cn(
                  result.source === "generative_ai"
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                    : "bg-amber-100 text-amber-800 hover:bg-amber-100",
                )}>
                  {result.source === "generative_ai" ? "Resposta generativa" : "Leitura determinística"}
                </Badge>
              )}
              {interaction && <span className="text-xs text-slate-400">{formatDateTime(interaction.createdAt)}</span>}
            </div>
            {interaction ? (
              <div className="mt-3 space-y-2">
                {interactions.slice(0, -1).map((item, index) => (
                  <div key={`${item.createdAt}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Interação anterior</p>
                      <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{item.prompt}</p>
                    <p className="mt-2 border-l-2 border-purple-200 pl-3 text-sm leading-6 text-purple-950">
                      {item.result.opinion || item.result.narrative}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Você pediu</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{interaction.prompt}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gere uma leitura ou faça uma pergunta. A resposta aparecerá aqui como conversa, depois vira conceitos/tese para a próxima reavaliação.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brq-purple">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-purple-800">Resposta da IA</p>
              <p className="mt-1 text-sm leading-6 text-purple-950">
                {result?.opinion || narrative || "Aguardando uma interação para responder e aprimorar a tese."}
              </p>
              {result?.narrative && result.narrative !== result.opinion && (
                <p className="mt-3 text-sm leading-6 text-slate-700">{result.narrative}</p>
              )}
              {result?.externalResearch.requested && (
                <div className={cn(
                  "mt-3 rounded-lg px-3 py-2 text-xs font-semibold",
                  result.externalResearch.status === "used"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-900",
                )}>
                  <p>{result.externalResearch.message}</p>
                  {result.externalResearch.sources.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {result.externalResearch.sources.map((source) => (
                        <li key={source.url}>
                          <a className="underline underline-offset-2 hover:no-underline" href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {panelItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-bold transition",
                    activeItem?.key === item.key
                      ? "border-brq-purple bg-brq-purple text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  )}
                  onClick={() => onPanelChange(item.key)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            {activeItem && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-950">{activeItem.title}</p>
                {activeItem.kind === "metrics" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MiniMetric label="Pessoas" value={result.reflectedNumbers.peopleCount} />
                    <MiniMetric label="Meta analisada" value={formatCurrency(result.reflectedNumbers.targetAmount)} />
                    <MiniMetric label="Múltiplo médio" value={`${formatMultiple(result.reflectedNumbers.averageMultiple)}x`} />
                    <MiniMetric label="Faixa referência" value={`${formatMultiple(result.reflectedNumbers.benchmarkLow)}x a ${formatMultiple(result.reflectedNumbers.benchmarkHigh)}x`} />
                    <MiniMetric label="Adequados" value={result.reflectedNumbers.adequateCount} />
                    <MiniMetric label="Sem salário" value={result.reflectedNumbers.missingSalaryCount} />
                  </div>
                ) : (
                  <InsightBulletList items={activeItem.items} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
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

function InsightBulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brq-purple" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function getAiPanelItems(result: ChallengeAiResult): AiPanelItem[] {
  const items: AiPanelItem[] = [
    {
      key: "answer",
      title: "Feedback da interação",
      kind: "list",
      items: [
        result.opinion || result.narrative,
        ...result.simulatedReassessment,
      ].filter(Boolean),
    },
    {
      key: "considerations",
      title: "Considerações e recomendações",
      kind: "list",
      items: [
        ...result.recommendations,
        ...result.pendingQuestions.map((question) => `Pergunta pendente: ${question}`),
      ],
    },
    {
      key: "concepts",
      title: "Conceitos incorporados à tese",
      kind: "list",
      items: [
        ...result.assumptions,
        ...result.reconsideredCriteria.map((criteria) => `Critério reconsiderado: ${criteria}`),
      ],
    },
    {
      key: "numbers",
      title: "Números refletidos",
      kind: "metrics",
    },
  ];

  return items.filter((item) => item.kind === "metrics" || item.items.length > 0);
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
    return "Hunters compara Meta Squads/Times Hunter + Studio Hunter atribuído com salário mensal anualizado por 12; Studio Hunter é somado aqui como leitura derivada, sem virar meta direta da pessoa.";
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

function getVoiceCaptureErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "O acesso ao microfone foi bloqueado. Autorize o microfone nas permissões do navegador e tente novamente.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Nenhum microfone disponível foi encontrado. Verifique o dispositivo de áudio.";
  }
  if (error instanceof DOMException && error.name === "NotReadableError") {
    return "O microfone está sendo usado por outro aplicativo ou não pôde ser lido.";
  }
  return "Não foi possível iniciar a gravação. Verifique o microfone ou digite o contexto manualmente.";
}
