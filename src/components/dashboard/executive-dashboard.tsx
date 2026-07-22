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
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeliveryStore } from "@/store/delivery-store";
import { exportDeliveryDataAsCsv, exportElementAsPdf } from "@/lib/export";
import { cn, formatCompactCurrency, formatCurrency, normalizeBusinessName } from "@/lib/utils";
import { translateRole } from "@/lib/roles";
import { applyCustomerTargetsForYear, defaultTargetYear } from "@/lib/customer-targets";
import { getBoardTargetBaselineRows, getBoardTargetBaselineTotals } from "@/lib/board-target-baseline";
import { customerCountsTowardTarget, getCustomerTotalTarget } from "@/lib/customer-target-total";
import { getCustomerCoverageAllocatedTotal } from "@/lib/customers/customer-coverage-view-model";
import { useAccess } from "@/lib/access-context";
import { buildHunterAccessScope } from "@/lib/hunter-access-scope";

const COLORS = ["#15171B", "#7F2EC9", "#EE7C38", "#2563EB", "#F97316", "#A3A3A3"];

export function ExecutiveDashboard() {
  const chartsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const { accessUser } = useAccess();
  const { areas, people, customers, customerTargets, boardTargetBaselines, targetAllocations, studioTargetAllocations, specialistHunterStudioAssignments } = useDeliveryStore();
  const [includeNewLogos, setIncludeNewLogos] = useState(false);
  const financialCustomers = applyCustomerTargetsForYear(customers, customerTargets, defaultTargetYear);
  const hunterScope = buildHunterAccessScope({
    accessUser,
    people,
    customers: financialCustomers,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
  });
  const dashboardCustomers = (includeNewLogos ? financialCustomers : financialCustomers.filter(customerCountsTowardTarget))
    .filter((customer) => !hunterScope.enabled || hunterScope.customerIds.has(customer.id));
  const scopedCustomerIds = new Set(dashboardCustomers.map((customer) => customer.id));
  const activePeople = people.filter((person) => {
    if (!person.active) return false;
    if (!hunterScope.enabled) return true;
    if (hunterScope.person?.id === person.id) return true;
    return person.clientIds.some((customerId) => scopedCustomerIds.has(customerId))
      || targetAllocations.some((allocation) => allocation.personId === person.id && scopedCustomerIds.has(allocation.customerId))
      || studioTargetAllocations.some((allocation) =>
        scopedCustomerIds.has(allocation.customerId)
        && (allocation.hunterPersonId === person.id || allocation.maintenancePersonId === person.id)
      );
  });
  const directors = activePeople.filter((person) => person.roleType === "Director" || person.roleType === "Executive");
  const managers = activePeople.filter((person) => person.isManager);
  const farmerDeliveryManagers = managers.filter((person) => person.roleType === "Farmer + Delivery");
  const deliveryManagers = managers.filter((person) => person.roleType === "Delivery");
  const hunters = activePeople.filter((person) => person.roleType === "Hunter");
  const farmers = activePeople.filter((person) => person.roleType === "Farmer");
  const hunterFarmers = activePeople.filter((person) => person.roleType === "Hunter + Farmer");
  const staff = activePeople.filter((person) => person.roleType === "Staff");
  const boardRows = getBoardTargetBaselineRows(defaultTargetYear, boardTargetBaselines);
  const boardTotals = getScopedBoardTotals(dashboardCustomers, boardRows, hunterScope.enabled);
  const totalRevenue = boardTotals.totalTarget;
  const baselineByCustomer = new Map(
    boardRows
      .map((row) => [normalizeBusinessName(row.customerName), row.totalTarget]),
  );
  const dashboardCustomerIds = new Set(dashboardCustomers.map((customer) => customer.id));
  const dashboardTargetAllocations = targetAllocations.filter((allocation) => dashboardCustomerIds.has(allocation.customerId));
  const dashboardStudioTargetAllocations = studioTargetAllocations.filter((allocation) => dashboardCustomerIds.has(allocation.customerId));
  const allocatedPeopleByCustomer = new Map(dashboardCustomers.map((customer) => [
    customer.id,
    getCustomerCoverageAllocatedTotal(customer, people, dashboardTargetAllocations, dashboardStudioTargetAllocations, areas, defaultTargetYear),
  ]));
  const allocatedPeopleTotal = roundCurrency(Array.from(allocatedPeopleByCustomer.values()).reduce((total, value) => total + value, 0));
  const peopleDelta = roundCurrency(allocatedPeopleTotal - boardTotals.totalTarget);
  const financialByCustomer = dashboardCustomers
    .map((customer) => {
      const baselineTarget = baselineByCustomer.get(normalizeBusinessName(customer.name)) ?? getCustomerTarget(customer);
      const allocatedPeople = allocatedPeopleByCustomer.get(customer.id) ?? 0;
      return {
        customerCluster: customer.name,
        revenueCurrent: allocatedPeople,
        revenueTarget: baselineTarget,
        hunterRevenue: customer.hunterTarget,
        deliveryFarmerRevenue: customer.farmerRenewalTarget,
        studioRevenue: customer.studioTarget,
      };
    })
    .filter((item) => item.revenueCurrent > 0 || item.revenueTarget > 0)
    .sort((a, b) => Math.max(b.revenueCurrent, b.revenueTarget) - Math.max(a.revenueCurrent, a.revenueTarget))
    .slice(0, 10);
  const financialByDirector = activePeople
    .filter((person) => person.roleType === "Director")
    .map((director) => {
    const plans = dashboardCustomers.filter((customer) => customer.directorResponsibleId === director.id);
    return {
      name: director.name,
      revenueTarget: plans.reduce((total, customer) => total + getCustomerTarget(customer), 0),
      hunterRevenue: plans.reduce((total, customer) => total + customer.hunterTarget, 0),
      deliveryFarmerRevenue: plans.reduce((total, customer) => total + customer.farmerRenewalTarget, 0),
    };
  })
    .filter((item) => item.revenueTarget > 0)
    .sort((a, b) => b.revenueTarget - a.revenueTarget);
  const financialByManager = managers
    .map((manager) => {
      const plans = dashboardCustomers.filter((customer) => customer.managerResponsibleIds.includes(manager.id));
      return {
        name: manager.name,
        revenueTarget: plans.reduce((total, customer) => total + getCustomerTarget(customer), 0),
        hunterRevenue: plans.reduce((total, customer) => total + customer.hunterTarget, 0),
        deliveryFarmerRevenue: plans.reduce((total, customer) => total + customer.farmerRenewalTarget, 0),
      };
    })
    .filter((item) => item.revenueTarget > 0)
    .sort((a, b) => b.revenueTarget - a.revenueTarget);

  const distributionByDirector = people
    .filter((person) => person.roleType === "Director")
    .map((director) => ({
      name: director.name,
      managers: managers.filter((manager) => manager.directorId === director.id).length,
      clientes: dashboardCustomers.filter((customer) => customer.directorResponsibleId === director.id).length,
    }));

  const roleDistribution = [
    { name: translateRole("Delivery"), value: deliveryManagers.length },
    { name: translateRole("Farmer + Delivery"), value: farmerDeliveryManagers.length },
    { name: translateRole("Hunter"), value: hunters.length },
    { name: translateRole("Farmer"), value: farmers.length },
    { name: translateRole("Hunter + Farmer"), value: hunterFarmers.length },
    { name: translateRole("Staff"), value: staff.length },
  ].filter((item) => item.value > 0);

  const clientsByManager = managers
    .map((manager) => ({
      name: manager.name.split(" ")[0],
      clientes: dashboardCustomers.filter((customer) => customer.managerResponsibleIds.includes(manager.id)).length,
    }))
    .sort((a, b) => b.clientes - a.clientes)
    .slice(0, 10);

  const kpis = [
    { label: "Diretores", value: directors.length, icon: UserCog },
    { label: "Managers", value: managers.length, icon: UsersRound },
    { label: "Delivery", value: deliveryManagers.length, icon: UserCog },
    { label: "Farmer + Delivery", value: farmerDeliveryManagers.length, icon: BriefcaseBusiness, farmer: true },
    { label: "Hunters", value: hunters.length, icon: Target },
    { label: "Farmers", value: farmers.length, icon: BriefcaseBusiness },
    { label: "Hunter + Farmer", value: hunterFarmers.length, icon: TrendingUp },
    { label: "Clientes", value: dashboardCustomers.length, icon: Building2 },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-brq-purple">Visão executiva</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-brq-ink lg:text-4xl">Cobertura que importa</h1>
          <p className="mt-2 text-sm text-slate-500">Estrutura, clientes e metas para decisões mais rápidas.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end" data-no-print="true">
          <div className="min-w-0 rounded-lg border bg-white px-4 py-2 text-left sm:mr-1 sm:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Meta Board 2026</p>
            <p className="truncate text-lg font-bold text-brq-purple" title={formatCurrency(totalRevenue)}>{formatCompactCurrency(totalRevenue)}</p>
          </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => exportDeliveryDataAsCsv(activePeople, dashboardCustomers)}>
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

      <div id="executive-dashboard" className="min-w-0 space-y-4 rounded-xl">
        <section className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-8">
          {kpis.map(({ label, value, icon: Icon, farmer }) => (
            <KpiSummaryCard
              key={label}
              label={label}
              value={value}
              icon={Icon}
              tone={farmer ? "dark" : "purple"}
            />
          ))}
        </section>

        <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FinancialKpi label="Meta Board 2026" currencyValue={boardTotals.totalTarget} icon={Target} />
          <FinancialKpi label="Board Hunter" currencyValue={boardTotals.hunterTarget} icon={UserCog} />
          <FinancialKpi label="Board Renov. + Ampl." currencyValue={boardTotals.farmerRenewalTarget} icon={BriefcaseBusiness} />
          <FinancialKpi label="Alocado em Pessoas" currencyValue={allocatedPeopleTotal} icon={Building2} />
          <FinancialKpi label="Dif. Pessoas x Board" currencyValue={peopleDelta} icon={TrendingUp} tone={peopleDelta < -0.01 ? "danger" : peopleDelta > 0.01 ? "ok" : "neutral"} />
        </section>

        <ChartCard title="Visão Financeira por Cliente">
          {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={financialByCustomer} layout="vertical" margin={{ top: 0, right: 10, left: 42, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="customerCluster" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenueCurrent" name="Alocado em Pessoas" fill="#15171B" radius={[0, 4, 4, 0]} />
              <Bar dataKey="revenueTarget" name="Baseline Board" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer> : <ChartPlaceholder />}
        </ChartCard>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <ChartCard title="Visão Financeira por Diretor">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={financialByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>

          <ChartCard title="Visão Financeira por Subordinado">
            {chartsReady ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={financialByManager} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => compactCurrency(Number(value))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hunterRevenue" name="Hunter" stackId="total" fill="#EE7C38" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deliveryFarmerRevenue" name="Delivery/Farmer" stackId="total" fill="#7F2EC9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-3">
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
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
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
              <BarChart data={distributionByDirector} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="clientes" name="Clientes" fill="#7F2EC9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <ChartPlaceholder />}
          </ChartCard>
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

function getCustomerTarget(customer: { hunterTarget: number; farmerRenewalTarget: number; studioTarget: number }) {
  return getCustomerTotalTarget(customer);
}

function getScopedBoardTotals(
  customers: Array<{ name: string; hunterTarget: number; farmerRenewalTarget: number; studioTarget: number }>,
  boardRows: ReturnType<typeof getBoardTargetBaselineRows>,
  scoped: boolean,
) {
  if (!scoped) return getBoardTargetBaselineTotals(defaultTargetYear, boardRows);

  const rowsByCustomer = new Map(boardRows.map((row) => [normalizeBusinessName(row.customerName), row]));

  return customers.reduce((totals, customer) => {
    const baseline = rowsByCustomer.get(normalizeBusinessName(customer.name));
    const hunterTarget = baseline?.hunterTarget ?? customer.hunterTarget;
    const farmerRenewalTarget = baseline?.farmerRenewalTarget ?? customer.farmerRenewalTarget;
    const totalTarget = baseline?.totalTarget ?? getCustomerTarget(customer);

    return {
      hunterTarget: roundCurrency(totals.hunterTarget + hunterTarget),
      farmerRenewalTarget: roundCurrency(totals.farmerRenewalTarget + farmerRenewalTarget),
      totalTarget: roundCurrency(totals.totalTarget + totalTarget),
    };
  }, { hunterTarget: 0, farmerRenewalTarget: 0, totalTarget: 0 });
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(0)} mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return `R$ ${value.toFixed(0)}`;
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
