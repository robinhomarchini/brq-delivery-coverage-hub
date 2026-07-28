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
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { portfolioSource, revenuePlans, type RevenuePlan } from "@/data/customerPortfolioData";
import type { Customer, Person } from "@/data/mockData";
import { useDeliveryStore } from "@/store/delivery-store";
import { normalizeName } from "@/lib/financial-customers";
import { isCustomerManagerProfile, isDirectorRole, isFarmerDeliveryTargetRole, isHunterRole } from "@/lib/roles";
import { formatCurrency } from "@/lib/utils";
import { displayDirectorName } from "@/lib/director-governance";

type PortfolioPlanView = RevenuePlan & {
  directorIds: string[];
  managerIds: string[];
  hunterIds: string[];
};

export function CustomerPortfolioManagement() {
  const { customers, people, targetAllocations, studioTargetAllocations } = useDeliveryStore();
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [directorId, setDirectorId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [cluster, setCluster] = useState("");
  const portfolioYear = 2026;
  const directors = useMemo(() => people
    .filter((person) => person.active && isDirectorRole(person.roleType))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
  [people]);
  const managers = useMemo(() => people
    .filter((person) => person.active && isCustomerManagerProfile(person.roleType, person.isManager))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
  [people]);
  const planViews = useMemo(
    () => buildPortfolioPlanViews(revenuePlans, customers, people, targetAllocations, studioTargetAllocations, portfolioYear),
    [customers, people, portfolioYear, studioTargetAllocations, targetAllocations],
  );

  const filteredPlans = useMemo(() => planViews.filter((plan) =>
    (!directorId || plan.directorIds.includes(directorId))
    && (!managerId || plan.managerIds.includes(managerId))
    && (!cluster || plan.customerCluster === cluster)
  ), [cluster, directorId, managerId, planViews]);

  const totals = useMemo(() => calculateTotals(filteredPlans), [filteredPlans]);
  const byDirector = useMemo(() => groupByDirector(filteredPlans, directors), [directors, filteredPlans]);
  const byManager = useMemo(() => groupByManager(filteredPlans, managers), [filteredPlans, managers]);
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
        description="Gestão executiva de receita atual, meta prevista, receita Hunter, receita Delivery/Farmer e Áreas / Studios por cliente, diretor e manager."
      />

      <Card className="p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4 text-brq-purple" />
          Filtros executivos
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={directorId} onChange={(event) => setDirectorId(event.target.value)}>
            <option value="">Todos os diretores</option>
            {directors.map((director) => <option key={director.id} value={director.id}>{displayDirectorName(director.name)}</option>)}
          </Select>
          <Select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">Todos os managers</option>
            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
          </Select>
          <Select value={cluster} onChange={(event) => setCluster(event.target.value)}>
            <option value="">Todos os clusters</option>
            {revenuePlans.map((plan) => <option key={plan.id} value={plan.customerCluster}>{plan.customerCluster}</option>)}
          </Select>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiSummaryCard label="Receita Atual" currencyValue={totals.revenueCurrent} icon={TrendingUp} tone="dark" />
        <KpiSummaryCard label="Meta Prevista" currencyValue={totals.revenueTarget} icon={Target} tone="purple" />
        <KpiSummaryCard label="Receita Hunter" currencyValue={totals.hunterRevenue} icon={UserCog} tone="warning" />
        <KpiSummaryCard label="Delivery/Farmer" currencyValue={totals.deliveryFarmerRevenue} icon={Building2} tone="purple" />
        <KpiSummaryCard label="Áreas / Studios" currencyValue={totals.studioRevenue} icon={Building2} tone="sky" />
      </section>

      <Card className="border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 shadow-sm">
        <p className="font-bold">Reconciliação Financial BU</p>
        <p className="mt-1">
          Receita Hunter + Delivery/Farmer + Áreas / Studios = {formatCurrency(totals.hunterRevenue + totals.deliveryFarmerRevenue + totals.studioRevenue)} ·
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
          <Table className="min-w-[1440px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Diretor Responsável</TableHead>
                <TableHead>Delivery/Farmer</TableHead>
                <TableHead>Hunter / Comercial</TableHead>
                <TableHead>Receita Atual</TableHead>
                <TableHead>Meta Prevista</TableHead>
                <TableHead>Receita Hunter</TableHead>
                <TableHead>Receita Delivery/Farmer</TableHead>
                <TableHead>Áreas / Studios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{plan.customerName}</p>
                    <p className="text-xs text-slate-400">{plan.industry}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {plan.directorIds.length
                        ? plan.directorIds.map((id) => <Badge key={id} variant="secondary">{displayDirectorName(personName(people, id))}</Badge>)
                        : <span className="text-slate-400">Sem diretor definido</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {plan.managerIds.length
                        ? plan.managerIds.map((id) => <Badge key={id} variant="secondary">{personName(people, id)}</Badge>)
                        : <span className="text-slate-400">Sem Delivery/Farmer definido</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {plan.hunterIds.length
                        ? plan.hunterIds.map((id) => <Badge key={id} className="bg-orange-100 text-orange-800 hover:bg-orange-100">{personName(people, id)}</Badge>)
                        : <span className="text-slate-400">Sem Hunter definido</span>}
                    </div>
                  </TableCell>
                  <MoneyCell value={plan.revenueCurrent} />
                  <MoneyCell value={plan.revenueTarget} strong />
                  <MoneyCell value={plan.hunterRevenue} />
                  <MoneyCell value={plan.deliveryFarmerRevenue} />
                  <MoneyCell value={getStudioRevenue(plan)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
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
    studioRevenue: totals.studioRevenue + getStudioRevenue(plan),
  }), { revenueCurrent: 0, revenueTarget: 0, hunterRevenue: 0, deliveryFarmerRevenue: 0, studioRevenue: 0 });
}

function getStudioRevenue(plan: RevenuePlan) {
  return Math.max(plan.revenueTarget - plan.hunterRevenue - plan.deliveryFarmerRevenue, 0);
}

function groupByDirector(plans: PortfolioPlanView[], directors: Person[]) {
  return directors.map((director) => {
    const directorPlans = plans.filter((plan) => plan.directorIds.includes(director.id));
    return {
      name: displayDirectorName(director.name),
      revenueCurrent: calculateTotals(directorPlans).revenueCurrent,
      revenueTarget: calculateTotals(directorPlans).revenueTarget,
    };
  });
}

function groupByManager(plans: PortfolioPlanView[], managers: Person[]) {
  return managers.map((manager) => ({
    name: manager.name,
    revenueTarget: plans
      .filter((plan) => plan.managerIds.includes(manager.id))
      .reduce((total, plan) => total + plan.revenueTarget, 0),
  })).filter((item) => item.revenueTarget > 0).sort((a, b) => b.revenueTarget - a.revenueTarget);
}

function buildPortfolioPlanViews(
  plans: RevenuePlan[],
  customers: Customer[],
  people: Person[],
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number }>,
  studioTargetAllocations: Array<{ customerId: string; hunterPersonId?: string; year: number; hunterAmount: number }>,
  year: number,
): PortfolioPlanView[] {
  const customersByName = new Map(customers.map((customer) => [normalizeName(customer.name), customer]));
  const peopleById = new Map(people.map((person) => [person.id, person]));

  return plans.map((plan) => {
    const sourceCustomers = plan.sourceCustomerNames
      .map((name) => customersByName.get(normalizeName(name)))
      .filter((customer): customer is Customer => Boolean(customer));
    const sourceCustomerIds = sourceCustomers.map((customer) => customer.id);
    const directlyLinkedPeople = people.filter((person) =>
      person.active
      && sourceCustomerIds.some((customerId) => person.clientIds.includes(customerId))
    );
    const managerIds = unique([
      ...sourceCustomers.flatMap((customer) => customer.managerResponsibleIds),
      ...directlyLinkedPeople
        .filter((person) => isCustomerManagerProfile(person.roleType, person.isManager) || isFarmerDeliveryTargetRole(person.roleType))
        .map((person) => person.id),
      ...targetAllocations
        .filter((allocation) =>
          sourceCustomerIds.includes(allocation.customerId)
          && allocation.year === year
          && allocation.type === "farmer_renewal"
          && allocation.amount > 0
        )
        .map((allocation) => allocation.personId),
    ]).filter((id) => {
      const person = peopleById.get(id);
      return Boolean(person?.active && (isCustomerManagerProfile(person.roleType, person.isManager) || isFarmerDeliveryTargetRole(person.roleType)));
    });
    const hunterIds = unique([
      ...directlyLinkedPeople.filter((person) => isHunterRole(person.roleType)).map((person) => person.id),
      ...targetAllocations
        .filter((allocation) =>
          sourceCustomerIds.includes(allocation.customerId)
          && allocation.year === year
          && allocation.type === "hunter"
          && allocation.amount > 0
        )
        .map((allocation) => allocation.personId),
      ...studioTargetAllocations
        .filter((allocation) =>
          sourceCustomerIds.includes(allocation.customerId)
          && allocation.year === year
          && allocation.hunterPersonId
          && allocation.hunterAmount > 0
        )
        .map((allocation) => allocation.hunterPersonId as string),
    ]).filter((id) => {
      const person = peopleById.get(id);
      return Boolean(person?.active && isHunterRole(person.roleType));
    });
    const directorIds = unique([
      ...sourceCustomers.map((customer) => customer.directorResponsibleId),
      ...[...managerIds, ...hunterIds]
        .map((personId) => peopleById.get(personId)?.directorId)
        .filter((id): id is string => Boolean(id)),
    ]);

    return {
      ...plan,
      directorIds,
      managerIds,
      hunterIds,
    };
  });
}

function personName(people: Person[], id: string) {
  return people.find((person) => person.id === id)?.name ?? id;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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
