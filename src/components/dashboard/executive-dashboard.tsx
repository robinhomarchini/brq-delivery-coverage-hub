"use client";

import {
  BriefcaseBusiness,
  Building2,
  Download,
  FileDown,
  Target,
  TrendingUp,
  UserCog,
  UsersRound,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState, useSyncExternalStore } from "react";
import { usePersistedHunterScope } from "@/hooks/usePersistedHunterScope";
import { Button } from "@/components/ui/button";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeliveryStore } from "@/store/delivery-store";
import { exportDeliveryDataAsCsv, exportElementAsPdf } from "@/lib/export";
import { cn, formatCompactCurrency, formatCurrency } from "@/lib/utils";
import { defaultTargetYear } from "@/lib/customer-targets";
import { useAccess } from "@/lib/access-context";
import { buildHunterAccessScope } from "@/lib/hunter-access-scope";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useCustomerPerformance } from "@/hooks/useCustomerPerformance";
import type { DashboardSummaryFilters } from "@/lib/repositories";
import { buildDashboardData } from "@/lib/dashboardMetrics";

const COLORS = ["#15171B", "#7F2EC9", "#EE7C38", "#2563EB", "#F97316", "#A3A3A3"];

export function ExecutiveDashboard() {
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const { accessUser } = useAccess();
  const { areas, people, customers, customerTargets, boardTargetBaselines, targetAllocations, studioTargetAllocations, specialistHunterStudioAssignments, loading, error } = useDeliveryStore();
  const [includeNewLogos, setIncludeNewLogos] = useState(false);

  const hunterScope = useMemo(() => buildHunterAccessScope({
    accessUser,
    people,
    customers,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
  }), [
    accessUser,
    customers,
    people,
    specialistHunterStudioAssignments,
    studioTargetAllocations,
    targetAllocations,
  ]);

  const persistedHunterScope = usePersistedHunterScope(hunterScope);

  const dashboardFilters = useMemo<DashboardSummaryFilters>(() => ({
    targetYear: defaultTargetYear,
    includeNewLogos,
    hunterScopeEnabled: hunterScope.enabled && persistedHunterScope.enabled,
    hunterPersonId: persistedHunterScope.personId ?? hunterScope.person?.id ?? null,
    hunterCustomerIds: persistedHunterScope.customerIds.length > 0 ? persistedHunterScope.customerIds : Array.from(hunterScope.customerIds ?? []).sort(),
  }), [hunterScope.enabled, hunterScope.customerIds, hunterScope.person?.id, includeNewLogos, persistedHunterScope.enabled, persistedHunterScope.personId, persistedHunterScope.customerIds]);

  const { summary: rpcSummary, financialByCustomer: rpcFinancialByCustomer, loading: rpcLoading, error: rpcError } = useDashboardSummary(dashboardFilters);
  const { items: customerPerformanceItems, loading: customerPerformanceLoading, error: customerPerformanceError } = useCustomerPerformance(dashboardFilters);

  const data = useMemo(() => buildDashboardData(
    people,
    customers,
    customerTargets,
    targetAllocations,
    studioTargetAllocations,
    boardTargetBaselines,
    areas,
    {
      includeNewLogos,
      hunterScope,
      targetYear: defaultTargetYear,
    },
  ), [
    people,
    customers,
    customerTargets,
    targetAllocations,
    studioTargetAllocations,
    boardTargetBaselines,
    areas,
    includeNewLogos,
    hunterScope,
  ]);

  const summaryLoading = loading ? false : rpcLoading;
  const summaryError = error ? undefined : rpcError;
  const effectiveSummary = useMemo(() => rpcSummary ?? data.summary, [rpcSummary, data.summary]);
  const effectiveFinancialByCustomer = useMemo(() => rpcFinancialByCustomer.length > 0 ? rpcFinancialByCustomer : data.financialByCustomer, [rpcFinancialByCustomer, data.financialByCustomer]);

  if (loading) {
    return (
      <div className="min-w-0 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-0 space-y-4">
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-red-800">Falha ao carregar o dashboard</p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, financialByDirector, financialByManager, roleDistribution, clientsByManager, clientsByDirector, alerts } = data;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-brq-purple">Visão executiva</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-brq-ink lg:text-4xl">Cobertura que importa</h1>
          <p className="mt-2 text-sm text-slate-500">Estrutura, clientes e metas para decisões mais rápidas.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end" data-no-print="true">
          <div className="min-w-0 rounded-lg border bg-white px-4 py-2 text-left sm:mr-1 sm:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Meta Board {defaultTargetYear}</p>
            <p className="truncate text-lg font-bold text-brq-purple" title={formatCurrency(summary.totalTarget)}>{formatCompactCurrency(summary.totalTarget)}</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => exportDeliveryDataAsCsv(people, customers)}>
            <Download className="h-4 w-4" /> Exportar dados CSV
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => exportElementAsPdf("executive-dashboard", "dashboard-executivo-brq.pdf")}>
            <FileDown className="h-4 w-4" /> Exportar dashboard PDF
          </Button>
        </div>
      </div>

      <Card className="p-4 shadow-sm" data-no-print="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">New Logos</p>
            <p className="text-xs text-slate-500">
              New Logos ficam no controle e podem ajudar na realização do ano, mas não compõem a meta oficial planejada. Ative para incluí-los nos KPIs, gráficos e exportação.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brq-purple focus:ring-brq-purple"
              checked={includeNewLogos}
              onChange={(event) => setIncludeNewLogos(event.target.checked)}
            />
            Incluir New Logos
          </label>
        </div>
      </Card>

      <div id="executive-dashboard" className="min-w-0 space-y-6 rounded-xl">
        <section aria-label="Resumo executivo">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Resumo executivo</h2>
          {summaryLoading && !effectiveSummary ? (
            <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : summaryError && !effectiveSummary ? (
            <Card className="border-red-200 bg-red-50/70">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Falha ao carregar o resumo executivo</p>
                    <p className="mt-1 text-sm text-red-700">{summaryError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
              <KpiSummaryCard label="Meta Board" currencyValue={effectiveSummary.totalTarget} icon={Target} />
              <KpiSummaryCard label="Receita Alocada" currencyValue={effectiveSummary.allocatedPeopleTotal} icon={TrendingUp} />
              <KpiSummaryCard label="Gap" currencyValue={effectiveSummary.peopleDelta} icon={ArrowRight} tone={effectiveSummary.peopleDelta < -0.01 ? "danger" : effectiveSummary.peopleDelta > 0.01 ? "ok" : "neutral"} />
              <KpiSummaryCard label="Atingimento" value={`${effectiveSummary.achievementPercentage.toFixed(1)}%`} icon={ChartIcon} />
              <KpiSummaryCard label="Clientes" value={effectiveSummary.customerCount} icon={Building2} />
              <KpiSummaryCard label="Pessoas Ativas" value={effectiveSummary.activePeopleCount ?? data.summary.activePeopleCount} icon={UsersRound} />
              <KpiSummaryCard label="Diretores" value={effectiveSummary.directorCount ?? data.summary.directorCount} icon={UserCog} />
              <KpiSummaryCard label="Managers" value={effectiveSummary.managerCount ?? data.summary.managerCount} icon={UsersRound} />
            </div>
          )}
        </section>

        <section aria-label="Composição financeira">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Composição financeira</h2>
          {summaryLoading && !effectiveSummary ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : summaryError && !effectiveSummary ? (
            <Card className="border-red-200 bg-red-50/70">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Falha ao carregar a composição financeira</p>
                    <p className="mt-1 text-sm text-red-700">{summaryError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <FinancialKpi label="Meta Board" currencyValue={effectiveSummary.totalTarget} icon={Target} />
              <FinancialKpi label="Board Hunter" currencyValue={effectiveSummary.hunterTarget} icon={UserCog} />
              <FinancialKpi label="Board Renov. + Ampl." currencyValue={effectiveSummary.farmerRenewalTarget} icon={BriefcaseBusiness} />
              <FinancialKpi label="Alocado em Pessoas" currencyValue={effectiveSummary.allocatedPeopleTotal} icon={Building2} />
              <FinancialKpi label="Dif. Pessoas x Board" currencyValue={effectiveSummary.peopleDelta} icon={TrendingUp} tone={effectiveSummary.peopleDelta < -0.01 ? "danger" : effectiveSummary.peopleDelta > 0.01 ? "ok" : "neutral"} />
            </div>
          )}
        </section>

        <section aria-label="Visualizações financeiras">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Visualizações financeiras</h2>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartCard title="Visão Financeira por Cliente">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={effectiveFinancialByCustomer} layout="vertical" margin={{ top: 0, right: 10, left: 42, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="customerCluster" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenueCurrent" name="Alocado em Pessoas" fill="#15171B" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="revenueTarget" name="Baseline Board" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>

            <ChartCard title="Visão Financeira por Diretor">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={financialByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartCard title="Visão Financeira por Subordinado">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={financialByManager} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>

            <ChartCard title="Distribuição por Perfil">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                    {roleDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>
          </div>
        </section>

        <section aria-label="Performance por cliente">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Performance por cliente</h2>
          {customerPerformanceLoading ? (
            <Card className="p-4 shadow-sm">
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </Card>
          ) : customerPerformanceError ? (
            <Card className="border-red-200 bg-red-50/70">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Falha ao carregar a performance por cliente</p>
                    <p className="mt-1 text-sm text-red-700">{customerPerformanceError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : customerPerformanceItems.length === 0 ? (
            <Card className="p-4 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">Nenhum cliente encontrado para os filtros selecionados.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="min-w-0 overflow-hidden shadow-sm">
              <CardContent className="overflow-x-auto">
                <table className="min-w-full text-left text-xs leading-5">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-1.5 pr-3 font-medium">Cliente</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Meta</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Alocado</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Delta</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Atingimento</th>
                      <th className="py-1.5 font-medium text-right">Responsáveis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPerformanceItems.slice(0, 8).map((item, index) => (
                      <tr key={item.customerId} className={index > 0 ? "border-t" : ""}>
                        <td className="py-1.5 pr-3 font-medium text-slate-900">{item.customerName}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{formatCompactCurrency(item.targetAmount)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{formatCompactCurrency(item.allocatedTotal)}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums ${item.peopleDelta < -0.01 ? "text-red-600" : item.peopleDelta > 0.01 ? "text-emerald-700" : "text-slate-700"}`}>{formatCompactCurrency(item.peopleDelta)}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums ${item.achievementPercentage >= 100 ? "text-emerald-700" : item.achievementPercentage < 100 ? "text-red-600" : "text-slate-700"}`}>{item.achievementPercentage.toFixed(1)}%</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-700">{item.responsiblePeopleCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>

        <section aria-label="Distribuição por responsável">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Distribuição por responsável</h2>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <ChartCard title="Clientes por Manager">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={clientsByManager} layout="vertical" margin={{ top: 0, right: 10, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="clientes" name="Clientes" fill="#15171B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>

            <ChartCard title="Clientes por Diretor">
              {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={clientsByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="clientes" name="Clientes" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <ChartPlaceholder />}
            </ChartCard>
          </div>
        </section>

        <section aria-label="Alertas de gestão">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Alertas de gestão</h2>
          {alerts.length === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/70">
              <CardContent className="p-4">
                <p className="text-sm text-emerald-800">Nenhum alerta no momento. Todos os indicadores estão dentro dos parâmetros esperados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert, index) => (
                <AlertCard key={`${alert.type}-${index}`} alert={alert} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />;
}

function FinancialKpi({
  label,
  currencyValue,
  icon: Icon,
  tone = "purple",
}: {
  label: string;
  currencyValue: number;
  icon: React.ElementType;
  tone?: "neutral" | "purple" | "ok" | "warning" | "danger";
}) {
  return <KpiSummaryCard label={label} currencyValue={currencyValue} icon={Icon} tone={tone} />;
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function AlertCard({ alert }: { alert: import("@/lib/dashboardMetrics").ManagementAlert }) {
  const severityTone = alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "warning" : "neutral";
  return (
    <Card className={cn("border", severityTone === "danger" ? "border-red-200 bg-red-50/70" : severityTone === "warning" ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", alert.severity === "danger" ? "text-red-600" : alert.severity === "warning" ? "text-amber-600" : "text-slate-500")} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{alert.description}</p>
            <p className="mt-1 text-xs text-slate-500">{alert.affectedEntity}</p>
            {alert.detail && (
              <p className="mt-1 text-xs text-slate-400" title={alert.detail}>
                {alert.detail.length > 80 ? `${alert.detail.slice(0, 80)}...` : alert.detail}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function subscribeToHydration() {
  return () => undefined;
}

function ChartCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72 p-5 pt-0">{children}</CardContent>
    </Card>
  );
}
