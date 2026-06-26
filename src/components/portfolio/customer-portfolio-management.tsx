"use client";

import { Building2, Filter, Target, TrendingUp, UserCog } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  portfolioDeliveryManagers,
  portfolioDirectors,
  portfolioSource,
  revenuePlans,
  type RevenuePlan,
} from "@/data/customerPortfolioData";
import { formatCurrency } from "@/lib/utils";

export function CustomerPortfolioManagement() {
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [directorId, setDirectorId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [cluster, setCluster] = useState("");

  const filteredPlans = useMemo(() => revenuePlans.filter((plan) =>
    (!directorId || plan.directorId === directorId)
    && (!managerId || plan.managerIds.includes(managerId))
    && (!cluster || plan.customerCluster === cluster)
  ), [cluster, directorId, managerId]);

  const totals = useMemo(() => calculateTotals(filteredPlans), [filteredPlans]);
  const byDirector = useMemo(() => groupByDirector(filteredPlans), [filteredPlans]);
  const byManager = useMemo(() => groupByManager(filteredPlans), [filteredPlans]);
  const topClusters = useMemo(() => [...filteredPlans]
    .sort((a, b) => b.revenueTarget - a.revenueTarget)
    .slice(0, 12), [filteredPlans]);
  const valueByCustomer = useMemo(() => [...filteredPlans]
    .sort((a, b) => b.revenueTarget - a.revenueTarget)
    .slice(0, 12), [filteredPlans]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="BU Financial"
        title="Portfólio de Clientes e Metas"
        description="Gestão executiva de receita atual, meta prevista, receita Hunter e receita Delivery/Farmer por cliente, diretor e manager."
      />

      <Card className="p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4 text-brq-purple" />
          Filtros executivos
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={directorId} onChange={(event) => setDirectorId(event.target.value)}>
            <option value="">Todos os diretores</option>
            {portfolioDirectors.map((director) => <option key={director.id} value={director.id}>{director.name}</option>)}
          </Select>
          <Select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">Todos os managers</option>
            {portfolioDeliveryManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
          </Select>
          <Select value={cluster} onChange={(event) => setCluster(event.target.value)}>
            <option value="">Todos os clusters</option>
            {revenuePlans.map((plan) => <option key={plan.id} value={plan.customerCluster}>{plan.customerCluster}</option>)}
          </Select>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Receita Atual" value={formatCurrency(totals.revenueCurrent)} icon={TrendingUp} />
        <Kpi label="Meta Prevista" value={formatCurrency(totals.revenueTarget)} icon={Target} />
        <Kpi label="Receita Hunter" value={formatCurrency(totals.hunterRevenue)} icon={UserCog} />
        <Kpi label="Delivery/Farmer" value={formatCurrency(totals.deliveryFarmerRevenue)} icon={Building2} />
      </section>

      <Card className="border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 shadow-sm">
        <p className="font-bold">Reconciliação Financial BU</p>
        <p className="mt-1">
          Receita Hunter + Delivery/Farmer = {formatCurrency(totals.hunterRevenue + totals.deliveryFarmerRevenue)} ·
          Meta Prevista = {formatCurrency(totals.revenueTarget)}
        </p>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Receita por Diretor">
          {chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={byDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenueCurrent" name="Receita Atual" fill="#15171B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenueTarget" name="Meta Prevista" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartPlaceholder />}
        </ChartCard>

        <ChartCard title="Meta Prevista por Manager">
          {chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={byManager} layout="vertical" margin={{ top: 0, right: 10, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="revenueTarget" name="Meta Prevista" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartPlaceholder />}
        </ChartCard>
      </section>

      <ChartCard title="Receita Atual x Meta Prevista por Cliente">
        {chartsReady ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={valueByCustomer} margin={{ top: 10, right: 10, left: -20, bottom: 55 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="customerCluster" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenueCurrent" name="Receita Atual" fill="#15171B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenueTarget" name="Meta Prevista" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartPlaceholder />}
      </ChartCard>

      <ChartCard title="Top Clusters por Meta Prevista">
        {chartsReady ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={topClusters} margin={{ top: 10, right: 10, left: -20, bottom: 55 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="customerCluster" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenueTarget" name="Meta Prevista" fill="#15171B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartPlaceholder />}
      </ChartCard>

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Plano de receita por cliente</h2>
          <p className="mt-1 text-xs text-slate-500">
            Fonte: {portfolioSource.fileName} · {portfolioSource.summarySheet}. Receita Hunter é usada apenas para atribuição/reporting; ownership segue governança de Delivery.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Diretor Responsável</TableHead>
                <TableHead>Manager Responsável</TableHead>
                <TableHead>Receita Atual</TableHead>
                <TableHead>Meta Prevista</TableHead>
                <TableHead>Receita Hunter</TableHead>
                <TableHead>Receita Delivery/Farmer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{plan.customerName}</p>
                    <p className="text-xs text-slate-400">{plan.industry}</p>
                  </TableCell>
                  <TableCell>{directorName(plan.directorId)}</TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {plan.managerIds.map((id) => <Badge key={id} variant="secondary">{managerName(id)}</Badge>)}
                    </div>
                  </TableCell>
                  <MoneyCell value={plan.revenueCurrent} />
                  <MoneyCell value={plan.revenueTarget} strong />
                  <MoneyCell value={plan.hunterRevenue} />
                  <MoneyCell value={plan.deliveryFarmerRevenue} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-brq-purple">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-lg font-black text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="p-5 pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5 pt-0">{children}</CardContent>
    </Card>
  );
}

function MoneyCell({ value, strong = false }: { value: number; strong?: boolean }) {
  return <TableCell className={strong ? "font-bold text-slate-950" : undefined}>{formatCurrency(value)}</TableCell>;
}

function calculateTotals(plans: RevenuePlan[]) {
  return plans.reduce((totals, plan) => ({
    revenueCurrent: totals.revenueCurrent + plan.revenueCurrent,
    revenueTarget: totals.revenueTarget + plan.revenueTarget,
    hunterRevenue: totals.hunterRevenue + plan.hunterRevenue,
    deliveryFarmerRevenue: totals.deliveryFarmerRevenue + plan.deliveryFarmerRevenue,
  }), { revenueCurrent: 0, revenueTarget: 0, hunterRevenue: 0, deliveryFarmerRevenue: 0 });
}

function groupByDirector(plans: RevenuePlan[]) {
  return portfolioDirectors.map((director) => {
    const directorPlans = plans.filter((plan) => plan.directorId === director.id);
    return {
      name: director.name,
      revenueCurrent: calculateTotals(directorPlans).revenueCurrent,
      revenueTarget: calculateTotals(directorPlans).revenueTarget,
    };
  });
}

function groupByManager(plans: RevenuePlan[]) {
  return portfolioDeliveryManagers.map((manager) => ({
    name: manager.name,
    revenueTarget: plans
      .filter((plan) => plan.managerIds.includes(manager.id))
      .reduce((total, plan) => total + plan.revenueTarget, 0),
  })).filter((item) => item.revenueTarget > 0).sort((a, b) => b.revenueTarget - a.revenueTarget);
}

function directorName(id: string) {
  return portfolioDirectors.find((director) => director.id === id)?.name ?? id;
}

function managerName(id: string) {
  return portfolioDeliveryManagers.find((manager) => manager.id === id)?.name ?? id;
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(0)} mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return `R$ ${value.toFixed(0)}`;
}

function ChartPlaceholder() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />;
}

function subscribeToHydration() {
  return () => undefined;
}
